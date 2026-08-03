import type { Env } from './worker.d'

// A fixed-window rate limiter over the shared `rate_limits` table (migration
// 0004). Read-modify-write is intentionally approximate — for an abuse throttle
// "about N per window" is enough, and it stays testable with the fake D1.

// Global cleanup horizon: safely larger than every caller's window, so pruning
// one limiter's stale rows can never clip another limiter's still-live window.
const CLEANUP_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Whether an action keyed by `key` is allowed within `limit` per `windowMs`.
 * On refusal, `retryAfter` is the approximate seconds until the window resets.
 */
export async function fixedWindowAllow(
  env: Env,
  key: string,
  windowMs: number,
  limit: number,
  now: number,
): Promise<{ ok: boolean; retryAfter: number }> {
  // Opportunistic cleanup so the table can't grow without bound.
  await env.DB.prepare(`DELETE FROM rate_limits WHERE window_start < ?1`)
    .bind(now - CLEANUP_TTL_MS)
    .run()

  const row = await env.DB.prepare(
    `SELECT window_start, count FROM rate_limits WHERE key = ?1`,
  )
    .bind(key)
    .first<{ window_start: number; count: number }>()

  if (!row || now - row.window_start >= windowMs) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET window_start = ?2, count = 1`,
    )
      .bind(key, now)
      .run()
    return { ok: true, retryAfter: 0 }
  }

  if (row.count >= limit) {
    const retryAfter = Math.ceil((row.window_start + windowMs - now) / 1000)
    return { ok: false, retryAfter }
  }

  await env.DB.prepare(
    `UPDATE rate_limits SET count = count + 1 WHERE key = ?1`,
  )
    .bind(key)
    .run()
  return { ok: true, retryAfter: 0 }
}
