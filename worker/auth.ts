import { createEmailSender } from './email'
import {
  randomCode,
  randomId,
  randomToken,
  sha256Hex,
  timingSafeEqual,
} from './crypto'
import type { Env } from './worker.d'

// Passwordless email one-time-code auth. Routes are mounted under /api/auth/*:
//
//   POST /api/auth/request-code  { email }          -> emails a 6-digit code
//   POST /api/auth/verify-code   { email, code }    -> { token, user }
//   GET  /api/auth/me            (Bearer token)     -> { user }
//   POST /api/auth/sign-out      (Bearer token)     -> { ok: true }
//
// Session tokens are opaque random strings; only their SHA-256 hash is stored,
// so the database never holds a replayable secret.

const CODE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000 // 90 days
const MAX_CODE_ATTEMPTS = 5

// Abuse throttling for request-code: a per-email cooldown (no new mailbox spam)
// and a per-IP fixed window (no bulk enumeration / Resend quota burn).
const CODE_COOLDOWN_MS = 60 * 1000 // 1 code per email per minute
const IP_WINDOW_MS = 15 * 60 * 1000 // 15-minute window
const IP_WINDOW_LIMIT = 10 // …max 10 codes requested per IP

/** Shape returned to the client for the signed-in identity. */
interface User {
  id: string
  email: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/** A 429 with both a machine-readable body and the standard Retry-After header. */
function rateLimited(error: string, retryAfter: number): Response {
  return new Response(JSON.stringify({ error, retryAfter }), {
    status: 429,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'retry-after': String(Math.max(0, retryAfter)),
    },
  })
}

/** Normalize an email for storage/lookup; returns null if it isn't valid. */
function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  // Deliberately permissive: one @, non-empty local part, a dotted domain.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  if (email.length > 254) return null
  return email
}

/** A 6-digit code as sent, or null if the input isn't well-formed. */
function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim()
  return /^\d{6}$/.test(code) ? code : null
}

/** Hash a code bound to its email and peppered with the server secret. */
function hashCode(email: string, code: string, env: Env): Promise<string> {
  return sha256Hex(`${email}:${code}:${env.AUTH_SECRET ?? ''}`)
}

/** Extract a Bearer token from the Authorization header, or null. */
function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1].trim() : null
}

/**
 * Whether the request is hitting a local/dev origin. Only then may the raw code
 * be echoed in the API response — a real deployment (custom domain or
 * *.workers.dev) never reveals codes, even if email delivery is misconfigured.
 */
function isLocalHost(url: URL): boolean {
  const h = url.hostname
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '[::1]' ||
    h === '::1' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local')
  )
}

/**
 * Fixed-window per-IP rate limit for a hashed key. Returns whether the request
 * is allowed and, if not, roughly how many seconds until the window resets.
 * Read-modify-write is intentionally approximate — for an abuse throttle
 * "about N per window" is enough, and it stays testable with the fake D1.
 */
