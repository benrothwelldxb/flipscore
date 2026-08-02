import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { normalizeName } from '@/domain/analysis'
import type { LegacyProfile } from '@/domain/legacy'

/**
 * Per-player Legacy Card cosmetic selections — the *only* hand-edited card
 * state (everything else is derived). Keyed by normalised name so a player's
 * choices follow their identity across games, matching how Stats and History
 * aggregate. Deliberately small and forward-compatible: new cosmetic slots are
 * just new optional fields on {@link LegacyProfile}.
 */
const MAX_PINNED = 4
const EMPTY: LegacyProfile = {}

interface ProfileState {
  profiles: Record<string, LegacyProfile>
  hasHydrated: boolean

  setTitle: (name: string, titleId: string) => void
  setBackground: (name: string, backgroundId: string) => void
  /** Set (or, with undefined, clear back to the default) the accent colour. */
  setAccent: (name: string, accentColor: string | undefined) => void
  /** Pin/unpin a sticker; capped at four, silently ignores extra pins. */
  togglePin: (name: string, stickerId: string) => void
  setHasHydrated: (value: boolean) => void
}

function patch(
  state: ProfileState,
  name: string,
  update: (p: LegacyProfile) => LegacyProfile,
): Record<string, LegacyProfile> {
  const key = normalizeName(name)
  if (!key) return state.profiles
  return { ...state.profiles, [key]: update(state.profiles[key] ?? {}) }
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profiles: {},
      hasHydrated: false,

      setTitle: (name, titleId) =>
        set((s) => ({
          profiles: patch(s, name, (p) => ({ ...p, titleId })),
        })),

      setBackground: (name, backgroundId) =>
        set((s) => ({
          profiles: patch(s, name, (p) => ({ ...p, backgroundId })),
        })),

      setAccent: (name, accentColor) =>
        set((s) => ({
          profiles: patch(s, name, (p) => ({ ...p, accentColor })),
        })),

      togglePin: (name, stickerId) =>
        set((s) => ({
          profiles: patch(s, name, (p) => {
            const pinned = p.pinnedStickerIds ?? []
            if (pinned.includes(stickerId)) {
              return {
                ...p,
                pinnedStickerIds: pinned.filter((id) => id !== stickerId),
              }
            }
            if (pinned.length >= MAX_PINNED) return p
            return { ...p, pinnedStickerIds: [...pinned, stickerId] }
          }),
        })),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'flipscore-profiles',
      version: 1,
      partialize: (s) => ({ profiles: s.profiles }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
)

// ---- Selector hooks -------------------------------------------------------

export const useProfilesHydrated = () => useProfileStore((s) => s.hasHydrated)

/** The stored cosmetic selections for a player (empty object if none yet). */
export const useProfile = (name: string): LegacyProfile =>
  useProfileStore((s) => s.profiles[normalizeName(name)] ?? EMPTY)
