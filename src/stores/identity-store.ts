import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { resolveIdentityName } from '@/domain/social'
import { useAllGames } from '@/stores/game-store'

/**
 * Who "you" are on this device — the player whose achievements the Sticker Book
 * reflects, and the default identity for the friends leaderboard. Local and
 * offline-first: a name, not an account. When unset we fall back to the
 * most-played player, so stickers are personal out of the box.
 */
interface IdentityState {
  name: string | null
  setName: (name: string | null) => void
}

export const useIdentityStore = create<IdentityState>()(
  persist(
    (set) => ({
      name: null,
      setName: (name) => set({ name: name?.trim() || null }),
    }),
    { name: 'flipscore-identity', version: 1 },
  ),
)

/** The explicit choice, if any. */
export const useIdentityName = () => useIdentityStore((s) => s.name)

/** The resolved "you": the chosen player, else the most-played (or null). */
export function useMyName(): string | null {
  const explicit = useIdentityStore((s) => s.name)
  const games = useAllGames()
  return useMemo(() => resolveIdentityName(explicit, games), [explicit, games])
}
