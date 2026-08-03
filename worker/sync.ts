import { accountForRequest } from './auth'
import type { Env } from './worker.d'

// Library sync: one POST /api/sync round-trip does push + pull.
//
//   Request:  { since: number, changes: SyncItem[] }
//   Response: { cursor: number, changes: SyncItem[] }
//
// The client sends its changed items and the highest server sequence it has
// seen (`since`). The server applies each change last-write-wins by
// (rev, updatedAt), stamps accepted writes with a fresh per-account sequence,
// then returns every item with seq > since so the client can merge back.

const COLLECTIONS = new Set([
  'games',
  'nights',
  'stickers',
  'profiles',
  'roster',
])

interface SyncItem {
  collection: string
  id: string
  rev: number
  updatedAt: number
  deletedAt: number | null
  data: unknown
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/** Validate/normalize one untrusted change into a SyncItem, or null if invalid. */
function parseItem(raw: unknown): SyncItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.collection !== 'string' || !COLLECTIONS.has(o.collection))
    return null
  if (typeof o.id !== 'string' || o.id.length === 0 || o.id.length > 256)
    return null
  if (typeof o.rev !== 'number' || !Number.isFinite(o.rev)) return null
  if (typeof o.updatedAt !== 'number' || !Number.isFinite(o.updatedAt))
    return null
  const deletedAt =
    o.deletedAt === null || o.deletedAt === undefined
      ? null
      : typeof o.deletedAt === 'number' && Number.isFinite(o.deletedAt)
        ? o.deletedAt
        : null
  if (o.data === undefined) return null
  return {
    collection: o.collection,
    id: o.id,
    rev: o.rev,
    updatedAt: o.updatedAt,
    deletedAt,
    data: o.data,
  }
}

/** Whether `a` should overwrite `b` under last-write-wins (rev, then updatedAt). */
function wins(
  a: { rev: number; updatedAt: number },
  b: {
    rev: number
    updatedAt: number
  },
): boolean {
  return a.rev > b.rev || (a.rev === b.rev && a.updatedAt > b.updatedAt)
}

/**
 * Reserve a contiguous block of `count` sequence numbers atomically and return
 * the highest reserved value. Using UPDATE … RETURNING means concurrent syncs
 * get disjoint blocks even without an explicit transaction.
 */
async function reserveSeq(
  env: Env,
  accountId: string,
  count: number,
): Promise<number> {
  if (count <= 0) {
    const row = await env.DB.prepare(
      `SELECT sync_seq FROM accounts WHERE id = ?1`,
    )
      .bind(accountId)
      .first<{ sync_seq: number }>()
    return row?.sync_seq ?? 0
  }
  const row = await env.DB.prepare(
    `UPDATE accounts SET sync_seq = sync_seq + ?2 WHERE id = ?1
     RETURNING sync_seq`,
  )
    .bind(accountId, count)
    .first<{ sync_seq: number }>()
  return row?.sync_seq ?? count
}

export async function handleSync(
  request: Request,
  env: Env,
  now: number = Date.now(),
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'not_found' }, 404)

  const account = await accountForRequest(request, env, now)
  if (!account) return json({ error: 'unauthorized' }, 401)

  let body: Record<string, unknown>
  try {
    const parsed = (await request.json()) as unknown
    body =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {}
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const since =
    typeof body.since === 'number' && Number.isFinite(body.since)
      ? body.since
      : 0
  const rawChanges = Array.isArray(body.changes) ? body.changes : []
  const changes = rawChanges
    .map(parseItem)
    .filter((c): c is SyncItem => c !== null)

  // Reserve enough sequence numbers up front, then assign as writes are accepted.
  const top = await reserveSeq(env, account.id, changes.length)
  let nextSeq = top - changes.length

  for (const change of changes) {
    const stored = await env.DB.prepare(
      `SELECT rev, updated_at AS updatedAt FROM documents
       WHERE account_id = ?1 AND collection = ?2 AND item_id = ?3`,
    )
      .bind(account.id, change.collection, change.id)
      .first<{ rev: number; updatedAt: number }>()

    if (stored && !wins(change, stored)) continue

    nextSeq += 1
    await env.DB.prepare(
      `INSERT INTO documents
         (account_id, collection, item_id, rev, updated_at, deleted_at, data, seq)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT(account_id, collection, item_id) DO UPDATE SET
         rev = ?4, updated_at = ?5, deleted_at = ?6, data = ?7, seq = ?8`,
    )
      .bind(
        account.id,
        change.collection,
        change.id,
        change.rev,
        change.updatedAt,
        change.deletedAt,
        JSON.stringify(change.data),
        nextSeq,
      )
      .run()
  }

  // Pull everything the client hasn't seen (includes echoes of its own accepted
  // writes, which merge idempotently on the client).
  const result = await env.DB.prepare(
    `SELECT collection, item_id, rev, updated_at, deleted_at, data, seq
     FROM documents
     WHERE account_id = ?1 AND seq > ?2
     ORDER BY seq`,
  )
    .bind(account.id, since)
    .all<{
      collection: string
      item_id: string
      rev: number
      updated_at: number
      deleted_at: number | null
      data: string
      seq: number
    }>()

  const outgoing: SyncItem[] = []
  let cursor = since
  for (const row of result.results) {
    cursor = Math.max(cursor, row.seq)
    try {
      outgoing.push({
        collection: row.collection,
        id: row.item_id,
        rev: row.rev,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
        data: JSON.parse(row.data),
      })
    } catch {
      // Skip a malformed row rather than failing the whole pull.
    }
  }
  cursor = Math.max(cursor, top)

  return json({ cursor, changes: outgoing })
}
