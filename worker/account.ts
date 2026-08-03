import { accountForRequest } from './auth'
import type { Env } from './worker.d'

// Account lifecycle: data export and account deletion. Both require a valid
// session (Bearer token) and act only on the caller's own account.
//
//   GET  /api/account/export  -> a JSON dump of everything we hold for you
//   POST /api/account/delete  -> erase the account and all associated rows

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })
}

interface DocRow {
  collection: string
  item_id: string
  rev: number
  updated_at: number
  deleted_at: number | null
  data: string
}

async function handleExport(
  env: Env,
  account: { id: string; email: string },
): Promise<Response> {
  const acct = await env.DB.prepare(
    `SELECT id, email, created_at, last_seen_at FROM accounts WHERE id = ?1`,
  )
    .bind(account.id)
    .first<{
      id: string
      email: string
      created_at: number
      last_seen_at: number
    }>()

  const identity = await env.DB.prepare(
    `SELECT friend_code, display_name, stats FROM identities WHERE account_id = ?1`,
  )
    .bind(account.id)
    .first<{ friend_code: string; display_name: string; stats: string }>()

  const docs = await env.DB.prepare(
    `SELECT collection, item_id, rev, updated_at, deleted_at, data
     FROM documents WHERE account_id = ?1 ORDER BY collection, item_id`,
  )
    .bind(account.id)
    .all<DocRow>()

  const friends = await env.DB.prepare(
    `SELECT friend_id FROM friendships WHERE account_id = ?1`,
  )
    .bind(account.id)
    .all<{ friend_id: string }>()

  const documents = docs.results.map((d) => {
    let data: unknown
    try {
      data = JSON.parse(d.data)
    } catch {
      data = null
    }
    return {
      collection: d.collection,
      id: d.item_id,
      rev: d.rev,
      updatedAt: d.updated_at,
      deletedAt: d.deleted_at,
      data,
    }
  })

  const body = {
    exportedAt: Date.now(),
    account: acct,
    identity: identity
      ? {
          friendCode: identity.friend_code,
          displayName: identity.display_name,
          stats: ((): unknown => {
            try {
              return JSON.parse(identity.stats)
            } catch {
              return {}
            }
          })(),
        }
      : null,
    friends: friends.results.map((f) => f.friend_id),
    documents,
  }

  return json(body, 200, {
    'content-disposition': 'attachment; filename="flipscorer-export.json"',
  })
}

async function handleDelete(
  env: Env,
  account: { id: string; email: string },
): Promise<Response> {
  // Explicit deletes — the schema has no cascading FKs on documents/friendships,
  // so every table this account touches is cleared. Run as one atomic batch so
  // a mid-sequence failure can't leave the account half-deleted.
  const statements = [
    env.DB.prepare(
      `DELETE FROM friendships WHERE account_id = ?1 OR friend_id = ?1`,
    ).bind(account.id),
    env.DB.prepare(
      `DELETE FROM friend_requests WHERE from_account = ?1 OR to_account = ?1`,
    ).bind(account.id),
    env.DB.prepare(`DELETE FROM identities WHERE account_id = ?1`).bind(
      account.id,
    ),
    env.DB.prepare(`DELETE FROM documents WHERE account_id = ?1`).bind(
      account.id,
    ),
    env.DB.prepare(`DELETE FROM sessions WHERE account_id = ?1`).bind(
      account.id,
    ),
    env.DB.prepare(`DELETE FROM email_codes WHERE email = ?1`).bind(
      account.email,
    ),
    env.DB.prepare(`DELETE FROM accounts WHERE id = ?1`).bind(account.id),
  ]
  try {
    await env.DB.batch(statements)
  } catch (error) {
    console.error('[account] delete failed', error)
    return json({ error: 'delete_failed' }, 500)
  }
  return json({ ok: true })
}

export async function handleAccount(
  request: Request,
  env: Env,
  now: number = Date.now(),
): Promise<Response> {
  const account = await accountForRequest(request, env, now)
  if (!account) return json({ error: 'unauthorized' }, 401)

  const url = new URL(request.url)
  const route = url.pathname.slice('/api/account/'.length)
  const { method } = request

  if (route === 'export' && method === 'GET') return handleExport(env, account)
  if (route === 'delete' && method === 'POST') return handleDelete(env, account)

  return json({ error: 'not_found' }, 404)
}
