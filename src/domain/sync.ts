/**
 * Pure merge primitives for library sync. The server is the transport; the
 * actual conflict resolution is these last-write-wins helpers, run identically
 * on every device so they always converge on the same result.
 *
 * Serialization (store state → SyncItem[]) is trivial and lives with the stores
 * in {@link file://./../stores/sync-store.ts}; the interesting, well-tested part
 * — merging incoming items back in — lives here and knows nothing about stores.
 */

export type SyncCollection =
  'games' | 'nights' | 'stickers' | 'profiles' | 'roster'

/** The wire envelope for one synced item, uniform across collections. */
export interface SyncItem {
  collection: SyncCollection
  id: string
  rev: number
  updatedAt: number
  deletedAt: number | null
  /** The item payload (a Game, GameNight, sticker unlock, profile, …). */
  data: unknown
}

/** Records that carry their own version + tombstone (games, nights). */
export interface Revved {
  id: string
  rev: number
  updatedAt: number
  deletedAt: number | null
}

/** Whether `a` beats `b` under last-write-wins: higher rev, then later updatedAt. */
export function itemWins(
  a: { rev: number; updatedAt: number },
  b: { rev: number; updatedAt: number },
): boolean {
  return a.rev > b.rev || (a.rev === b.rev && a.updatedAt > b.updatedAt)
}

/**
 * Merge incoming items (whose `data` is a {@link Revved} record) into a local
 * list keyed by id, last-write-wins. Tombstones (deletedAt set) ride along as
 * ordinary records, so deletes propagate. Returns the same array reference when
 * nothing changed, so callers can skip a redundant write.
 */
export function mergeRevved<T extends Revved>(
  local: T[],
  items: SyncItem[],
): { records: T[]; changed: boolean } {
  const byId = new Map(local.map((r) => [r.id, r]))
  let changed = false
  for (const item of items) {
    const existing = byId.get(item.id)
    if (!existing || itemWins(item, existing)) {
      byId.set(item.id, item.data as T)
      changed = true
    }
  }
  return { records: changed ? [...byId.values()] : local, changed }
}

/**
 * Merge incoming items into a keyed record, last-write-wins by `updatedAt`
 * (used for cosmetic profiles and the saved-player roster, which have no rev).
 */
export function mergeRecordLWW<V extends { updatedAt?: number }>(
  local: Record<string, V>,
  items: SyncItem[],
): { record: Record<string, V>; changed: boolean } {
  const out = { ...local }
  let changed = false
  for (const item of items) {
    const existing = out[item.id]
    const existingAt = existing?.updatedAt ?? -Infinity
    if (!existing || item.updatedAt > existingAt) {
      out[item.id] = item.data as V
      changed = true
    }
  }
  return { record: changed ? out : local, changed }
}

/**
 * Merge sticker unlocks as an additive union, keeping the *earliest* unlock
 * time so "first earned" is stable across devices. Unlocks are never removed.
 */
export function mergeStickerUnion<V extends { unlockedAt: number }>(
  local: Record<string, V>,
  items: SyncItem[],
): { record: Record<string, V>; changed: boolean } {
  const out = { ...local }
  let changed = false
  for (const item of items) {
    const incoming = item.data as V
    const existing = out[item.id]
    if (!existing || incoming.unlockedAt < existing.unlockedAt) {
      out[item.id] = incoming
      changed = true
    }
  }
  return { record: changed ? out : local, changed }
}
