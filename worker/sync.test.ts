// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { sha256Hex } from './crypto'
import { handleSync } from './sync'
import type { Env } from './worker.d'

// In-memory D1 fake covering the statements the sync handler issues: an
// UPDATE … RETURNING seq reserve, per-item SELECT/UPSERT into `documents`, and
// the `seq > since` pull. Sessions/accounts are seeded so Bearer auth resolves.

interface DocRow {
  account_id: string
  collection: string
  item_id: string
  rev: number
  updated_at: number
  deleted_at: number | null
  data: string
  seq: number
}

class FakeDB {
  accounts = new Map<string, { id: string; email: string; sync_seq: number }>()
  sessions = new Map<string, { account_id: string; expires_at: number }>()
  docs: DocRow[] = []

  prepare(query: string): FakeStmt {
    return new FakeStmt(this, query.replace(/\s+/g, ' ').trim())
  }

  doc(account: string, collection: string, id: string): DocRow | undefined {
    return this.docs.find(
      (d) =>
        d.account_id === account &&
        d.collection === collection &&
        d.item_id === id,
    )
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
    if (sql.includes('SELECT sync_seq FROM accounts')) {
      const a = db.accounts.get(args[0] as string)
      return Promise.resolve(a ? ({ sync_seq: a.sync_seq } as T) : null)
    }
    if (sql.startsWith('UPDATE accounts SET sync_seq = sync_seq +')) {
      const a = db.accounts.get(args[0] as string)
      if (!a) return Promise.resolve(null)
      a.sync_seq += args[1] as number
      return Promise.resolve({ sync_seq: a.sync_seq } as T)
    }
    if (sql.includes('SELECT rev, updated_at AS updatedAt FROM documents')) {
      const d = db.doc(args[0] as string, args[1] as string, args[2] as string)
      return Promise.resolve(
        d ? ({ rev: d.rev, updatedAt: d.updated_at } as T) : null,
      )
    }
    return Promise.resolve(null)
  }

  run(): Promise<{ results: unknown[]; success: boolean; meta: unknown }> {
    const { db, sql, args } = this
    if (sql.includes('INSERT INTO documents')) {
      const [
        account_id,
        collection,
        item_id,
        rev,
        updated_at,
        deleted_at,
        data,
        seq,
      ] = args as [
        string,
        string,
        string,
        number,
        number,
        number | null,
        string,
        number,
      ]
      const existing = db.doc(account_id, collection, item_id)
      if (existing) {
        existing.rev = rev
        existing.updated_at = updated_at
        existing.deleted_at = deleted_at
        existing.data = data
        existing.seq = seq
      } else {
        db.docs.push({
          account_id,
          collection,
          item_id,
          rev,
          updated_at,
          deleted_at,
          data,
          seq,
        })
      }
    }
    return Promise.resolve({ results: [], success: true, meta: {} })
  }

  all<T = unknown>(): Promise<{
    results: T[]
    success: boolean
    meta: unknown
  }> {
    const { db, sql, args } = this
    if (sql.includes('FROM documents WHERE account_id = ?1 AND seq > ?2')) {
      const account = args[0] as string
      const since = args[1] as number
      const rows = db.docs
        .filter((d) => d.account_id === account && d.seq > since)
        .sort((a, b) => a.seq - b.seq)
        .map((d) => ({
          collection: d.collection,
          item_id: d.item_id,
          rev: d.rev,
          updated_at: d.updated_at,
          deleted_at: d.deleted_at,
          data: d.data,
          seq: d.seq,
        }))
      return Promise.resolve({ results: rows as T[], success: true, meta: {} })
    }
    return Promise.resolve({ results: [], success: true, meta: {} })
  }
}

function seedAccount(db: FakeDB, id: string, token: string): void {
  db.accounts.set(id, { id, email: `${id}@x.io`, sync_seq: 0 })
  db.sessions.set(token, {
    account_id: id,
    expires_at: Number.MAX_SAFE_INTEGER,
  })
}

function makeEnv(db: FakeDB): Env {
  return { DB: db, AUTH_SECRET: 'test' } as unknown as Env
}

