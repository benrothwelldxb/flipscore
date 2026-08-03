// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { sha256Hex } from './crypto'
import { handleSocial } from './social'
import type { Env } from './worker.d'

// In-memory D1 fake for the social handler: accounts/sessions for Bearer auth,
// an identities map, and a friendships set.

interface IdentityRow {
  friend_code: string
  display_name: string
  stats: string
}

class FakeDB {
  accounts = new Map<string, { id: string; email: string }>()
  sessions = new Map<string, { account_id: string; expires_at: number }>()
  identities = new Map<string, IdentityRow>() // by account_id
  friendships = new Set<string>() // `${a}|${b}`
  friendRequests = new Map<string, number>() // `${from}|${to}` -> created_at
  rateLimits = new Map<string, { window_start: number; count: number }>()

  prepare(query: string): FakeStmt {
    return new FakeStmt(this, query.replace(/\s+/g, ' ').trim())
  }

  async batch(statements: FakeStmt[]): Promise<unknown[]> {
    const out: unknown[] = []
    for (const s of statements) out.push(await s.run())
    return out
  }

  identityByCode(code: string): { accountId: string; row: IdentityRow } | null {
    for (const [accountId, row] of this.identities) {
      if (row.friend_code === code) return { accountId, row }
    }
    return null
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
    if (sql.includes('friend_code, display_name, stats FROM identities')) {
      const row = db.identities.get(args[0] as string)
      return Promise.resolve((row as T) ?? null)
    }
    if (sql.includes('1 AS one FROM identities WHERE friend_code')) {
      const hit = db.identityByCode(args[0] as string)
      return Promise.resolve(hit ? ({ one: 1 } as T) : null)
    }
    if (
      sql.includes(
        'account_id, display_name, stats FROM identities WHERE friend_code',
      )
    ) {
      const hit = db.identityByCode(args[0] as string)
      return Promise.resolve(
        hit
          ? ({
              account_id: hit.accountId,
              display_name: hit.row.display_name,
              stats: hit.row.stats,
            } as T)
          : null,
      )
    }
    if (
      sql.includes(
        'SELECT display_name, stats FROM identities WHERE account_id',
      )
    ) {
      const row = db.identities.get(args[0] as string)
      return Promise.resolve(
        row
          ? ({ display_name: row.display_name, stats: row.stats } as T)
          : null,
      )
    }
    if (sql.includes('1 AS one FROM friendships')) {
      const has = db.friendships.has(
        `${args[0] as string}|${args[1] as string}`,
      )
      return Promise.resolve(has ? ({ one: 1 } as T) : null)
    }
    if (sql.includes('1 AS one FROM friend_requests')) {
      const has = db.friendRequests.has(
        `${args[0] as string}|${args[1] as string}`,
      )
      return Promise.resolve(has ? ({ one: 1 } as T) : null)
    }
    if (sql.includes('SELECT window_start, count FROM rate_limits')) {
      return Promise.resolve(
        (db.rateLimits.get(args[0] as string) ?? null) as T,
      )
    }
    return Promise.resolve(null)
  }

  run(): Promise<{ results: unknown[]; success: boolean; meta: unknown }> {
    const { db, sql, args } = this
    if (sql.includes('INSERT INTO identities')) {
      db.identities.set(args[0] as string, {
        friend_code: args[1] as string,
        display_name: args[2] as string,
        stats: '{}',
      })
    } else if (sql.includes('UPDATE identities SET display_name')) {
      const row = db.identities.get(args[0] as string)
      if (row) {
        row.display_name = args[1] as string
        row.stats = args[2] as string
      }
    } else if (sql.includes('INSERT OR IGNORE INTO friendships')) {
      db.friendships.add(`${args[0] as string}|${args[1] as string}`)
    } else if (sql.includes('DELETE FROM friendships')) {
      db.friendships.delete(`${args[0] as string}|${args[1] as string}`)
    } else if (sql.includes('INSERT OR IGNORE INTO friend_requests')) {
      const key = `${args[0] as string}|${args[1] as string}`
      if (!db.friendRequests.has(key)) {
        db.friendRequests.set(key, args[2] as number)
      }
    } else if (sql.includes('DELETE FROM friend_requests WHERE created_at')) {
      const cutoff = args[0] as number
      for (const [key, created] of db.friendRequests) {
        if (created < cutoff) db.friendRequests.delete(key)
      }
    } else if (sql.includes('DELETE FROM friend_requests')) {
      db.friendRequests.delete(`${args[0] as string}|${args[1] as string}`)
    } else if (sql.includes('DELETE FROM rate_limits WHERE window_start')) {
      const cutoff = args[0] as number
      for (const [key, row] of db.rateLimits) {
        if (row.window_start < cutoff) db.rateLimits.delete(key)
      }
    } else if (sql.includes('INSERT INTO rate_limits')) {
      db.rateLimits.set(args[0] as string, {
        window_start: args[1] as number,
        count: 1,
      })
    } else if (sql.includes('UPDATE rate_limits SET count')) {
      const row = db.rateLimits.get(args[0] as string)
      if (row) row.count += 1
    }
    return Promise.resolve({ results: [], success: true, meta: {} })
  }

