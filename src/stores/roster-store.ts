import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

import { createId } from '@/lib/id'

/**
 * A small, persisted address book of players. Games remember the (real-named)
 * players they start with, so the next game can add them back with one tap
 * instead of retyping — which also keeps names consistent, and therefore keeps
 * per-player stats (aggregated by name) accurate across games.
 */
export interface SavedPlayer {
  id: string
  name: string
  color: string
}

interface RosterState {
  players: SavedPlayer[]
  /** Upsert players by normalised name (latest colour wins). */
  rememberMany: (players: { name: string; color: string }[]) => void
  forget: (id: string) => void
  clear: () => void
}

const ROSTER_SCHEMA_VERSION = 1

function normalize(name: string): string {
  return name.trim().toLowerCase()
}

/** Skip blank names and the seeded "Player N" placeholders. */
function isRememberable(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length > 0 && !/^player \d+$/i.test(trimmed)
}

export const useRosterStore = create<RosterState>()(
  persist(
    (set) => ({
      players: [],

      rememberMany: (incoming) =>
        set((s) => {
          const byName = new Map(s.players.map((p) => [normalize(p.name), p]))
          for (const { name, color } of incoming) {
            if (!isRememberable(name)) continue
            const key = normalize(name)
            const existing = byName.get(key)
            byName.set(key, {
              id: existing?.id ?? createId(),
              name: name.trim(),
              color,
            })
          }
          return { players: [...byName.values()] }
        }),

      forget: (id) =>
        set((s) => ({ players: s.players.filter((p) => p.id !== id) })),

      clear: () => set({ players: [] }),
    }),
    {
      name: 'flipscore-roster',
      version: ROSTER_SCHEMA_VERSION,
    },
  ),
)

export const useSavedPlayers = () =>
  useRosterStore(useShallow((s) => s.players))
