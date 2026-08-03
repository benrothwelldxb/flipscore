import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Game } from '@/domain/types'

import { useAccountStore } from './account-store'
import { useGameStore } from './game-store'
import { useSyncStore } from './sync-store'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** A minimal game record — only the sync-relevant fields matter here. */
function game(id: string, rev: number, updatedAt: number): Game {
  return {
    id,
    rev,
    updatedAt,
    deletedAt: null,
    name: '',
    players: [],
    rounds: [],
    settings: { mode: 'host', targetScore: 200 },
    status: 'setup',
    currentRoundIndex: 0,
    winnerId: null,
    favorite: false,
    createdAt: 0,
    finishedAt: null,
  } as unknown as Game
}

function reset() {
  useAccountStore.setState({
    user: null,
    token: null,
    pendingEmail: null,
    devCode: null,
  })
  useGameStore.setState({ games: [] })
  useSyncStore.setState({
    cursor: 0,
    status: 'idle',
    lastSyncedAt: null,
    error: null,
  })
}

describe('sync store', () => {
  beforeEach(reset)
  afterEach(() => vi.unstubAllGlobals())

  it('does nothing when signed out', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await useSyncStore.getState().syncNow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('pushes local items and merges pulled changes', async () => {
    useAccountStore.setState({ token: 'tok', user: { id: 'a', email: 'e' } })
    useGameStore.setState({ games: [game('g-local', 1, 10)] })

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        cursor: 5,
        changes: [
          {
            collection: 'games',
            id: 'g-remote',
            rev: 1,
            updatedAt: 20,
            deletedAt: null,
            data: game('g-remote', 1, 20),
          },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await useSyncStore.getState().syncNow()

    // The local game was pushed.
    expect(fetchMock).toHaveBeenCalledOnce()
    const init = fetchMock.mock.calls[0][1] as { body: string }
    const body = JSON.parse(init.body) as {
      since: number
      changes: { id: string }[]
    }
    expect(body.since).toBe(0)
    expect(body.changes.map((c) => c.id)).toContain('g-local')

    // The remote game was merged in, and the cursor advanced.
    expect(useGameStore.getState().games.map((g) => g.id)).toContain('g-remote')
    expect(useSyncStore.getState().cursor).toBe(5)
    expect(useSyncStore.getState().status).toBe('idle')
    expect(useSyncStore.getState().lastSyncedAt).not.toBeNull()
  })

  it('marks status error on a network failure', async () => {
    useAccountStore.setState({ token: 'tok', user: { id: 'a', email: 'e' } })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await useSyncStore.getState().syncNow()
    expect(useSyncStore.getState().status).toBe('error')
  })

  it('clears the session when the server says unauthorized', async () => {
    useAccountStore.setState({ token: 'tok', user: { id: 'a', email: 'e' } })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401)),
    )
    await useSyncStore.getState().syncNow()
    expect(useAccountStore.getState().token).toBeNull()
    expect(useSyncStore.getState().cursor).toBe(0)
  })
})
