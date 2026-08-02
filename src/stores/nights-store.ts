import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

import { createPlayer } from '@/domain/game'
import {
  NIGHTS_SCHEMA_VERSION,
  type GameNight,
  type Player,
} from '@/domain/types'
import { createId } from '@/lib/id'

/**
 * Game Nights: an evening of several games with a shared roster. Nights own the
 * occasion (name, venue, date, notes) and the roster; the games themselves live
 * in the games store and point back via `gameNightId`. Keeping the two stores
 * separate means Stats, Archive and backup keep treating games uniformly.
 */
interface NightsState {
  nights: GameNight[]
  hasHydrated: boolean

  createNight: (input: {
    name: string
    venue?: string
    date?: number
    notes?: string
    players?: Player[]
  }) => string
  updateNight: (
    id: string,
    patch: Partial<
      Pick<GameNight, 'name' | 'venue' | 'date' | 'notes' | 'players'>
    >,
  ) => void
  finishNight: (id: string) => void
  reopenNight: (id: string) => void
  deleteNight: (id: string) => void
  setHasHydrated: (value: boolean) => void
}

function touch(night: GameNight): GameNight {
  return { ...night, updatedAt: Date.now(), rev: night.rev + 1 }
}

/** Two seeded players so a new night can start editing its roster immediately. */
function seedRoster(): Player[] {
  return [createPlayer(0), createPlayer(1)]
}

export const useNightsStore = create<NightsState>()(
  persist(
    (set) => ({
      nights: [],
      hasHydrated: false,

      createNight: ({ name, venue, date, notes, players }) => {
        const now = Date.now()
        const night: GameNight = {
          id: createId(),
          name: name.trim() || 'Game Night',
          venue: venue?.trim() || undefined,
          date: date ?? now,
          notes: notes?.trim() || undefined,
          players: players?.length ? players : seedRoster(),
          createdAt: now,
          updatedAt: now,
          finishedAt: null,
          rev: 1,
          deletedAt: null,
        }
        set((s) => ({ nights: [...s.nights, night] }))
        return night.id
      },

      updateNight: (id, patch) =>
        set((s) => ({
          nights: s.nights.map((n) =>
            n.id === id
              ? touch({
                  ...n,
                  ...patch,
                  venue:
                    'venue' in patch
                      ? patch.venue?.trim() || undefined
                      : n.venue,
                  notes:
                    'notes' in patch
                      ? patch.notes?.trim() || undefined
                      : n.notes,
                })
              : n,
          ),
        })),

      finishNight: (id) =>
        set((s) => ({
          nights: s.nights.map((n) =>
            n.id === id
              ? touch({ ...n, finishedAt: n.finishedAt ?? Date.now() })
              : n,
          ),
        })),

      reopenNight: (id) =>
        set((s) => ({
          nights: s.nights.map((n) =>
            n.id === id ? touch({ ...n, finishedAt: null }) : n,
          ),
        })),

      deleteNight: (id) =>
        set((s) => ({
          nights: s.nights.map((n) =>
            n.id === id ? touch({ ...n, deletedAt: Date.now() }) : n,
          ),
        })),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'flipscore-nights',
      version: NIGHTS_SCHEMA_VERSION,
      partialize: (s) => ({ nights: s.nights }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
)

// ---- Selector hooks -------------------------------------------------------

export const useNightsHydrated = () => useNightsStore((s) => s.hasHydrated)

export const useNights = () =>
  useNightsStore(useShallow((s) => s.nights.filter((n) => !n.deletedAt)))

export const useNight = (id: string | null | undefined) =>
  useNightsStore((s) => {
    if (!id) return undefined
    const night = s.nights.find((n) => n.id === id)
    return night && !night.deletedAt ? night : undefined
  })
