// Client for the Web Push API (/api/push/*). Shares the account API's fetch
// wrapper (Bearer auth + typed AccountApiError codes).

import { apiRequest } from '@/net/account-api'

/** The server's VAPID public key (base64url) and whether push is configured. */
export interface VapidKeyResult {
  key: string | null
  enabled: boolean
}

/** The subset of a browser PushSubscription the server needs to send pushes. */
export interface PushSubscriptionJson {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export function getVapidKey(token: string): Promise<VapidKeyResult> {
  return apiRequest('/api/push/vapid-key', { token })
}

export function subscribePush(
  token: string,
  subscription: PushSubscriptionJson,
  topics: Record<string, boolean> = {},
): Promise<{ ok: true }> {
  return apiRequest('/api/push/subscribe', {
    method: 'POST',
    token,
    body: JSON.stringify({ subscription, topics }),
  })
}

export function unsubscribePush(
  token: string,
  endpoint: string,
): Promise<{ ok: true }> {
  return apiRequest('/api/push/unsubscribe', {
    method: 'POST',
    token,
    body: JSON.stringify({ endpoint }),
  })
}
