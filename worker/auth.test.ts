// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { handleAuth } from './auth'
import type { Env } from './worker.d'

// A tiny in-memory stand-in for D1 that understands exactly the statements the
// auth handler issues. It matches on normalized SQL substrings and stores rows
// in Maps, so the whole request/verify/session flow can be exercised
// deterministically without wrangler or a real database.

interface CodeRow {
  code_hash: string
  expires_at: number
  attempts: number
  created_at: number
}
interface AccountRow {
  id: string
  email: string
  created_at: number
  last_seen_at: number
}
interface SessionRow {
  token_hash: string
  account_id: string
  created_at: number
  expires_at: number
}

class FakeDB {
  codes = new Map<string, CodeRow>()
  accounts = new Map<string, AccountRow>()
  sessions = new Map<string, SessionRow>()

  prepare(query: string): FakeStmt {
    return new FakeStmt(this, query.replace(/\s+/g, ' ').trim())
  }
  batch(): Promise<unknown[]> {
    return Promise.resolve([])
  }
  exec(): Promise<{ count: number; duration: number }> {
    return Promise.resolve({ count: 0, duration: 0 })
  }

  accountByEmail(email: string): AccountRow | null {
    for (const a of this.accounts.values()) if (a.email === email) return a
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
    if (
      sql.includes('SELECT code_hash, expires_at, attempts FROM email_codes')
    ) {
      return Promise.resolve(
        (db.codes.get(args[0] as string) ?? null) as T | null,
      )
    }
    if (sql.includes('FROM accounts WHERE email')) {
      const a = db.accountByEmail(args[0] as string)
      return Promise.resolve(a ? ({ id: a.id, email: a.email } as T) : null)
    }
    if (sql.includes('FROM accounts WHERE id')) {
      const a = db.accounts.get(args[0] as string)
      return Promise.resolve(a ? ({ id: a.id, email: a.email } as T) : null)
    }
    if (sql.includes('SELECT account_id, expires_at FROM sessions')) {
      const s = db.sessions.get(args[0] as string)
      return Promise.resolve(
        s
          ? ({ account_id: s.account_id, expires_at: s.expires_at } as T)
          : null,
      )
    }
    return Promise.resolve(null)
  }

  run(): Promise<{ results: unknown[]; success: boolean; meta: unknown }> {
    const { db, sql, args } = this
    if (sql.includes('INSERT INTO email_codes')) {
      db.codes.set(args[0] as string, {
        code_hash: args[1] as string,
        expires_at: args[2] as number,
        attempts: 0,
        created_at: args[3] as number,
      })
    } else if (sql.includes('DELETE FROM email_codes')) {
      db.codes.delete(args[0] as string)
    } else if (sql.includes('UPDATE email_codes SET attempts')) {
      const row = db.codes.get(args[0] as string)
      if (row) row.attempts += 1
    } else if (sql.includes('INSERT INTO accounts')) {
      const [id, email, now] = args as [string, string, number]
      const existing = db.accountByEmail(email)
      if (existing) existing.last_seen_at = now
      else
        db.accounts.set(id, {
          id,
          email,
          created_at: now,
          last_seen_at: now,
        })
    } else if (sql.includes('UPDATE accounts SET last_seen_at')) {
      const [id, now] = args as [string, number]
      const a = db.accounts.get(id)
      if (a) a.last_seen_at = now
    } else if (sql.includes('INSERT INTO sessions')) {
      const [token_hash, account_id, created_at, expires_at] = args as [
        string,
        string,
        number,
        number,
      ]
      db.sessions.set(token_hash, {
        token_hash,
        account_id,
        created_at,
        expires_at,
      })
    } else if (sql.includes('DELETE FROM sessions')) {
      db.sessions.delete(args[0] as string)
    }
    return Promise.resolve({ results: [], success: true, meta: {} })
  }

  all(): Promise<{ results: unknown[]; success: boolean; meta: unknown }> {
    return Promise.resolve({ results: [], success: true, meta: {} })
  }
}

function makeEnv(db: FakeDB): Env {
  return { DB: db, AUTH_SECRET: 'test-secret' } as unknown as Env
}

