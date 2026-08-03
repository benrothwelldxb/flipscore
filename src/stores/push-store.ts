import { create } from 'zustand'

import { AccountApiError } from '@/net/account-api'
import * as api from '@/net/push-api'
import { useAccountStore } from '@/stores/account-store'

// Web Push client state. Not persisted — the source of truth is the browser's
// PushManager (which survives reloads on its own) plus the server-side
// subscription row. On mount we reconcile both via `refresh`.

/** Decode a base64url VAPID key into the Uint8Array applicationServerKey wants. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

/** Feature-detect Web Push. False on browsers without SW/Push/Notification. */
function detectSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Pull the server-relevant fields out of a browser subscription, or null. */
function toJson(sub: PushSubscription): api.PushSubscriptionJson | null {
  const json = sub.toJSON() as {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  }
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return null
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  }
}

/**
 * Subscribe with the given VAPID key. A subscription left over from a different
 * applicationServerKey (e.g. a rotated VAPID key) makes subscribe() reject with
 * InvalidStateError — drop it and retry so enable() can never brick a browser.
 */
async function subscribeWithKey(
  reg: ServiceWorkerRegistration,
  key: string,
): Promise<PushSubscription> {
  const applicationServerKey = urlBase64ToUint8Array(key)
  try {
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })
  } catch (e) {
    const existing = await reg.pushManager.getSubscription()
    if (!existing) throw e
    await existing.unsubscribe().catch(() => {})
    return reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })
  }
}

type Permission = NotificationPermission | 'unsupported'

interface PushState {
  /** Whether this browser can do Web Push at all. */
  supported: boolean
  /** Current Notification permission ('default' | 'granted' | 'denied'). */
  permission: Permission
  /** Whether the server has VAPID keys configured (can actually send). */
  serverEnabled: boolean
  /** The server's VAPID public key, cached so enable() needs no pre-fetch. */
  vapidKey: string | null
  /** Whether an active push subscription exists (browser + server). */
  subscribed: boolean
  /** An action is in flight (enable/disable/refresh). */
  busy: boolean
  /** Last error, as a friendly message, or null. */
  error: string | null

  /** Reconcile local flags with the browser + (when signed in) the server. */
  refresh: () => Promise<void>
  /** Ask permission, subscribe in the browser, and register with the server. */
  enable: () => Promise<void>
  /** Unregister from the server and unsubscribe in the browser. */
  disable: () => Promise<void>
}

export const usePushStore = create<PushState>()((set, get) => ({
  supported: detectSupported(),
  permission: detectSupported()
    ? Notification.permission
    : ('unsupported' as Permission),
  serverEnabled: false,
  vapidKey: null,
  subscribed: false,
  busy: false,
  error: null,

  async refresh() {
    const supported = detectSupported()
    if (!supported) {
      set({ supported: false, permission: 'unsupported', subscribed: false })
      return
    }
    set({ supported: true, permission: Notification.permission })

    const token = useAccountStore.getState().token
    if (!token) {
      set({ serverEnabled: false, subscribed: false })
      return
    }
    try {
      const [{ key, enabled }, reg] = await Promise.all([
        api.getVapidKey(token),
        navigator.serviceWorker.ready,
      ])
      set({ serverEnabled: enabled, vapidKey: key })
      const sub = await reg.pushManager.getSubscription()
      if (sub && enabled) {
        // Repair/confirm the server row: an idempotent upsert that rebinds this
        // endpoint to the signed-in account. Fixes a toggle stuck ON after the
        // server row was pruned or the account deleted, and re-homes a leftover
        // subscription on a shared device to whoever is signed in now.
        const json = toJson(sub)
        if (json) await api.subscribePush(token, json).catch(() => {})
      }
      set({ subscribed: sub !== null })
    } catch {
      // Network blip or SW not ready — leave flags as-is, surface nothing.
    }
  },

  async enable() {
    const token = useAccountStore.getState().token
    if (!token) return
    set({ busy: true, error: null })
    try {
      // Permission FIRST, with no awaits before it — Safari revokes the click's
      // transient activation after a short window, so a pre-fetch here would
      // make requestPermission() reject with NotAllowedError.
      const permission = await Notification.requestPermission()
      set({ permission })
      if (permission !== 'granted') {
        set({
          error:
            permission === 'denied'
              ? 'Notifications are blocked. Enable them in browser settings.'
              : null,
        })
        return
      }

      // Prefer the key cached by refresh(); fetch only if we don't have it.
      let key = get().vapidKey
      let enabled = get().serverEnabled
      if (!key) {
        const res = await api.getVapidKey(token)
        key = res.key
        enabled = res.enabled
        set({ serverEnabled: enabled, vapidKey: key })
      }
      if (!enabled || !key) {
        set({ serverEnabled: false, error: 'Notifications are unavailable.' })
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await subscribeWithKey(reg, key)
      const json = toJson(sub)
      if (!json) {
        set({ error: 'Could not set up notifications. Try again.' })
        return
      }
      await api.subscribePush(token, json)
      set({ subscribed: true })
    } catch (e) {
      set({
        error:
          e instanceof AccountApiError
            ? 'Could not reach the server. Try again.'
            : 'Could not enable notifications. Try again.',
      })
    } finally {
      set({ busy: false })
    }
  },

  async disable() {
    if (!detectSupported()) {
      set({ subscribed: false })
      return
    }
    const token = useAccountStore.getState().token
    set({ busy: true, error: null })
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const { endpoint } = sub
        // Tell the server first; if it fails we still unsubscribe locally so the
        // toggle reflects reality (the row is pruned on the next failed send).
        if (token) await api.unsubscribePush(token, endpoint).catch(() => {})
        await sub.unsubscribe().catch(() => {})
      }
      set({ subscribed: false })
    } catch {
      set({ error: 'Could not turn off notifications. Try again.' })
    } finally {
      set({ busy: false })
    }
  },
}))

export const usePushSupported = () => usePushStore((s) => s.supported)
export const usePushSubscribed = () => usePushStore((s) => s.subscribed)
