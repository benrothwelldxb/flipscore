import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { normalizeName } from '@/domain/analysis'
import {
  mergeRecordLWW,
  mergeRevved,
  mergeStickerUnion,
  type SyncItem,
} from '@/domain/sync'
import { AccountApiError, syncLibrary } from '@/net/account-api'
import { useAccountStore } from '@/stores/account-store'
import { useGameStore } from '@/stores/game-store'
import { useNightsStore } from '@/stores/nights-store'
import { useProfileStore } from '@/stores/profile-store'
import { useRosterStore, type SavedPlayer } from '@/stores/roster-store'
import { useStickersStore } from '@/stores/stickers-store'

// Library sync engine. One syncNow() round-trip pushes every local item and
// pulls everything the server has past our cursor, then merges it back
// last-write-wins (see domain/sync.ts). Triggering lives in the SyncEngine
// component; this store owns the cursor, the status, and the orchestration.

// Module-level guards (not React/persisted state) that serialise runs and break
// the apply→subscribe→resync loop:
//  - `syncing`  : a run is in flight; a concurrent request just asks for a rerun.
//  - `rerun`    : a change arrived mid-run; run once more when this one finishes.
//  - `applying` : we're writing pulled data into the stores right now, so the
//                 SyncEngine must ignore those store changes (they're not local).
let syncing = false
let rerun = false
let applying = false

/** True while remote changes are being merged into the stores. */
export function isApplyingRemote(): boolean {
  return applying
}

/** Snapshot every synced store as sync items. */
function collectLocal(): SyncItem[] {
  const items: SyncItem[] = []
  for (const g of useGameStore.getState().games) {
    items.push({
      collection: 'games',
      id: g.id,
      rev: g.rev,
      updatedAt: g.updatedAt,
      deletedAt: g.deletedAt,
      data: g,
    })
  }
  for (const n of useNightsStore.getState().nights) {
    items.push({
      collection: 'nights',
      id: n.id,
      rev: n.rev,
      updatedAt: n.updatedAt,
      deletedAt: n.deletedAt,
      data: n,
    })
  }
  for (const u of Object.values(useStickersStore.getState().unlocked)) {
    items.push({
      collection: 'stickers',
      id: u.id,
      rev: 1,
      updatedAt: u.unlockedAt,
      deletedAt: null,
      data: u,
    })
  }
  for (const [key, p] of Object.entries(useProfileStore.getState().profiles)) {
    items.push({
      collection: 'profiles',
      id: key,
      rev: 1,
      updatedAt: p.updatedAt ?? 0,
      deletedAt: null,
      data: p,
    })
  }
  for (const p of useRosterStore.getState().players) {
    items.push({
      collection: 'roster',
      id: normalizeName(p.name),
      rev: 1,
      updatedAt: p.updatedAt ?? 0,
      deletedAt: null,
      data: p,
    })
  }
  return items
}

/** Merge pulled items into every store, writing only what actually changed. */
function applyRemote(items: SyncItem[]): void {
  const games = items.filter((i) => i.collection === 'games')
  if (games.length) {
    const r = mergeRevved(useGameStore.getState().games, games)
    if (r.changed) useGameStore.setState({ games: r.records })
  }

  const nights = items.filter((i) => i.collection === 'nights')
  if (nights.length) {
    const r = mergeRevved(useNightsStore.getState().nights, nights)
    if (r.changed) useNightsStore.setState({ nights: r.records })
  }

  const stickers = items.filter((i) => i.collection === 'stickers')
  if (stickers.length) {
    const r = mergeStickerUnion(useStickersStore.getState().unlocked, stickers)
    if (r.changed) useStickersStore.setState({ unlocked: r.record })
  }

  const profiles = items.filter((i) => i.collection === 'profiles')
  if (profiles.length) {
    const r = mergeRecordLWW(useProfileStore.getState().profiles, profiles)
    if (r.changed) useProfileStore.setState({ profiles: r.record })
  }

  const roster = items.filter((i) => i.collection === 'roster')
  if (roster.length) {
    const record: Record<string, SavedPlayer> = {}
    for (const p of useRosterStore.getState().players) {
      record[normalizeName(p.name)] = p
    }
    const r = mergeRecordLWW(record, roster)
    if (r.changed) {
      useRosterStore.setState({ players: Object.values(r.record) })
    }
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'error'

interface SyncState {
  /** Highest server sequence this device has merged. */
  cursor: number
  status: SyncStatus
  lastSyncedAt: number | null
  /** Machine-readable error code from the last failed sync, if any. */
  error: string | null

  /** Push local changes and pull remote ones. No-op when signed out. */
  syncNow: () => Promise<void>
  /** Forget the server cursor (on sign-out) so the next sign-in pulls fully. */
  resetCursor: () => void
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      cursor: 0,
      status: 'idle',
      lastSyncedAt: null,
      error: null,

      async syncNow() {
        const token = useAccountStore.getState().token
        if (!token) return
        if (syncing) {
          rerun = true
          return
        }
        syncing = true
        set({ status: 'syncing', error: null })
        try {
          const res = await syncLibrary(token, get().cursor, collectLocal())
          applying = true
          try {
            applyRemote(res.changes)
          } finally {
            applying = false
          }
          set({
            cursor: res.cursor,
            status: 'idle',
            lastSyncedAt: Date.now(),
            error: null,
          })
        } catch (e) {
          if (e instanceof AccountApiError && e.code === 'unauthorized') {
            // Session revoked/expired — drop it and stop syncing.
            useAccountStore.setState({ user: null, token: null })
            set({ status: 'idle', error: null, cursor: 0 })
          } else {
            set({
              status: 'error',
              error: e instanceof AccountApiError ? e.code : 'error',
            })
          }
        } finally {
          syncing = false
          if (rerun) {
            rerun = false
            void get().syncNow()
          }
        }
      },

      resetCursor() {
        set({ cursor: 0, status: 'idle', error: null })
      },
    }),
    {
      name: 'flipscore-sync',
      version: 1,
      partialize: (s) => ({ cursor: s.cursor, lastSyncedAt: s.lastSyncedAt }),
    },
  ),
)

export const useSyncStatus = () => useSyncStore((s) => s.status)
export const useLastSyncedAt = () => useSyncStore((s) => s.lastSyncedAt)
