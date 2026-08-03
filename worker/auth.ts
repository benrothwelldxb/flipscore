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
