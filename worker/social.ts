import { accountForRequest } from './auth'
import { notify } from './push'
import { fixedWindowAllow } from './ratelimit'
import type { Env, ExecutionContext } from './worker.d'

/** Fire a push in the background (survives the response) when ctx is present. */
function queuePush(
  ctx: ExecutionContext | undefined,
  env: Env,
  accountId: string,
  payload: { title: string; body: string; url?: string },
): void {
  const work = notify(env, accountId, 'friends', payload)
  if (ctx) ctx.waitUntil(work)
  else void work
}

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
const REQUEST_TTL_MS = 90 * 24 * 60 * 60 * 1000 // prune requests after 90 days
const ADD_WINDOW_MS = 60 * 60 * 1000 // per-account: at most…
const ADD_LIMIT = 30 // …30 friend-add attempts per hour

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

function rateLimited(retryAfter: number): Response {
  return new Response(JSON.stringify({ error: 'rate_limited', retryAfter }), {
    status: 429,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'retry-after': String(Math.max(0, retryAfter)),
    },
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

/**
 * Atomically befriend two accounts and clear any pending requests between them.
 * A single batch so a failure can't leave a destroyed request with no friendship.
 */
async function acceptRequestPair(
  env: Env,
  a: string,
  b: string,
  now: number,
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO friendships (account_id, friend_id, created_at)
       VALUES (?1, ?2, ?3)`,
    ).bind(a, b, now),
    env.DB.prepare(
      `INSERT OR IGNORE INTO friendships (account_id, friend_id, created_at)
       VALUES (?1, ?2, ?3)`,
    ).bind(b, a, now),
    env.DB.prepare(
      `DELETE FROM friend_requests WHERE from_account = ?1 AND to_account = ?2`,
    ).bind(a, b),
    env.DB.prepare(
      `DELETE FROM friend_requests WHERE from_account = ?1 AND to_account = ?2`,
    ).bind(b, a),
  ])
}

/** Delete any pending request rows between two accounts (either direction). */
async function clearRequests(env: Env, a: string, b: string): Promise<void> {
  await env.DB.prepare(
    `DELETE FROM friend_requests WHERE from_account = ?1 AND to_account = ?2`,
  )
    .bind(a, b)
    .run()
  await env.DB.prepare(
    `DELETE FROM friend_requests WHERE from_account = ?1 AND to_account = ?2`,
  )
    .bind(b, a)
    .run()
}

async function areFriends(env: Env, a: string, b: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS one FROM friendships WHERE account_id = ?1 AND friend_id = ?2`,
  )
    .bind(a, b)
    .first<{ one: number }>()
  return row !== null
}

/** { accountId, displayName, stats } for an account's public identity. */
async function friendPayload(
  env: Env,
  accountId: string,
): Promise<{ accountId: string; displayName: string; stats: unknown }> {
  const identity = await env.DB.prepare(
    `SELECT display_name, stats FROM identities WHERE account_id = ?1`,
  )
    .bind(accountId)
    .first<{ display_name: string; stats: string }>()
  return {
    accountId,
    displayName: identity?.display_name ?? '',
    stats: identity ? safeParse(identity.stats) : {},
  }
}

/** { accountId, displayName } only — for request lists (no stats needed). */
async function namePayload(
  env: Env,
  accountId: string,
): Promise<{ accountId: string; displayName: string }> {
  const identity = await env.DB.prepare(
    `SELECT display_name, stats FROM identities WHERE account_id = ?1`,
  )
    .bind(accountId)
    .first<{ display_name: string; stats: string }>()
  return { accountId, displayName: identity?.display_name ?? '' }
}

async function handleAddFriend(
  request: Request,
  env: Env,
  account: { id: string; email: string },
  now: number,
  ctx: ExecutionContext | undefined,
): Promise<Response> {
  // Per-account throttle: stops using this endpoint as a friend-code oracle
  // (200 vs 404) and caps request spam. Counts every attempt, valid or not.
  const limit = await fixedWindowAllow(
    env,
    `friendadd:${account.id}`,
    ADD_WINDOW_MS,
    ADD_LIMIT,
    now,
  )
  if (!limit.ok) return rateLimited(limit.retryAfter)

  // Ensure the caller has an identity (so they're addable back).
  const me = await ensureIdentity(env, account, now)
  const myName = me.displayName || 'A player'

  const code = normalizeCode((await parseJson(request)).code)
  if (code.length !== CODE_LENGTH) return json({ error: 'invalid_code' }, 400)

  const target = await env.DB.prepare(
    `SELECT account_id, display_name, stats FROM identities WHERE friend_code = ?1`,
  )
    .bind(code)
    .first<{ account_id: string; display_name: string; stats: string }>()
  if (!target) return json({ error: 'unknown_code' }, 404)
  if (target.account_id === account.id) return json({ error: 'self_code' }, 400)

  const friend = {
    accountId: target.account_id,
    displayName: target.display_name,
    stats: safeParse(target.stats),
  }

  // Already friends → idempotent no-op.
  if (await areFriends(env, account.id, target.account_id)) {
    return json({ status: 'friends', friend })
  }

  // A pending request the other way means they already asked us — auto-accept.
  const reverse = await env.DB.prepare(
    `SELECT 1 AS one FROM friend_requests WHERE from_account = ?1 AND to_account = ?2`,
  )
    .bind(target.account_id, account.id)
    .first<{ one: number }>()
  if (reverse) {
    await acceptRequestPair(env, account.id, target.account_id, now)
    queuePush(ctx, env, target.account_id, {
      title: 'FlipScorer',
      body: `${myName} accepted your friend request`,
      url: '/friends',
    })
    return json({ status: 'accepted', friend })
  }

  // Otherwise record a pending request for them to accept.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO friend_requests (from_account, to_account, created_at)
     VALUES (?1, ?2, ?3)`,
  )
    .bind(account.id, target.account_id, now)
    .run()
  queuePush(ctx, env, target.account_id, {
    title: 'FlipScorer',
    body: `${myName} sent you a friend request`,
    url: '/friends',
  })
  return json({
    status: 'pending',
    to: { accountId: target.account_id, displayName: target.display_name },
  })
}

async function handleRequests(
  env: Env,
  account: { id: string },
  now: number,
): Promise<Response> {
  // Opportunistic prune of stale requests (no scheduled job needed).
  await env.DB.prepare(`DELETE FROM friend_requests WHERE created_at < ?1`)
    .bind(now - REQUEST_TTL_MS)
    .run()

  const incomingRows = await env.DB.prepare(
    `SELECT from_account FROM friend_requests WHERE to_account = ?1`,
  )
    .bind(account.id)
    .all<{ from_account: string }>()
  const outgoingRows = await env.DB.prepare(
    `SELECT to_account FROM friend_requests WHERE from_account = ?1`,
  )
    .bind(account.id)
    .all<{ to_account: string }>()

  const incoming = []
  for (const row of incomingRows.results) {
    incoming.push(await namePayload(env, row.from_account))
  }
  const outgoing = []
  for (const row of outgoingRows.results) {
    outgoing.push(await namePayload(env, row.to_account))
  }
  return json({ incoming, outgoing })
}

async function handleRespond(
  request: Request,
  env: Env,
  account: { id: string; email: string },
  now: number,
  ctx: ExecutionContext | undefined,
): Promise<Response> {
  const body = await parseJson(request)
  const fromAccountId = body.fromAccountId
  const action = body.action
  if (typeof fromAccountId !== 'string' || !fromAccountId) {
    return json({ error: 'invalid_input' }, 400)
  }
  if (action !== 'accept' && action !== 'reject') {
    return json({ error: 'invalid_input' }, 400)
  }

  // The request must actually be addressed to the caller.
  const exists = await env.DB.prepare(
    `SELECT 1 AS one FROM friend_requests WHERE from_account = ?1 AND to_account = ?2`,
  )
    .bind(fromAccountId, account.id)
    .first<{ one: number }>()
  if (!exists) return json({ error: 'no_request' }, 404)

  if (action === 'reject') {
    await env.DB.prepare(
      `DELETE FROM friend_requests WHERE from_account = ?1 AND to_account = ?2`,
    )
      .bind(fromAccountId, account.id)
      .run()
    return json({ ok: true })
  }

  const me = await ensureIdentity(env, account, now)
  await acceptRequestPair(env, account.id, fromAccountId, now)
  queuePush(ctx, env, fromAccountId, {
    title: 'FlipScorer',
    body: `${me.displayName || 'A player'} accepted your friend request`,
    url: '/friends',
  })
  return json({ friend: await friendPayload(env, fromAccountId) })
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
  // Also drop any lingering pending request between the pair.
  await clearRequests(env, account.id, friendId)

  return json({ ok: true })
}

export async function handleSocial(
  request: Request,
  env: Env,
  now: number = Date.now(),
  ctx?: ExecutionContext,
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
  if (route === 'friends/requests' && method === 'GET')
    return handleRequests(env, account, now)
  if (route === 'friends/add' && method === 'POST')
    return handleAddFriend(request, env, account, now, ctx)
  if (route === 'friends/respond' && method === 'POST')
    return handleRespond(request, env, account, now, ctx)
  if (route === 'friends/remove' && method === 'POST')
    return handleRemoveFriend(request, env, account)

  return json({ error: 'not_found' }, 404)
}
