import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAccountStore } from './account-store'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('account store', () => {
  beforeEach(() => {
    useAccountStore.setState({
      user: null,
      token: null,
      pendingEmail: null,
      devCode: null,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requestCode moves to the code step and captures the dev code', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ ok: true, mode: 'console', devCode: '123456' }),
        ),
    )
    await useAccountStore.getState().requestCode('ada@example.com')
    const s = useAccountStore.getState()
    expect(s.pendingEmail).toBe('ada@example.com')
    expect(s.devCode).toBe('123456')
    expect(s.token).toBeNull()
  })

  it('verifyCode signs in and clears the pending step', async () => {
    useAccountStore.setState({
      pendingEmail: 'ada@example.com',
      devCode: '123456',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          token: 'tok_1',
          user: { id: 'acct_1', email: 'ada@example.com' },
        }),
      ),
    )
    await useAccountStore.getState().verifyCode('123456')
    const s = useAccountStore.getState()
    expect(s.token).toBe('tok_1')
    expect(s.user).toEqual({ id: 'acct_1', email: 'ada@example.com' })
    expect(s.pendingEmail).toBeNull()
    expect(s.devCode).toBeNull()
  })

  it('verifyCode surfaces the API error code and stays signed out', async () => {
    useAccountStore.setState({ pendingEmail: 'ada@example.com' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid_code' }, 400)),
    )
    await expect(
      useAccountStore.getState().verifyCode('000000'),
    ).rejects.toMatchObject({ code: 'invalid_code' })
    expect(useAccountStore.getState().token).toBeNull()
  })

  it('signOut clears state and revokes server-side', async () => {
    useAccountStore.setState({
      user: { id: 'acct_1', email: 'ada@example.com' },
      token: 'tok_1',
    })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await useAccountStore.getState().signOut()
    const s = useAccountStore.getState()
    expect(s.user).toBeNull()
    expect(s.token).toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('refresh clears the token when the session is gone (401)', async () => {
    useAccountStore.setState({
      user: { id: 'acct_1', email: 'ada@example.com' },
      token: 'tok_1',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401)),
    )
    await useAccountStore.getState().refresh()
    expect(useAccountStore.getState().token).toBeNull()
  })

  it('refresh keeps the token on a transient network error', async () => {
    useAccountStore.setState({
      user: { id: 'acct_1', email: 'ada@example.com' },
      token: 'tok_1',
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await useAccountStore.getState().refresh()
    expect(useAccountStore.getState().token).toBe('tok_1')
  })
})
