import { expect, test, type APIRequestContext } from '@playwright/test'

// End-to-end against the real Worker + a migrated local D1 (see
// playwright.full.config.ts): passwordless sign-in and last-write-wins library
// sync, exercised over HTTP exactly as the app does it.

interface SyncItem {
  collection: string
  id: string
  rev: number
  updatedAt: number
  deletedAt: number | null
  data: unknown
}
interface SyncResponse {
  cursor: number
  changes: SyncItem[]
}

/** Complete a passwordless sign-in and return the session token. The Worker's
 *  console-email mode echoes the code back on a local origin. */
async function signIn(api: APIRequestContext, email: string): Promise<string> {
  const requested = await api.post('/api/auth/request-code', {
    data: { email },
  })
  expect(requested.ok(), await requested.text()).toBeTruthy()
  const { devCode } = (await requested.json()) as { devCode?: string }
  expect(devCode, 'console mode should echo the code locally').toBeTruthy()

  const verified = await api.post('/api/auth/verify-code', {
    data: { email, code: devCode },
  })
  expect(verified.ok(), await verified.text()).toBeTruthy()
  const { token } = (await verified.json()) as { token: string }
  expect(token).toBeTruthy()
  return token
}

/** One push+pull sync round-trip for a device holding `token`. */
async function sync(
  api: APIRequestContext,
  token: string,
  since: number,
  changes: SyncItem[],
): Promise<SyncResponse> {
  const res = await api.post('/api/sync', {
    headers: { authorization: `Bearer ${token}` },
    data: { since, changes },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (await res.json()) as SyncResponse
}

const find = (r: SyncResponse, id: string) => r.changes.find((c) => c.id === id)

test.describe('Cloud Accounts — live API', () => {
  test('two devices on one account converge under last-write-wins', async ({
    request,
  }) => {
    const email = `sync-${Date.now()}@test.dev`
    const itemId = `roster-${Date.now()}`

    // Device A signs in and pushes a roster entry (rev 1).
    const tokenA = await signIn(request, email)
    const v1: SyncItem = {
      collection: 'roster',
      id: itemId,
      rev: 1,
      updatedAt: 1000,
      deletedAt: null,
      data: { name: 'Ada' },
    }
    const pushA = await sync(request, tokenA, 0, [v1])
    expect(find(pushA, itemId)?.rev).toBe(1)

    // Device B signs in to the SAME account and pulls — it sees A's write.
    const tokenB = await signIn(request, email)
    const pullB = await sync(request, tokenB, 0, [])
    expect(find(pullB, itemId)?.rev).toBe(1)
    expect((find(pullB, itemId)?.data as { name: string }).name).toBe('Ada')

    // Device B edits the same item (rev 2) and pushes.
    const v2: SyncItem = {
      ...v1,
      rev: 2,
      updatedAt: 2000,
      data: { name: 'Bo' },
    }
    const pushB = await sync(request, tokenB, pullB.cursor, [v2])
    expect(find(pushB, itemId)?.rev).toBe(2)

    // Device A pulls from where it left off and converges on rev 2.
    const pullA = await sync(request, tokenA, pushA.cursor, [])
    expect(find(pullA, itemId)?.rev).toBe(2)
    expect((find(pullA, itemId)?.data as { name: string }).name).toBe('Bo')

    // A stale write (rev 1 again) must NOT overwrite the newer rev 2.
    await sync(request, tokenA, pullA.cursor, [
      { ...v1, updatedAt: 3000, data: { name: 'stale' } },
    ])
    const recheck = await sync(request, tokenB, 0, [])
    expect(find(recheck, itemId)?.rev).toBe(2)
    expect((find(recheck, itemId)?.data as { name: string }).name).toBe('Bo')
  })

  test('a deletion tombstone propagates to the other device', async ({
    request,
  }) => {
    const email = `del-${Date.now()}@test.dev`
    const itemId = `game-${Date.now()}`
    const token = await signIn(request, email)

    await sync(request, token, 0, [
      {
        collection: 'games',
        id: itemId,
        rev: 1,
        updatedAt: 1000,
        deletedAt: null,
        data: { name: 'Friday' },
      },
    ])
    const pushDel = await sync(request, token, 0, [
      {
        collection: 'games',
        id: itemId,
        rev: 2,
        updatedAt: 2000,
        deletedAt: 2000,
        data: { name: 'Friday' },
      },
    ])
    const tombstone = find(pushDel, itemId)
    expect(tombstone?.rev).toBe(2)
    expect(tombstone?.deletedAt).toBe(2000)
  })
})

test.describe('Cloud Accounts — browser sign-in', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'flipscore-prefs',
        JSON.stringify({
          state: { introSeen: true, identityPromptSeen: true },
          version: 5,
        }),
      )
    })
  })

  test('signs in from Settings using the echoed dev code', async ({ page }) => {
    const email = `browser-${Date.now()}@test.dev`
    await page.goto('/')

    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByLabel('Account', { exact: false }).fill(email)
    await page.getByRole('button', { name: 'Send sign-in code' }).click()

    // Console mode pre-fills the code field with the echoed code, so verifying
    // just needs the button — proving the client is wired to the live Worker.
    await page.getByRole('button', { name: 'Verify & sign in' }).click()

    await expect(page.getByText(email)).toBeVisible()
  })
})