function syncReq(token: string, body: unknown): Request {
  return new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

// accountForRequest looks sessions up by the SHA-256 of the Bearer token, so
// the fake is seeded with sha256Hex(token) as the session key.
const NOW = 1_700_000_000_000

describe('sync handler', () => {
  it('rejects unauthenticated requests', async () => {
    const db = new FakeDB()
    const res = await handleSync(
      new Request('http://localhost:8787/api/sync', {
        method: 'POST',
        body: JSON.stringify({ since: 0, changes: [] }),
      }),
      makeEnv(db),
      NOW,
    )
    expect(res.status).toBe(401)
  })

  it('pushes changes and pulls them back with a cursor', async () => {
    const db = new FakeDB()
    const token = 'tokA'
    seedAccount(db, 'acct_a', await sha256Hex(token))
    const env = makeEnv(db)

    const res = await handleSync(
      syncReq(token, {
        since: 0,
        changes: [
          {
            collection: 'games',
            id: 'g1',
            rev: 1,
            updatedAt: 100,
            deletedAt: null,
            data: { id: 'g1', name: 'One' },
          },
        ],
      }),
      env,
      NOW,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { cursor: number; changes: unknown[] }
    expect(body.cursor).toBe(1)
    expect(body.changes).toHaveLength(1)
    expect(db.docs).toHaveLength(1)
    expect(db.docs[0].seq).toBe(1)
  })

  it('a second device pulls the first device’s change', async () => {
    const db = new FakeDB()
    const token = 'tokA'
    seedAccount(db, 'acct_a', await sha256Hex(token))
    const env = makeEnv(db)

    await handleSync(
      syncReq(token, {
        since: 0,
        changes: [
          {
            collection: 'games',
            id: 'g1',
            rev: 1,
            updatedAt: 100,
            deletedAt: null,
            data: { id: 'g1' },
          },
        ],
      }),
      env,
      NOW,
    )
    // Fresh device: since 0, no local changes.
    const res = await handleSync(
      syncReq(token, { since: 0, changes: [] }),
      env,
      NOW,
    )
    const body = (await res.json()) as {
      cursor: number
      changes: { id: string }[]
    }
    expect(body.cursor).toBe(1)
    expect(body.changes.map((c) => c.id)).toEqual(['g1'])
  })

  it('applies last-write-wins by rev then updatedAt', async () => {
    const db = new FakeDB()
    const token = 'tokA'
    seedAccount(db, 'acct_a', await sha256Hex(token))
    const env = makeEnv(db)

    // Seed rev 2.
    await handleSync(
      syncReq(token, {
        since: 0,
        changes: [
          {
            collection: 'games',
            id: 'g1',
            rev: 2,
            updatedAt: 200,
            deletedAt: null,
            data: { v: 2 },
          },
        ],
      }),
      env,
      NOW,
    )
    // A stale rev-1 write must be rejected.
    await handleSync(
      syncReq(token, {
        since: 0,
        changes: [
          {
            collection: 'games',
            id: 'g1',
            rev: 1,
            updatedAt: 999,
            deletedAt: null,
            data: { v: 1 },
          },
        ],
      }),
      env,
      NOW,
    )
    expect(db.doc('acct_a', 'games', 'g1')?.rev).toBe(2)
    expect(JSON.parse(db.doc('acct_a', 'games', 'g1')!.data)).toEqual({ v: 2 })

    // A newer rev-3 write wins.
    await handleSync(
      syncReq(token, {
        since: 0,
        changes: [
          {
            collection: 'games',
            id: 'g1',
            rev: 3,
            updatedAt: 50,
            deletedAt: null,
            data: { v: 3 },
          },
        ],
      }),
      env,
      NOW,
    )
    expect(db.doc('acct_a', 'games', 'g1')?.rev).toBe(3)
  })

  it('propagates tombstones and ignores unknown collections', async () => {
    const db = new FakeDB()
    const token = 'tokA'
    seedAccount(db, 'acct_a', await sha256Hex(token))
    const env = makeEnv(db)

    const res = await handleSync(
      syncReq(token, {
        since: 0,
        changes: [
          {
            collection: 'nights',
            id: 'n1',
            rev: 2,
            updatedAt: 10,
            deletedAt: 123,
            data: { id: 'n1' },
          },
          {
            collection: 'not_a_collection',
            id: 'x',
            rev: 1,
            updatedAt: 1,
            deletedAt: null,
            data: {},
          },
        ],
      }),
      env,
      NOW,
    )
    const body = (await res.json()) as {
      changes: { deletedAt: number | null }[]
    }
    expect(body.changes).toHaveLength(1)
    expect(body.changes[0].deletedAt).toBe(123)
    expect(db.docs).toHaveLength(1)
  })

  it('keeps sequences monotonic so an incremental pull sees only new items', async () => {
    const db = new FakeDB()
    const token = 'tokA'
    seedAccount(db, 'acct_a', await sha256Hex(token))
    const env = makeEnv(db)

    const first = (await (
      await handleSync(
        syncReq(token, {
          since: 0,
          changes: [
            {
              collection: 'games',
              id: 'g1',
              rev: 1,
              updatedAt: 1,
              deletedAt: null,
              data: {},
            },
          ],
        }),
        env,
        NOW,
      )
    ).json()) as { cursor: number }

    const second = (await (
      await handleSync(
        syncReq(token, {
          since: first.cursor,
          changes: [
            {
              collection: 'games',
              id: 'g2',
              rev: 1,
              updatedAt: 2,
              deletedAt: null,
              data: {},
            },
          ],
        }),
        env,
        NOW,
      )
    ).json()) as { cursor: number; changes: { id: string }[] }

    expect(second.cursor).toBe(2)
    // Only the newly-written g2 comes back, not g1.
    expect(second.changes.map((c) => c.id)).toEqual(['g2'])
  })
})
