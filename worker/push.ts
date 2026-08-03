import { accountForRequest } from './auth'
import { pushConfigured, sendPush, type PushSubscription } from './webpush'
import type { Env } from './worker.d'

// Web Push subscription management + delivery. Routes under /api/push/* (all
// Bearer-authenticated):
//
//   GET  /api/push/vapid-key                 -> { key, enabled }
//   POST /api/push/subscribe  { subscription, topics? } -> { ok }
//   POST /api/push/unsubscribe { endpoint }  -> { ok }

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

/**
 * Deliver a notification to every subscription of `accountId` that hasn't opted
 * out of `topic`. Best-effort and never throws — safe to fire from ctx.waitUntil.
 * Prunes subscriptions the push service reports as gone (404/410).
 */
export async function notify(
  env: Env,
  accountId: string,
  topic: string,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  if (!pushConfigured(env)) return
  try {
    const rows = await env.DB.prepare(
      `SELECT endpoint, p256dh, auth, topics FROM push_subscriptions
       WHERE account_id = ?1`,
    )
      .bind(accountId)
      .all<{ endpoint: string; p256dh: string; auth: string; topics: string }>()

    for (const row of rows.results) {
      let topics: Record<string, boolean> = {}
      try {
        topics = JSON.parse(row.topics) as Record<string, boolean>
      } catch {
        topics = {}
      }
      if (topics[topic] === false) continue // topics default on

      // Isolate each send: fetch() rejects (not just 4xx) when a push host is
      // unreachable, and a throw here must not abandon the other subscriptions.
      try {
        const sub: PushSubscription = {
          endpoint: row.endpoint,
          p256dh: row.p256dh,
          auth: row.auth,
        }
        const result = await sendPush(env, sub, payload)
        if (result.expired) {
          await env.DB.prepare(
            `DELETE FROM push_subscriptions WHERE endpoint = ?1`,
          )
            .bind(row.endpoint)
            .run()
        }
      } catch (error) {
        console.error('[push] send failed', row.endpoint, error)
      }
    }
  } catch (error) {
    console.error('[push] notify failed', error)
  }
}

async function handleSubscribe(
  request: Request,
  env: Env,
  account: { id: string },
  now: number,
): Promise<Response> {
  const body = await parseJson(request)
  const subscription = body.subscription as
    | { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
    | undefined
  const endpoint = subscription?.endpoint
  const p256dh = subscription?.keys?.p256dh
  const auth = subscription?.keys?.auth
  if (
    typeof endpoint !== 'string' ||
    typeof p256dh !== 'string' ||
    typeof auth !== 'string'
  ) {
    return json({ error: 'invalid_subscription' }, 400)
  }
  const topics =
    body.topics && typeof body.topics === 'object' ? body.topics : {}

  await env.DB.prepare(
    `INSERT INTO push_subscriptions
       (endpoint, account_id, p256dh, auth, topics, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(endpoint) DO UPDATE SET
       account_id = ?2, p256dh = ?3, auth = ?4, topics = ?5`,
  )
    .bind(endpoint, account.id, p256dh, auth, JSON.stringify(topics), now)
    .run()

  return json({ ok: true })
}

async function handleUnsubscribe(
  request: Request,
  env: Env,
  account: { id: string },
): Promise<Response> {
  const endpoint = (await parseJson(request)).endpoint
  if (typeof endpoint !== 'string') return json({ error: 'invalid_input' }, 400)
  await env.DB.prepare(
    `DELETE FROM push_subscriptions WHERE endpoint = ?1 AND account_id = ?2`,
  )
    .bind(endpoint, account.id)
    .run()
  return json({ ok: true })
}

export async function handlePush(
  request: Request,
  env: Env,
  now: number = Date.now(),
): Promise<Response> {
  const account = await accountForRequest(request, env, now)
  if (!account) return json({ error: 'unauthorized' }, 401)

  const url = new URL(request.url)
  const route = url.pathname.slice('/api/push/'.length)
  const { method } = request

  if (route === 'vapid-key' && method === 'GET') {
    return json({
      key: env.VAPID_PUBLIC_KEY ?? null,
      enabled: pushConfigured(env),
    })
  }
  if (route === 'subscribe' && method === 'POST') {
    return handleSubscribe(request, env, account, now)
  }
  if (route === 'unsubscribe' && method === 'POST') {
    return handleUnsubscribe(request, env, account)
  }
  return json({ error: 'not_found' }, 404)
}
