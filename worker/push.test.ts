// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { sha256Hex } from './crypto'
import { handlePush, notify } from './push'
import { b64urlEncode } from './webpush'
import type { Env } from './worker.d'

interface SubRow {
  account_id: string
  p256dh: string
  auth: string
  topics: string
}

class FakeDB {
  accounts = new Map<string, { id: string; email: string }>()
  sessions = new Map<string, { account_id: string; expires_at: number }>()
  subs = new Map<string, SubRow>() // by endpoint

  prepare(query: string): FakeStmt {
    return new FakeStmt(this, query.replace(/\s+/g, ' ').trim())
  }
}

class FakeStmt {
  private args: unknown[] = []
  constructor(
    private readonly db: FakeDB,
    private readonly sql: string,
  ) {}
  bind(...args: unknown[]): FakeStmt {
    this.args = args
    return this
  }

  first<T = unknown>(): Promise<T | null> {
    const { db, sql, args } = this
    if (sql.includes('SELECT account_id, expires_at FROM sessions')) {
      const s = db.sessions.get(args[0] as string)
      return Promise.resolve(
        s
          ? ({ account_id: s.account_id, expires_at: s.expires_at } as T)
          : null,
      )
    }
    if (sql.includes('SELECT id, email FROM accounts WHERE id')) {
      const a = db.accounts.get(args[0] as string)
      return Promise.resolve(a ? ({ id: a.id, email: a.email } as T) : null)
    }
    return Promise.resolve(null)
  }

  run(): Promise<{ results: unknown[]; success: boolean; meta: unknown }> {
    const { db, sql, args } = this
    if (sql.includes('INSERT INTO push_subscriptions')) {
      db.subs.set(args[0] as string, {
        account_id: args[1] as string,
        p256dh: args[2] as string,
        auth: args[3] as string,
        topics: args[4] as string,
      })
    } else if (
      sql.includes('DELETE FROM push_subscriptions WHERE endpoint = ?1 AND')
    ) {
      const row = db.subs.get(args[0] as string)
      if (row && row.account_id === args[1]) db.subs.delete(args[0] as string)
    } else if (sql.includes('DELETE FROM push_subscriptions WHERE endpoint')) {
      db.subs.delete(args[0] as string)
    }
    return Promise.resolve({ results: [], success: true, meta: {} })
  }

  all<T = unknown>(): Promise<{
    results: T[]
    success: boolean
    meta: unknown
  }> {
    const { db, sql, args } = this
    if (sql.includes('FROM push_subscriptions WHERE account_id')) {
      const rows = [...db.subs.entries()]
        .filter(([, r]) => r.account_id === args[0])
        .map(([endpoint, r]) => ({ endpoint, ...r }))
      return Promise.resolve({ results: rows as T[], success: true, meta: {} })
    }
    return Promise.resolve({ results: [], success: true, meta: {} })
  }
}

async function makeVapidEnv(db: FakeDB): Promise<Env> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const publicRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', pair.publicKey),
  )
  return {
    DB: db,
    VAPID_PRIVATE_KEY: JSON.stringify(privateJwk),
    VAPID_PUBLIC_KEY: b64urlEncode(publicRaw),
    VAPID_SUBJECT: 'mailto:test@flipscorer.app',
  } as unknown as Env
}

/** A realistic subscription (ECDH public + 16-byte auth) so encryption runs. */
async function makeSubscription(endpoint: string) {
  const ua = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair
  const uaPublic = new Uint8Array(
    await crypto.subtle.exportKey('raw', ua.publicKey),
  )
  const auth = crypto.getRandomValues(new Uint8Array(16))
  return {
    endpoint,
    p256dh: b64urlEncode(uaPublic),
    auth: b64urlEncode(auth),
  }
}

async function seedSession(db: FakeDB, id: string, token: string) {
  db.accounts.set(id, { id, email: `${id}@x.io` })
  db.sessions.set(await sha256Hex(token), {
    account_id: id,
    expires_at: Number.MAX_SAFE_INTEGER,
  })
}

function req(path: string, token: string, method = 'GET', body?: unknown) {
  return new Request(`http://localhost:8787/api/push/${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const NOW = 1_700_000_000_000

describe('push handler', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reports the vapid key + enabled state', async () => {
    const db = new FakeDB()
    await seedSession(db, 'a', 'tok')
    const env = await makeVapidEnv(db)
    const res = await handlePush(req('vapid-key', 'tok'), env, NOW)
    const body = (await res.json()) as { key: string; enabled: boolean }
    expect(body.enabled).toBe(true)
    expect(body.key).toBe(env.VAPID_PUBLIC_KEY)
  })

  it('subscribes, then unsubscribes', async () => {
    const db = new FakeDB()
    await seedSession(db, 'a', 'tok')
    const env = await makeVapidEnv(db)
    const sub = await makeSubscription('https://push.example.com/e1')

    const bad = await handlePush(
      req('subscribe', 'tok', 'POST', { subscription: {} }),
      env,
      NOW,
    )
    expect(bad.status).toBe(400)

    await handlePush(
      req('subscribe', 'tok', 'POST', {
        subscription: {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        topics: { friends: true },
      }),
      env,
      NOW,
    )
    expect(db.subs.has(sub.endpoint)).toBe(true)

    await handlePush(
      req('unsubscribe', 'tok', 'POST', { endpoint: sub.endpoint }),
      env,
      NOW,
    )
    expect(db.subs.has(sub.endpoint)).toBe(false)
  })

  it('notify encrypts and POSTs to each subscription', async () => {
    const db = new FakeDB()
    const env = await makeVapidEnv(db)
    const sub = await makeSubscription('https://push.example.com/e2')
    db.subs.set(sub.endpoint, {
      account_id: 'a',
      p256dh: sub.p256dh,
      auth: sub.auth,
      topics: '{}',
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await notify(env, 'a', 'friends', { title: 'Hi', body: 'test' })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(sub.endpoint)
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Encoding']).toBe('aes128gcm')
    expect(headers.Authorization).toMatch(/^vapid t=/)
  })

  it('notify prunes a subscription the push service says is gone (410)', async () => {
    const db = new FakeDB()
    const env = await makeVapidEnv(db)
    const sub = await makeSubscription('https://push.example.com/e3')
    db.subs.set(sub.endpoint, {
      account_id: 'a',
      p256dh: sub.p256dh,
      auth: sub.auth,
      topics: '{}',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 410 })),
    )
    await notify(env, 'a', 'friends', { title: 'Hi', body: 'test' })
    expect(db.subs.has(sub.endpoint)).toBe(false)
  })

  it('notify skips a topic the subscription opted out of', async () => {
    const db = new FakeDB()
    const env = await makeVapidEnv(db)
    const sub = await makeSubscription('https://push.example.com/e4')
    db.subs.set(sub.endpoint, {
      account_id: 'a',
      p256dh: sub.p256dh,
      auth: sub.auth,
      topics: JSON.stringify({ friends: false }),
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await notify(env, 'a', 'friends', { title: 'Hi', body: 'test' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('notify is a no-op when VAPID keys are absent', async () => {
    const db = new FakeDB()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await notify({ DB: db } as unknown as Env, 'a', 'friends', {
      title: 'x',
      body: 'y',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
