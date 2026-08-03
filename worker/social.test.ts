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

  prepare(query: string): FakeStmt {
    return new FakeStmt(this, query.replace(/\s+/g, ' ').trim())
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

  it('adds a friend by code, mutually', async () => {
    const db = new FakeDB()
    await seed(db, 'acct_a', 'tokA')
    await seed(db, 'acct_b', 'tokB')
    const env = makeEnv(db)

    // Both need identities; capture B's code.
    await handleSocial(req('identity', 'tokA'), env, NOW)
    const bId = (await (
      await handleSocial(req('identity', 'tokB'), env, NOW)
    ).json()) as { identity: { friendCode: string } }

    const add = await handleSocial(
      req('friends/add', 'tokA', 'POST', { code: bId.identity.friendCode }),
      env,
      NOW,
    )
    expect(add.status).toBe(200)

    // A lists B, and — mutually — B lists A.
    const aFriends = (await (
      await handleSocial(req('friends', 'tokA'), env, NOW)
    ).json()) as { friends: { accountId: string }[] }
    const bFriends = (await (
      await handleSocial(req('friends', 'tokB'), env, NOW)
    ).json()) as { friends: { accountId: string }[] }
    expect(aFriends.friends.map((f) => f.accountId)).toEqual(['acct_b'])
    expect(bFriends.friends.map((f) => f.accountId)).toEqual(['acct_a'])
  })

  it('rejects unknown and self codes, and removes friends', async () => {
    const db = new FakeDB()
    await seed(db, 'acct_a', 'tokA')
    await seed(db, 'acct_b', 'tokB')
    const env = makeEnv(db)
    const a = (await (
      await handleSocial(req('identity', 'tokA'), env, NOW)
    ).json()) as { identity: { friendCode: string } }
    const b = (await (
      await handleSocial(req('identity', 'tokB'), env, NOW)
    ).json()) as { identity: { friendCode: string } }

    const unknown = await handleSocial(
      req('friends/add', 'tokA', 'POST', { code: 'ZZZZZZZZ' }),
      env,
      NOW,
    )
    expect(unknown.status).toBe(404)

    const self = await handleSocial(
      req('friends/add', 'tokA', 'POST', { code: a.identity.friendCode }),
      env,
      NOW,
    )
    expect(self.status).toBe(400)

    // Add then remove.
    await handleSocial(
      req('friends/add', 'tokA', 'POST', { code: b.identity.friendCode }),
      env,
      NOW,
    )
    await handleSocial(
      req('friends/remove', 'tokA', 'POST', { friendId: 'acct_b' }),
      env,
      NOW,
    )
    const aFriends = (await (
      await handleSocial(req('friends', 'tokA'), env, NOW)
    ).json()) as { friends: unknown[] }
    const bFriends = (await (
      await handleSocial(req('friends', 'tokB'), env, NOW)
    ).json()) as { friends: unknown[] }
    expect(aFriends.friends).toHaveLength(0)
    expect(bFriends.friends).toHaveLength(0)
  })
})
