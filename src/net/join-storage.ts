/**
 * Persists a guest's join credentials per room so a reconnect — whether a
 * dropped socket or a full page reload — can reclaim the same seat with the
 * saved token instead of joining fresh.
 */
export interface SavedJoin {
  token: string
  name: string
  color?: string
}

const key = (room: string) => `flipscore-join-${room}`

export function loadJoin(room: string): SavedJoin | null {
  try {
    const raw = localStorage.getItem(key(room))
    if (!raw) return null
    const value = JSON.parse(raw)
    return typeof value?.token === 'string' && typeof value?.name === 'string'
      ? (value as SavedJoin)
      : null
  } catch {
    return null
  }
}

export function saveJoin(room: string, value: SavedJoin): void {
  try {
    localStorage.setItem(key(room), JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

export function clearJoin(room: string): void {
  try {
    localStorage.removeItem(key(room))
  } catch {
    /* storage unavailable */
  }
}
