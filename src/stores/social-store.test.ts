import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAccountStore } from './account-store'
import { useGameStore } from './game-store'
import { useIdentityStore } from './identity-store'
import { useSocialStore } from './social-store'
import { useStickersStore } from './stickers-store'

interface Identity {
  accountId: string
  friendCode: string
  displayName: string
  stats: unknown
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * A stateful fake of the social API: an identity that POST patches merge into,
 * a friends list, and add/remove — enough to exercise the store end-to-end.
 */
function installFakeApi(initial?: Partial<Identity>) {
  const identity: Identity = {
    accountId: 'me',
    friendCode: 'ABCD2345',
    displayName: 'Ada',
    stats: {},
    ...initial,
  }
  const friends = [
    { accountId: 'f1', displayName: 'Bo', stats: { gamesWon: 2 } },
  ]

  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const path = url.replace(/^.*\/api\/social\//, '')
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(init.body as string) : {}

    if (path === 'identity' && method === 'GET') {
      return Promise.resolve(json({ identity }))
    }
    if (path === 'identity' && method === 'POST') {
      if (typeof body.displayName === 'string')
        identity.displayName = body.displayName
      if (body.stats !== undefined) identity.stats = body.stats
      return Promise.resolve(json({ identity }))
    }
    if (path === 'friends' && method === 'GET') {
      return Promise.resolve(json({ friends }))
    }
    if (path === 'friends/add' && method === 'POST') {
      if (body.code === 'BADCODE9')
        return Promise.resolve(json({ error: 'unknown_code' }, 404))
      return Promise.resolve(
        json({ friend: { accountId: 'f2', displayName: 'Cy', stats: {} } }),
      )
    }
    if (path === 'friends/remove' && method === 'POST') {
      return Promise.resolve(json({ ok: true }))
    }
    return Promise.resolve(json({ error: 'not_found' }, 404))
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function reset() {
  useAccountStore.setState({ token: null, user: null })
  useGameStore.setState({ games: [] })
  useIdentityStore.setState({ name: null })
  useStickersStore.getState().reset()
  useSocialStore.setState({
    identity: null,
    friends: [],
    status: 'idle',
    error: null,
  })
}

describe('social store', () => {
  beforeEach(reset)
  afterEach(() => vi.unstubAllGlobals())

  it('does nothing and clears state when signed out', async () => {
    const fetchMock = installFakeApi()
    await useSocialStore.getState().fetchAll()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useSocialStore.getState().identity).toBeNull()
  })

  it('loads identity and friends when signed in', async () => {
    useAccountStore.setState({ token: 'tok', user: { id: 'me', email: 'e' } })
    installFakeApi()
    await useSocialStore.getState().fetchAll()
    const state = useSocialStore.getState()
    expect(state.identity?.friendCode).toBe('ABCD2345')
    expect(state.friends.map((f) => f.accountId)).toEqual(['f1'])
    expect(state.status).toBe('idle')
  })

  it('claiming a name keeps it through the stats publish', async () => {
    useAccountStore.setState({ token: 'tok', user: { id: 'me', email: 'e' } })
    installFakeApi()
    await useSocialStore.getState().fetchAll()
    await useSocialStore.getState().claimName('Zoe')
    expect(useSocialStore.getState().identity?.displayName).toBe('Zoe')
    // Unified: claiming also sets the local "you" identity (drives stickers).
    expect(useIdentityStore.getState().name).toBe('Zoe')
  })

  it('claiming works offline: sets the local identity, no network call', async () => {
    const fetchMock = installFakeApi()
    // Signed out.
    await useSocialStore.getState().claimName('Ada')
    expect(useIdentityStore.getState().name).toBe('Ada')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('adds and removes friends', async () => {
    useAccountStore.setState({ token: 'tok', user: { id: 'me', email: 'e' } })
    installFakeApi()
    await useSocialStore.getState().fetchAll()

    await useSocialStore.getState().addFriend('GOODCODE')
    expect(useSocialStore.getState().friends.map((f) => f.accountId)).toContain(
      'f2',
    )

    await useSocialStore.getState().removeFriend('f1')
    expect(
      useSocialStore.getState().friends.map((f) => f.accountId),
    ).not.toContain('f1')
  })

  it('surfaces a bad friend code as an error', async () => {
    useAccountStore.setState({ token: 'tok', user: { id: 'me', email: 'e' } })
    installFakeApi()
    await expect(
      useSocialStore.getState().addFriend('BADCODE9'),
    ).rejects.toMatchObject({ code: 'unknown_code' })
  })
})
