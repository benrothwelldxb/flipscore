/** Fire a short vibration where supported; a no-op everywhere else. */
export function vibrate(pattern: number | number[] = 10): void {
  if (typeof navigator === 'undefined') return
  if (typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* Some browsers throw if called outside a user gesture — ignore. */
  }
}
