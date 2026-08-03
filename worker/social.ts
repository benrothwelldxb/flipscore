import { accountForRequest } from './auth'
import type { Env } from './worker.d'

// Friends & leaderboards. Routes under /api/social/* (all Bearer-authenticated):
//
//   GET  /api/social/identity                 -> { identity }   (created lazily)
//   POST /api/social/identity  { displayName?, stats? } -> { identity }
//   GET  /api/social/friends                  -> { friends: [] }
//   POST /api/social/friends/add     { code } -> { friend }
//   POST /api/social/friends/remove  { friendId } -> { ok: true }
//
// An account publishes only a small aggregate stats snapshot — never raw games —
// so the leaderboard can rank friends without anyone sharing their history.

// Friendly code alphabet: no 0/1/I/L/O/U to avoid misreads.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 8

interface Identity {
  accountId: string
  friendCode: string
  displayName: string
  stats: unknown
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

async function parseJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown
    return body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function randomFriendCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let code = ''
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return code
}

/** Normalize a typed-in code: uppercase, strip anything not in the alphabet. */
function normalizeCode(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('')
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

/** Fetch the account's identity, creating one (with a unique code) on first use. */
async function ensureIdentity(
  env: Env,
  account: { id: string; email: string },
  now: number,
): Promise<Identity> {
  const existing = await env.DB.prepare(
    `SELECT friend_code, display_name, stats FROM identities WHERE account_id = ?1`,
  )
    .bind(account.id)
    .first<{ friend_code: string; display_name: string; stats: string }>()
  if (existing) {
    return {
      accountId: account.id,
      friendCode: existing.friend_code,
      displayName: existing.display_name,
      stats: safeParse(existing.stats),
    }
  }

  const defaultName = account.email.split('@')[0] ?? ''
  // Generate a code, retrying the (very unlikely) unique collision a few times.
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomFriendCode()
    const clash = await env.DB.prepare(
      `SELECT 1 AS one FROM identities WHERE friend_code = ?1`,
    )
      .bind(code)
      .first<{ one: number }>()
    if (clash) continue
    await env.DB.prepare(
      `INSERT INTO identities (account_id, friend_code, display_name, stats, updated_at)
       VALUES (?1, ?2, ?3, '{}', ?4)`,
    )
      .bind(account.id, code, defaultName, now)
      .run()
    return {
      accountId: account.id,
      friendCode: code,
      displayName: defaultName,
      stats: {},
    }
  }
  throw new Error('could not allocate a friend code')
}

async function handleGetIdentity(
  env: Env,
  account: { id: string; email: string },
  now: number,
): Promise<Response> {
  const identity = await ensureIdentity(env, account, now)
  return json({ identity })
}

async function handleSaveIdentity(
  request: Request,
  env: Env,
  account: { id: string; email: string },
  now: number,
): Promise<Response> {
  const identity = await ensureIdentity(env, account, now)
  const body = await parseJson(request)

  const displayName =
    typeof body.displayName === 'string'
      ? body.displayName.trim().slice(0, 40)
      : identity.displayName
  const stats = body.stats !== undefined ? body.stats : identity.stats

  await env.DB.prepare(
    `UPDATE identities SET display_name = ?2, stats = ?3, updated_at = ?4
     WHERE account_id = ?1`,
  )
    .bind(account.id, displayName, JSON.stringify(stats ?? {}), now)
    .run()

  return json({
    identity: {
      accountId: account.id,
      friendCode: identity.friendCode,
      displayName,
      stats: stats ?? {},
    },
  })
}

async function handleGetFriends(
  env: Env,
  account: { id: string },
): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT friend_id FROM friendships WHERE account_id = ?1`,
  )
    .bind(account.id)
    .all<{ friend_id: string }>()

  const friends: { accountId: string; displayName: string; stats: unknown }[] =
    []
  for (const row of rows.results) {
    const identity = await env.DB.prepare(
      `SELECT display_name, stats FROM identities WHERE account_id = ?1`,
    )
      .bind(row.friend_id)
      .first<{ display_name: string; stats: string }>()
    friends.push({
      accountId: row.friend_id,
      displayName: identity?.display_name ?? '',
      stats: identity ? safeParse(identity.stats) : {},
    })
  }
  return json({ friends })
}

async function handleAddFriend(
  request: Request,
  env: Env,
  account: { id: string; email: string },
  now: number,
): Promise<Response> {
  // Ensure the caller has an identity (so they're addable back).
  await ensureIdentity(env, account, now)

  const code = normalizeCode((await parseJson(request)).code)
  if (code.length !== CODE_LENGTH) return json({ error: 'invalid_code' }, 400)

  const target = await env.DB.prepare(
    `SELECT account_id, display_name, stats FROM identities WHERE friend_code = ?1`,
  )
    .bind(code)
    .first<{ account_id: string; display_name: string; stats: string }>()
  if (!target) return json({ error: 'unknown_code' }, 404)
  if (target.account_id === account.id) return json({ error: 'self_code' }, 400)

  // Mutual: insert both directions, ignoring an existing friendship.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO friendships (account_id, friend_id, created_at)
     VALUES (?1, ?2, ?3)`,
  )
    .bind(account.id, target.account_id, now)
    .run()
  await env.DB.prepare(
    `INSERT OR IGNORE INTO friendships (account_id, friend_id, created_at)
     VALUES (?1, ?2, ?3)`,
  )
    .bind(target.account_id, account.id, now)
    .run()

  return json({
    friend: {
      accountId: target.account_id,
      displayName: target.display_name,
      stats: safeParse(target.stats),
    },
  })
}

async function handleRemoveFriend(
  request: Request,
  env: Env,
  account: { id: string },
): Promise<Response> {
  const friendId = (await parseJson(request)).friendId
  if (typeof friendId !== 'string' || !friendId)
    return json({ error: 'invalid_input' }, 400)

  await env.DB.prepare(
    `DELETE FROM friendships WHERE account_id = ?1 AND friend_id = ?2`,
  )
    .bind(account.id, friendId)
    .run()
  await env.DB.prepare(
    `DELETE FROM friendships WHERE account_id = ?1 AND friend_id = ?2`,
  )
    .bind(friendId, account.id)
    .run()

  return json({ ok: true })
}

export async function handleSocial(
  request: Request,
  env: Env,
  now: number = Date.now(),
): Promise<Response> {
  const account = await accountForRequest(request, env, now)
  if (!account) return json({ error: 'unauthorized' }, 401)

  const url = new URL(request.url)
  const route = url.pathname.slice('/api/social/'.length)
  const { method } = request

  if (route === 'identity' && method === 'GET')
    return handleGetIdentity(env, account, now)
  if (route === 'identity' && method === 'POST')
    return handleSaveIdentity(request, env, account, now)
  if (route === 'friends' && method === 'GET')
    return handleGetFriends(env, account)
  if (route === 'friends/add' && method === 'POST')
    return handleAddFriend(request, env, account, now)
  if (route === 'friends/remove' && method === 'POST')
    return handleRemoveFriend(request, env, account)

  return json({ error: 'not_found' }, 404)
}