async function checkIpRateLimit(
  env: Env,
  ip: string,
  now: number,
): Promise<{ ok: boolean; retryAfter: number }> {
  const key = `reqcode:${await sha256Hex(ip)}`
  // Opportunistic cleanup of long-expired rows so the table can't grow forever.
  await env.DB.prepare(`DELETE FROM rate_limits WHERE window_start < ?1`)
    .bind(now - IP_WINDOW_MS)
    .run()

  const row = await env.DB.prepare(
    `SELECT window_start, count FROM rate_limits WHERE key = ?1`,
  )
    .bind(key)
    .first<{ window_start: number; count: number }>()

  if (!row || now - row.window_start >= IP_WINDOW_MS) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET window_start = ?2, count = 1`,
    )
      .bind(key, now)
      .run()
    return { ok: true, retryAfter: 0 }
  }

  if (row.count >= IP_WINDOW_LIMIT) {
    const retryAfter = Math.ceil((row.window_start + IP_WINDOW_MS - now) / 1000)
    return { ok: false, retryAfter }
  }

  await env.DB.prepare(
    `UPDATE rate_limits SET count = count + 1 WHERE key = ?1`,
  )
    .bind(key)
    .run()
  return { ok: true, retryAfter: 0 }
}

/** The best-effort client IP for throttling (Cloudflare sets CF-Connecting-IP). */
function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
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

async function handleRequestCode(
  request: Request,
  env: Env,
  now: number,
): Promise<Response> {
  const body = await parseJson(request)
  const email = normalizeEmail(body.email)
  if (!email) return json({ error: 'invalid_email' }, 400)

  // Per-email cooldown BEFORE the per-IP window, so a legitimate user's impatient
  // resends of their own address don't burn (and lock out) their shared IP.
  const pending = await env.DB.prepare(
    `SELECT created_at FROM email_codes WHERE email = ?1`,
  )
    .bind(email)
    .first<{ created_at: number }>()
  if (pending && now - pending.created_at < CODE_COOLDOWN_MS) {
    const retryAfter = Math.ceil(
      (pending.created_at + CODE_COOLDOWN_MS - now) / 1000,
    )
    return rateLimited('cooldown', retryAfter)
  }

  // Per-IP fixed window — catches address-rotation / enumeration floods.
  const ipLimit = await checkIpRateLimit(env, clientIp(request), now)
  if (!ipLimit.ok) return rateLimited('rate_limited', ipLimit.retryAfter)

  const code = randomCode()
  const codeHash = await hashCode(email, code, env)
  const expiresAt = now + CODE_TTL_MS

  await env.DB.prepare(
    `INSERT INTO email_codes (email, code_hash, expires_at, attempts, created_at)
     VALUES (?1, ?2, ?3, 0, ?4)
     ON CONFLICT(email) DO UPDATE SET
       code_hash = ?2, expires_at = ?3, attempts = 0, created_at = ?4`,
  )
    .bind(email, codeHash, expiresAt, now)
    .run()

  const sender = createEmailSender(env)
  try {
    await sender.send(email, code)
  } catch (error) {
    console.error('[auth] email send failed', error)
    // Roll back the pending code so its cooldown doesn't block the user's retry.
    await env.DB.prepare(`DELETE FROM email_codes WHERE email = ?1`)
      .bind(email)
      .run()
    return json({ error: 'email_failed' }, 502)
  }

  // Echo the code back only on a local dev origin using the console adapter, so
  // the flow is testable end-to-end without a mailbox. Never in a deployment.
  const reveal = sender.mode === 'console' && isLocalHost(new URL(request.url))
  return json({
    ok: true,
    mode: sender.mode,
    ...(reveal ? { devCode: code } : {}),
  })
}

async function handleVerifyCode(
  request: Request,
  env: Env,
  now: number,
): Promise<Response> {
  const body = await parseJson(request)
  const email = normalizeEmail(body.email)
  const code = normalizeCode(body.code)
  if (!email || !code) return json({ error: 'invalid_input' }, 400)

  const row = await env.DB.prepare(
    `SELECT code_hash, expires_at, attempts FROM email_codes WHERE email = ?1`,
  )
    .bind(email)
    .first<{ code_hash: string; expires_at: number; attempts: number }>()

  if (!row) return json({ error: 'invalid_code' }, 400)

  if (row.expires_at < now) {
    await env.DB.prepare(`DELETE FROM email_codes WHERE email = ?1`)
      .bind(email)
      .run()
    return json({ error: 'code_expired' }, 400)
  }

  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    await env.DB.prepare(`DELETE FROM email_codes WHERE email = ?1`)
      .bind(email)
      .run()
    return json({ error: 'too_many_attempts' }, 429)
  }

  const candidate = await hashCode(email, code, env)
  if (!timingSafeEqual(candidate, row.code_hash)) {
    await env.DB.prepare(
      `UPDATE email_codes SET attempts = attempts + 1 WHERE email = ?1`,
    )
      .bind(email)
      .run()
    return json({ error: 'invalid_code' }, 400)
  }

  // Correct code — consume it, then upsert the account and open a session.
  await env.DB.prepare(`DELETE FROM email_codes WHERE email = ?1`)
    .bind(email)
    .run()

  await env.DB.prepare(
    `INSERT INTO accounts (id, email, created_at, last_seen_at)
     VALUES (?1, ?2, ?3, ?3)
     ON CONFLICT(email) DO UPDATE SET last_seen_at = ?3`,
  )
    .bind(randomId('acct'), email, now)
    .run()

  const account = await env.DB.prepare(
    `SELECT id, email FROM accounts WHERE email = ?1`,
  )
    .bind(email)
    .first<User>()
  if (!account) return json({ error: 'account_error' }, 500)

  const token = randomToken()
  const tokenHash = await sha256Hex(token)
  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, account_id, created_at, expires_at)
     VALUES (?1, ?2, ?3, ?4)`,
  )
    .bind(tokenHash, account.id, now, now + SESSION_TTL_MS)
    .run()

  return json({ token, user: { id: account.id, email: account.email } })
}

/** Resolve the account for a request's Bearer token, or null if unauthenticated. */
export async function accountForRequest(
  request: Request,
  env: Env,
  now: number,
): Promise<User | null> {
  const token = bearerToken(request)
  if (!token) return null
  const tokenHash = await sha256Hex(token)
  const session = await env.DB.prepare(
    `SELECT account_id, expires_at FROM sessions WHERE token_hash = ?1`,
  )
    .bind(tokenHash)
    .first<{ account_id: string; expires_at: number }>()
  if (!session) return null
  if (session.expires_at < now) {
    await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?1`)
      .bind(tokenHash)
      .run()
    return null
  }
  return env.DB.prepare(`SELECT id, email FROM accounts WHERE id = ?1`)
    .bind(session.account_id)
    .first<User>()
}

async function handleMe(
  request: Request,
  env: Env,
  now: number,
): Promise<Response> {
  const user = await accountForRequest(request, env, now)
  if (!user) return json({ error: 'unauthorized' }, 401)
  await env.DB.prepare(`UPDATE accounts SET last_seen_at = ?2 WHERE id = ?1`)
    .bind(user.id, now)
    .run()
  return json({ user })
}

async function handleSignOut(request: Request, env: Env): Promise<Response> {
  const token = bearerToken(request)
  if (token) {
    const tokenHash = await sha256Hex(token)
    await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?1`)
      .bind(tokenHash)
      .run()
  }
  return json({ ok: true })
}

/**
 * Route an /api/auth/* request. `now` is injected so tests are deterministic;
 * production passes Date.now().
 */
export async function handleAuth(
  request: Request,
  env: Env,
  now: number = Date.now(),
): Promise<Response> {
  const url = new URL(request.url)
  const route = url.pathname.slice('/api/auth/'.length)
  const { method } = request

  if (method === 'POST' && route === 'request-code') {
    return handleRequestCode(request, env, now)
  }
  if (method === 'POST' && route === 'verify-code') {
    return handleVerifyCode(request, env, now)
  }
  if (method === 'GET' && route === 'me') {
    return handleMe(request, env, now)
  }
  if (method === 'POST' && route === 'sign-out') {
    return handleSignOut(request, env)
  }
  return json({ error: 'not_found' }, 404)
}
