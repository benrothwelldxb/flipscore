import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

import { STICKERS, STICKERS_BY_ID } from '@/domain/stickers/catalog'
import { unlockedIds } from '@/domain/stickers/evaluate'
import type {
  AchievementMetrics,
  Sticker,
  StickerUnlock,
} from '@/domain/stickers/types'

/**
 * The permanent sticker collection. Unlocks are only ever *added* — never
 * revoked — so a sticker earned once stays earned even if the games that
 * earned it are later deleted. `acknowledged` tracks which unlocks the player
 * has already seen, so the album can flag freshly-earned stickers as NEW and
 * animate them exactly once.
 */
interface StickersState {
  /** id → unlock record. */
  unlocked: Record<string, StickerUnlock>
  /** Ids the player has already seen since unlocking (clears the NEW flag). */
  acknowledged: string[]
  hasHydrated: boolean

  /**
   * Grant any newly-earned stickers for the given metrics. Idempotent and
   * duplicate-safe: an already-unlocked sticker is left untouched (its original
   * unlock time is preserved). Returns the stickers unlocked by *this* call, in
   * catalog order, so the caller can celebrate them.
   */
  reconcile: (metrics: AchievementMetrics, now?: number) => Sticker[]
  /** Mark ids as seen (drops their NEW flag). */
  acknowledge: (ids: string[]) => void
  /** Mark every unlocked sticker as seen. */
  acknowledgeAll: () => void
  /** Wipe the collection (used by tests and a future "reset" affordance). */
  reset: () => void
  setHasHydrated: (value: boolean) => void
}

export const useStickersStore = create<StickersState>()(
  persist(
    (set, get) => ({
      unlocked: {},
      acknowledged: [],
      hasHydrated: false,

      reconcile: (metrics, now) => {
        const existing = get().unlocked
        const earned = unlockedIds(metrics).filter((id) => !existing[id])
        if (earned.length === 0) return []

        const at = now ?? Date.now()
        set((s) => {
          const unlocked = { ...s.unlocked }
          for (const id of earned) unlocked[id] = { id, unlockedAt: at }
          return { unlocked }
        })
        // Preserve catalog order for a tidy reveal.
        return STICKERS.filter((s) => earned.includes(s.id))
      },

      acknowledge: (ids) =>
        set((s) => {
          const seen = new Set(s.acknowledged)
          for (const id of ids) if (s.unlocked[id]) seen.add(id)
          return { acknowledged: [...seen] }
        }),

      acknowledgeAll: () =>
        set((s) => ({ acknowledged: Object.keys(s.unlocked) })),

      reset: () => set({ unlocked: {}, acknowledged: [] }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'flipscore-stickers',
      version: 1,
      partialize: (s) => ({
        unlocked: s.unlocked,
        acknowledged: s.acknowledged,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
)

// ---- Selector hooks -------------------------------------------------------

export const useStickersHydrated = () => useStickersStore((s) => s.hasHydrated)

/** Number of stickers unlocked, out of the whole catalog. */
export const useCollectionProgress = () =>
  useStickersStore(
    useShallow((s) => ({
      unlocked: Object.keys(s.unlocked).length,
      total: STICKERS.length,
    })),
  )

/** Set of ids unlocked but not yet acknowledged (the NEW ones). */
export const useNewStickerIds = () =>
  useStickersStore(
    useShallow((s) => {
      const seen = new Set(s.acknowledged)
      return Object.keys(s.unlocked).filter(
        (id) => !seen.has(id) && STICKERS_BY_ID.has(id),
      )
    }),
  )
