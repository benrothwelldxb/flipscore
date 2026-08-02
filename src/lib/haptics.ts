import { usePrefsStore } from '@/stores/prefs-store'

/** Fire a short vibration where supported and enabled in preferences. */
export function vibrate(pattern: number | number[] = 10): void {
  if (!usePrefsStore.getState().hapticsEnabled) return
  if (typeof navigator === 'undefined') return
  if (typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* Some browsers throw if called outside a user gesture — ignore. */
  }
}
