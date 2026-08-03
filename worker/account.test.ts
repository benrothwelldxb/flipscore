// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { handleAccount } from './account'
import { sha256Hex } from './crypto'
import type { Env } from './worker.d'

// In-memory D1 fake for the account handler: enough of accounts/sessions/
// identities/documents/friendships/email_codes to exercise export + delete.

interface DocRow {
  account_id: string
  collection: string
  item_id: string
  rev: number
  updated_at: number
  deleted_at: number | null
  data: string
}

class FakeDB {
  accounts = new Map<
    string,
    { id: string; email: string; created_at: number; last_seen_at: number }
  >()
  sessions = new Map<string, { account_id: string; expires_at: number }>()
  identities = new Map<
    string,
    { friend_code: string; display_name: string; stats: string }
  >()
  documents: DocRow[] = []
  friendships = new Set<string>() // `${a}|${b}`
  emailCodes = new Set<string>() // emails with a pending code

  prepare(query: string): FakeStmt {
    return new FakeStmt(this, query.replace(/\s+/g, ' ').trim())
  }

  async batch(statements: FakeStmt[]): Promise<unknown[]> {
    const out: unknown[] = []
    for (const s of statements) out.push(await s.run())
    return out
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
    if (sql.includes('SELECT id, email, created_at')) {
      const a = db.accounts.get(args[0] as string)
      return Promise.resolve(a ? (a as T) : null)
    }
    if (sql.includes('SELECT id, email FROM accounts WHERE id')) {
      const a = db.accounts.get(args[0] as string)
      return Promise.resolve(a ? ({ id: a.id, email: a.email } as T) : null)
    }
    if (sql.includes('friend_code, display_name, stats FROM identities')) {
      return Promise.resolve(
        (db.identities.get(args[0] as string) ?? null) as T,
      )
    }
    return Promise.resolve(null)
  }

  all<T = unknown>(): Promise<{
    results: T[]
    success: boolean
    meta: unknown
  }> {
    const { db, sql, args } = this
    if (sql.includes('FROM documents WHERE account_id')) {
      const rows = db.documents.filter((d) => d.account_id === args[0])
      return Promise.resolve({ results: rows as T[], success: true, meta: {} })
    }
    if (sql.includes('SELECT friend_id FROM friendships WHERE account_id')) {
      const me = args[0] as string
      const rows = [...db.friendships]
        .filter((k) => k.startsWith(`${me}|`))
        .map((k) => ({ friend_id: k.split('|')[1] }))
      return Promise.resolve({ results: rows as T[], success: true, meta: {} })
    }
    return Promise.resolve({ results: [], success: true, meta: {} })
  }

  run(): Promise<{ results: unknown[]; success: boolean; meta: unknown }> {
    const { db, sql, args } = this
    const id = args[0] as string
    if (
      sql.includes('DELETE FROM friendships WHERE account_id = ?1 OR friend_id')
    ) {
      for (const k of [...db.friendships]) {
        const [a, b] = k.split('|')
        if (a === id || b === id) db.friendships.delete(k)
      }
    } else if (sql.includes('DELETE FROM identities WHERE account_id')) {
      db.identities.delete(id)
    } else if (sql.includes('DELETE FROM documents WHERE account_id')) {
      db.documents = db.documents.filter((d) => d.account_id !== id)
    } else if (sql.includes('DELETE FROM sessions WHERE account_id')) {
      for (const [tok, s] of db.sessions) {
        if (s.account_id === id) db.sessions.delete(tok)
      }
    } else if (sql.includes('DELETE FROM email_codes WHERE email')) {
      db.emailCodes.delete(id) // args[0] is the email here
    } else if (sql.includes('DELETE FROM accounts WHERE id')) {
      db.accounts.delete(id)
    }
    return Promise.resolve({ results: [], success: true, meta: {} })
  }
}

function makeEnv(db: FakeDB): Env {
  return { DB: db } as unknown as Env
}

async function seedAccount(
  db: FakeDB,
  id: string,
  token: string,
): Promise<void> {
  const email = `${id}@x.io`
  db.accounts.set(id, { id, email, created_at: 1, last_seen_at: 2 })
  db.sessions.set(await sha256Hex(token), {
    account_id: id,
    expires_at: Number.MAX_SAFE_INTEGER,
  })
  db.identities.set(id, {
    friend_code: `CODE${id}`,
    display_name: id,
    stats: '{"gamesWon":3}',
  })
  db.documents.push({
    account_id: id,
    collection: 'games',
    item_id: `${id}-g1`,
    rev: 1,
    updated_at: 1,
    deleted_at: null,
    data: '{"id":"g1"}',
  })
  db.emailCodes.add(email)
}

function req(path: string, token: string, method = 'GET'): Request {
  return new Request(`http://localhost:8787/api/account/${path}`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  })
}

const NOW = 1_700_000_000_000

describe('account handler', () => {
  it('rejects unauthenticated requests', async () => {
    const db = new FakeDB()
    const res = await handleAccount(
      new Request('http://localhost:8787/api/account/export'),
      makeEnv(db),
      NOW,
    )
    expect(res.status).toBe(401)
  })

  it('exports the account, identity, documents and friends', async () => {
    const db = new FakeDB()
    await seedAccount(db, 'acct_a', 'tokA')
    await seedAccount(db, 'acct_b', 'tokB')
    db.friendships.add('acct_a|acct_b')

    const res = await handleAccount(req('export', 'tokA'), makeEnv(db), NOW)
    expect(res.headers.get('content-disposition')).toContain(
      'flipscorer-export',
    )
    const body = (await res.json()) as {
      account: { id: string }
      identity: { friendCode: string; stats: { gamesWon: number } }
      friends: string[]
      documents: { id: string }[]
    }
    expect(body.account.id).toBe('acct_a')
    expect(body.identity.friendCode).toBe('CODEacct_a')
    expect(body.identity.stats.gamesWon).toBe(3)
    expect(body.friends).toEqual(['acct_b'])
    expect(body.documents.map((d) => d.id)).toEqual(['acct_a-g1'])
  })

  it('deletes the account and everything tied to it, leaving others intact', async () => {
    const db = new FakeDB()
    await seedAccount(db, 'acct_a', 'tokA')
    await seedAccount(db, 'acct_b', 'tokB')
    db.friendships.add('acct_a|acct_b')
    db.friendships.add('acct_b|acct_a')

    const res = await handleAccount(
      req('delete', 'tokA', 'POST'),
      makeEnv(db),
      NOW,
    )
    expect(res.status).toBe(200)

    // acct_a is gone from every table…
    expect(db.accounts.has('acct_a')).toBe(false)
    expect(db.identities.has('acct_a')).toBe(false)
    expect(db.documents.some((d) => d.account_id === 'acct_a')).toBe(false)
    expect(
      [...db.sessions.values()].some((s) => s.account_id === 'acct_a'),
    ).toBe(false)
    expect(db.emailCodes.has('acct_a@x.io')).toBe(false)
    expect([...db.friendships]).toHaveLength(0) // both directions cleared

    // …but acct_b is untouched.
    expect(db.accounts.has('acct_b')).toBe(true)
    expect(db.identities.has('acct_b')).toBe(true)
    expect(db.documents.some((d) => d.account_id === 'acct_b')).toBe(true)
  })

  it('404s an unknown route', async () => {
    const db = new FakeDB()
    await seedAccount(db, 'acct_a', 'tokA')
    const res = await handleAccount(
      req('nope', 'tokA', 'POST'),
      makeEnv(db),
      NOW,
    )
    expect(res.status).toBe(404)
  })
})
