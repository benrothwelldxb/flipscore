import { handleAuth } from './auth'
import { SignalRoom } from './signal-room'
import type { Env } from './worker.d'

export { SignalRoom }

/**
 * The Worker entry point. WebSocket upgrades to `/rtc/<ROOMCODE>` are routed to
 * the Durable Object that owns that room; `/api/auth/*` is the Cloud Accounts
 * API (D1-backed); every other request is served from the static asset bundle
 * (the built SPA), so client-side routing keeps working via the assets
 * binding's single-page-application fallback.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/rtc/')) {
      const code = url.pathname.slice('/rtc/'.length).toUpperCase()
      if (!code) return new Response('missing room code', { status: 400 })
      const stub = env.SIGNAL_ROOM.get(env.SIGNAL_ROOM.idFromName(code))
      return stub.fetch(request)
    }
    if (url.pathname.startsWith('/api/auth/')) {
      return handleAuth(request, env)
    }
    return env.ASSETS.fetch(request)
  },
}
