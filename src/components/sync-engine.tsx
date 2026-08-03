import { useEffect } from 'react'

import { useAccountStore } from '@/stores/account-store'
import { useGameStore } from '@/stores/game-store'
import { useNightsStore } from '@/stores/nights-store'
import { useProfileStore } from '@/stores/profile-store'
import { useRosterStore } from '@/stores/roster-store'
import { useStickersStore } from '@/stores/stickers-store'
import { isApplyingRemote, useSyncStore } from '@/stores/sync-store'

/** A trailing debounce with a cancel, so bursts of edits sync once. */
function debounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const run = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn()
    }, ms)
  }
  run.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  return run
}

const AUTOSYNC_DELAY = 1500

/**
 * Headless engine that keeps the local library in sync with the account. It
 * runs a sync on sign-in, on app focus / coming back online, and — debounced —
 * whenever a synced store changes. Rendered once, near the app root.
 */
export function SyncEngine() {
  useEffect(() => {
    const syncNow = () => {
      if (useAccountStore.getState().token) {
        void useSyncStore.getState().syncNow()
      }
    }
    const schedule = debounce(syncNow, AUTOSYNC_DELAY)
    // Ignore store writes made by applyRemote — they came from the server.
    const onLocalChange = () => {
      if (!isApplyingRemote()) schedule()
    }

    // Initial sync for an already-signed-in session.
    syncNow()

    // React to sign-in / sign-out.
    let prevToken = useAccountStore.getState().token
    const unsubToken = useAccountStore.subscribe((s) => {
      if (s.token === prevToken) return
      const wasSignedIn = prevToken !== null
      prevToken = s.token
      if (!s.token) {
        useSyncStore.getState().resetCursor()
      } else if (!wasSignedIn) {
        syncNow()
      }
    })

    // React to changes in each synced slice only.
    const unsubs = [
      useGameStore.subscribe((s, p) => {
        if (s.games !== p.games) onLocalChange()
      }),
      useNightsStore.subscribe((s, p) => {
        if (s.nights !== p.nights) onLocalChange()
      }),
      useStickersStore.subscribe((s, p) => {
        if (s.unlocked !== p.unlocked) onLocalChange()
      }),
      useProfileStore.subscribe((s, p) => {
        if (s.profiles !== p.profiles) onLocalChange()
      }),
      useRosterStore.subscribe((s, p) => {
        if (s.players !== p.players) onLocalChange()
      }),
    ]

    window.addEventListener('focus', syncNow)
    window.addEventListener('online', syncNow)

    return () => {
      schedule.cancel()
      unsubToken()
      for (const u of unsubs) u()
      window.removeEventListener('focus', syncNow)
      window.removeEventListener('online', syncNow)
    }
  }, [])

  return null
}