  all<T = unknown>(): Promise<{
    results: T[]
    success: boolean
    meta: unknown
  }> {
    const { db, sql, args } = this
    if (sql.includes('SELECT friend_id FROM friendships WHERE account_id')) {
      const me = args[0] as string
      const results = [...db.friendships]
        .filter((k) => k.startsWith(`${me}|`))
        .map((k) => ({ friend_id: k.split('|')[1] }))
      return Promise.resolve({
        results: results as T[],
        success: true,
        meta: {},
      })
    }
    if (
      sql.includes('SELECT from_account FROM friend_requests WHERE to_account')
    ) {
      const me = args[0] as string
      const results = [...db.friendRequests.keys()]
        .filter((k) => k.endsWith(`|${me}`))
        .map((k) => ({ from_account: k.split('|')[0] }))
      return Promise.resolve({
        results: results as T[],
        success: true,
        meta: {},
      })
    }
    if (
      sql.includes('SELECT to_account FROM friend_requests WHERE from_account')
    ) {
      const me = args[0] as string
      const results = [...db.friendRequests.keys()]
        .filter((k) => k.startsWith(`${me}|`))
        .map((k) => ({ to_account: k.split('|')[1] }))
      return Promise.resolve({
        results: results as T[],
        success: true,
        meta: {},
      })
    }
    return Promise.resolve({ results: [], success: true, meta: {} })
  }
}

async function seed(db: FakeDB, id: string, token: string): Promise<void> {
  db.accounts.set(id, { id, email: `${id}@x.io` })
  db.sessions.set(await sha256Hex(token), {
    account_id: id,
    expires_at: Number.MAX_SAFE_INTEGER,
  })
}

function makeEnv(db: FakeDB): Env {
  return { DB: db, AUTH_SECRET: 'test' } as unknown as Env
}