interface ReqOpts {
  method?: string
  body?: unknown
  token?: string
}
function req(path: string, opts: ReqOpts = {}): Request {
  // A local origin so the console adapter echoes devCode back (see auth.ts).
  return new Request(`http://localhost:8787${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.body ? { 'content-type': 'application/json' } : {}),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
}

const NOW = 1_700_000_000_000

describe('auth handler', () => {
  it('runs the full sign-in lifecycle: request → verify → me → sign-out', async () => {
    const db = new FakeDB()
    const env = makeEnv(db)

    // Request a code — mixed-case/whitespace email is normalized for storage.
    const r1 = await handleAuth(
      req('/api/auth/request-code', {
        method: 'POST',
        body: { email: '  Ada@Example.COM ' },
      }),
      env,
      NOW,
    )
    expect(r1.status).toBe(200)
    const b1 = (await r1.json()) as { mode: string; devCode?: string }
    expect(b1.mode).toBe('console')
    expect(b1.devCode).toMatch(/^\d{6}$/)
    expect(db.codes.has('ada@example.com')).toBe(true)

    // Verify the code — an account is created and a session token returned.
    const r2 = await handleAuth(
      req('/api/auth/verify-code', {
        method: 'POST',
        body: { email: 'ada@example.com', code: b1.devCode },
      }),
      env,
      NOW,
    )
    expect(r2.status).toBe(200)
    const b2 = (await r2.json()) as {
      token: string
      user: { id: string; email: string }
    }
    expect(b2.token).toBeTruthy()
    expect(b2.user.email).toBe('ada@example.com')
    expect(db.codes.size).toBe(0) // consumed
    expect(db.sessions.size).toBe(1)

    // The token authenticates /me.
    const r3 = await handleAuth(
      req('/api/auth/me', { token: b2.token }),
      env,
      NOW,
    )
    expect(r3.status).toBe(200)
    expect(((await r3.json()) as { user: { email: string } }).user.email).toBe(
      'ada@example.com',
    )

    // Sign out revokes the session; the token no longer works.
    const r4 = await handleAuth(
      req('/api/auth/sign-out', { method: 'POST', token: b2.token }),
      env,
      NOW,
    )
    expect(r4.status).toBe(200)
    expect(db.sessions.size).toBe(0)

    const r5 = await handleAuth(
      req('/api/auth/me', { token: b2.token }),
      env,
      NOW,
    )
    expect(r5.status).toBe(401)
  })

  it('signing in again reuses the same account id', async () => {
    const db = new FakeDB()
    const env = makeEnv(db)
    async function signIn(): Promise<string> {
      const rc = (await (
        await handleAuth(
          req('/api/auth/request-code', {
            method: 'POST',
            body: { email: 'bo@x.io' },
          }),
          env,
          NOW,
        )
      ).json()) as { devCode: string }
      const rv = (await (
        await handleAuth(
          req('/api/auth/verify-code', {
            method: 'POST',
            body: { email: 'bo@x.io', code: rc.devCode },
          }),
          env,
          NOW,
        )
      ).json()) as { user: { id: string } }
      return rv.user.id
    }
    const first = await signIn()
    const second = await signIn()
    expect(second).toBe(first)
    expect(db.accounts.size).toBe(1)
  })

  it('rejects a wrong code, then accepts the correct one', async () => {
    const db = new FakeDB()
    const env = makeEnv(db)
    const rc = (await (
      await handleAuth(
        req('/api/auth/request-code', {
          method: 'POST',
          body: { email: 'cy@x.io' },
        }),
        env,
        NOW,
      )
    ).json()) as { devCode: string }
    const wrong = rc.devCode === '000000' ? '111111' : '000000'

    const bad = await handleAuth(
      req('/api/auth/verify-code', {
        method: 'POST',
        body: { email: 'cy@x.io', code: wrong },
      }),
      env,
      NOW,
    )
    expect(bad.status).toBe(400)
    expect(((await bad.json()) as { error: string }).error).toBe('invalid_code')
    expect(db.codes.get('cy@x.io')?.attempts).toBe(1)

    const good = await handleAuth(
      req('/api/auth/verify-code', {
        method: 'POST',
        body: { email: 'cy@x.io', code: rc.devCode },
      }),
      env,
      NOW,
    )
    expect(good.status).toBe(200)
  })

  it('locks the code after too many attempts', async () => {
    const db = new FakeDB()
    const env = makeEnv(db)
    const rc = (await (
      await handleAuth(
        req('/api/auth/request-code', {
          method: 'POST',
          body: { email: 'di@x.io' },
        }),
        env,
        NOW,
      )
    ).json()) as { devCode: string }
    const wrong = rc.devCode === '000000' ? '111111' : '000000'

    for (let i = 0; i < 5; i++) {
      await handleAuth(
        req('/api/auth/verify-code', {
          method: 'POST',
          body: { email: 'di@x.io', code: wrong },
        }),
        env,
        NOW,
      )
    }
    // Sixth attempt is locked out, and the code is discarded.
    const locked = await handleAuth(
      req('/api/auth/verify-code', {
        method: 'POST',
        body: { email: 'di@x.io', code: wrong },
      }),
      env,
      NOW,
    )
    expect(locked.status).toBe(429)
    expect(db.codes.size).toBe(0)

    // Even the correct code no longer works once the code is gone.
    const after = await handleAuth(
      req('/api/auth/verify-code', {
        method: 'POST',
        body: { email: 'di@x.io', code: rc.devCode },
      }),
      env,
      NOW,
    )
    expect(after.status).toBe(400)
  })

  it('rejects an expired code', async () => {
    const db = new FakeDB()
    const env = makeEnv(db)
    const rc = (await (
      await handleAuth(
        req('/api/auth/request-code', {
          method: 'POST',
          body: { email: 'ed@x.io' },
        }),
        env,
        NOW,
      )
    ).json()) as { devCode: string }

    const later = NOW + 11 * 60 * 1000 // 11 minutes later
    const res = await handleAuth(
      req('/api/auth/verify-code', {
        method: 'POST',
        body: { email: 'ed@x.io', code: rc.devCode },
      }),
      env,
      later,
    )
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('code_expired')
    expect(db.codes.size).toBe(0)
  })

  it('never reveals the code on a non-local (production) origin', async () => {
    const db = new FakeDB()
    const env = makeEnv(db)
    const res = await handleAuth(
      new Request('https://flipscorer.app/api/auth/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'fi@x.io' }),
      }),
      env,
      NOW,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { mode: string; devCode?: string }
    expect(body.mode).toBe('console')
    expect(body.devCode).toBeUndefined()
    // The code was still generated and stored — just not disclosed.
    expect(db.codes.has('fi@x.io')).toBe(true)
  })

  it('validates input and unknown routes', async () => {
    const db = new FakeDB()
    const env = makeEnv(db)

    const badEmail = await handleAuth(
      req('/api/auth/request-code', {
        method: 'POST',
        body: { email: 'not-an-email' },
      }),
      env,
      NOW,
    )
    expect(badEmail.status).toBe(400)

    const noToken = await handleAuth(req('/api/auth/me'), env, NOW)
    expect(noToken.status).toBe(401)

    const unknown = await handleAuth(
      req('/api/auth/nope', { method: 'POST' }),
      env,
      NOW,
    )
    expect(unknown.status).toBe(404)
  })
})