function req(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown,
): Request {
  return new Request(`http://localhost:8787/api/social/${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const NOW = 1_700_000_000_000

describe('social handler', () => {
  it('rejects unauthenticated requests', async () => {
    const db = new FakeDB()
    const res = await handleSocial(
      new Request('http://localhost:8787/api/social/identity', {
        method: 'GET',
      }),
      makeEnv(db),
      NOW,
    )
    expect(res.status).toBe(401)
  })

  it('creates an identity lazily with a friend code and default name', async () => {
    const db = new FakeDB()
    await seed(db, 'acct_a', 'tokA')
    const res = await handleSocial(req('identity', 'tokA'), makeEnv(db), NOW)
    const { identity } = (await res.json()) as {
      identity: { friendCode: string; displayName: string; stats: unknown }
    }
    expect(identity.friendCode).toMatch(/^[2-9A-Z]{8}$/)
    expect(identity.displayName).toBe('acct_a') // email local part
    expect(identity.stats).toEqual({})
    // A second GET returns the same code (not regenerated).
    const again = await handleSocial(req('identity', 'tokA'), makeEnv(db), NOW)
    const second = (await again.json()) as { identity: { friendCode: string } }
    expect(second.identity.friendCode).toBe(identity.friendCode)
  })

  it('saves a display name and stats snapshot', async () => {
    const db = new FakeDB()
    await seed(db, 'acct_a', 'tokA')
    const env = makeEnv(db)
    await handleSocial(req('identity', 'tokA'), env, NOW) // create
    const res = await handleSocial(
      req('identity', 'tokA', 'POST', {
        displayName: 'Ada',
        stats: { gamesWon: 5 },
      }),
      env,
      NOW,
    )
    const { identity } = (await res.json()) as {
      identity: { displayName: string; stats: { gamesWon: number } }
    }
    expect(identity.displayName).toBe('Ada')
    expect(identity.stats.gamesWon).toBe(5)
  })

  async function codeOf(env: Env, token: string): Promise<string> {
    const { identity } = (await (
      await handleSocial(req('identity', token), env, NOW)
    ).json()) as { identity: { friendCode: string } }
    return identity.friendCode
  }

  async function friendIds(env: Env, token: string): Promise<string[]> {
    const { friends } = (await (
      await handleSocial(req('friends', token), env, NOW)
    ).json()) as { friends: { accountId: string }[] }
    return friends.map((f) => f.accountId)
  }

  it('sends a request, then the recipient accepts to become friends', async () => {
    const db = new FakeDB()
    await seed(db, 'acct_a', 'tokA')
    await seed(db, 'acct_b', 'tokB')
    const env = makeEnv(db)
    const bCode = await codeOf(env, 'tokB')

    // A sends a request → pending, not yet friends.
    const add = await handleSocial(
      req('friends/add', 'tokA', 'POST', { code: bCode }),
      env,
      NOW,
    )
    expect(((await add.json()) as { status: string }).status).toBe('pending')
    expect(await friendIds(env, 'tokA')).toEqual([])

    // B sees the incoming request.
    const reqs = (await (
      await handleSocial(req('friends/requests', 'tokB'), env, NOW)
    ).json()) as { incoming: { accountId: string }[] }
    expect(reqs.incoming.map((r) => r.accountId)).toEqual(['acct_a'])

    // B accepts → both are friends.
    await handleSocial(
      req('friends/respond', 'tokB', 'POST', {
        fromAccountId: 'acct_a',
        action: 'accept',
      }),
      env,
      NOW,
    )
    expect(await friendIds(env, 'tokA')).toEqual(['acct_b'])
    expect(await friendIds(env, 'tokB')).toEqual(['acct_a'])
  })

  it('auto-accepts when both people request each other', async () => {
    const db = new FakeDB()
    await seed(db, 'acct_a', 'tokA')
    await seed(db, 'acct_b', 'tokB')
    const env = makeEnv(db)
    const aCode = await codeOf(env, 'tokA')
    const bCode = await codeOf(env, 'tokB')

    await handleSocial(
      req('friends/add', 'tokA', 'POST', { code: bCode }),
      env,
      NOW,
    )
    const add = await handleSocial(
      req('friends/add', 'tokB', 'POST', { code: aCode }),
      env,
      NOW,
    )
    expect(((await add.json()) as { status: string }).status).toBe('accepted')
    expect(await friendIds(env, 'tokA')).toEqual(['acct_b'])
    expect(await friendIds(env, 'tokB')).toEqual(['acct_a'])
  })

  it('rejecting a request leaves no friendship and clears it', async () => {
    const db = new FakeDB()
    await seed(db, 'acct_a', 'tokA')
    await seed(db, 'acct_b', 'tokB')
    const env = makeEnv(db)
    const bCode = await codeOf(env, 'tokB')

    await handleSocial(
      req('friends/add', 'tokA', 'POST', { code: bCode }),
      env,
      NOW,
    )
    await handleSocial(
      req('friends/respond', 'tokB', 'POST', {
        fromAccountId: 'acct_a',
        action: 'reject',
      }),
      env,
      NOW,
    )
    expect(await friendIds(env, 'tokA')).toEqual([])
    const reqs = (await (
      await handleSocial(req('friends/requests', 'tokB'), env, NOW)
    ).json()) as { incoming: unknown[] }
    expect(reqs.incoming).toHaveLength(0)
  })

  it('rejects unknown and self codes, and removes friends', async () => {
    const db = new FakeDB()
    await seed(db, 'acct_a', 'tokA')
    await seed(db, 'acct_b', 'tokB')
    const env = makeEnv(db)
    const aCode = await codeOf(env, 'tokA')
    const bCode = await codeOf(env, 'tokB')

    const unknown = await handleSocial(
      req('friends/add', 'tokA', 'POST', { code: 'ZZZZZZZZ' }),
      env,
      NOW,
    )
    expect(unknown.status).toBe(404)

    const self = await handleSocial(
      req('friends/add', 'tokA', 'POST', { code: aCode }),
      env,
      NOW,
    )
    expect(self.status).toBe(400)

    // Become friends (request + accept), then remove.
    await handleSocial(
      req('friends/add', 'tokA', 'POST', { code: bCode }),
      env,
      NOW,
    )
    await handleSocial(
      req('friends/respond', 'tokB', 'POST', {
        fromAccountId: 'acct_a',
        action: 'accept',
      }),
      env,
      NOW,
    )
    await handleSocial(
      req('friends/remove', 'tokA', 'POST', { friendId: 'acct_b' }),
      env,
      NOW,
    )
    expect(await friendIds(env, 'tokA')).toHaveLength(0)
    expect(await friendIds(env, 'tokB')).toHaveLength(0)
  })

  it('rate-limits friend-add attempts per account', async () => {
    const db = new FakeDB()
    await seed(db, 'acct_a', 'tokA')
    const env = makeEnv(db)
    await handleSocial(req('identity', 'tokA'), env, NOW)

    // 30 attempts allowed (all 404 unknown codes), the 31st is throttled.
    for (let i = 0; i < 30; i++) {
      const r = await handleSocial(
        req('friends/add', 'tokA', 'POST', { code: 'ZZZZZZZZ' }),
        env,
        NOW,
      )
      expect(r.status).toBe(404)
    }
    const blocked = await handleSocial(
      req('friends/add', 'tokA', 'POST', { code: 'ZZZZZZZZ' }),
      env,
      NOW,
    )
    expect(blocked.status).toBe(429)
  })

  it('the requests prune keeps fresh requests', async () => {
    const db = new FakeDB()
    await seed(db, 'acct_a', 'tokA')
    await seed(db, 'acct_b', 'tokB')
    const env = makeEnv(db)
    const bCode = await codeOf(env, 'tokB')
    await handleSocial(
      req('friends/add', 'tokA', 'POST', { code: bCode }),
      env,
      NOW,
    )
    // Polling requests runs the TTL prune; a request created at NOW survives.
    const reqs = (await (
      await handleSocial(req('friends/requests', 'tokB'), env, NOW)
    ).json()) as { incoming: unknown[] }
    expect(reqs.incoming).toHaveLength(1)
  })
})
