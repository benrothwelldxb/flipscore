import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  advanceRound,
  createGame as makeGame,
  createPlayer as makePlayer,
  createRound,
  finishGame,
  recordScore,
  reorderPlayers as reorderPlayersTransform,
  startGame as startGameTransform,
} from '@/domain/game'
import { createId } from '@/lib/id'
import {
  PLAYER_LIMITS,
  type Game,
  type GameMode,
  type GameSettings,
  type Player,
} from '@/domain/types'

function touch(game: Game): Game {
  return { ...game, updatedAt: Date.now() }
}

interface GameState {
  games: Game[]
  activeGameId: string | null
  /** True once the persisted state has been read back from storage. */
  hasHydrated: boolean

  createGame: (mode: GameMode) => string
  deleteGame: (id: string) => void
  setActiveGame: (id: string | null) => void

  renameGame: (id: string, name: string) => void
  addPlayer: (id: string) => void
  removePlayer: (id: string, playerId: string) => void
  updatePlayer: (
    id: string,
    playerId: string,
    patch: Partial<Pick<Player, 'name' | 'color'>>,
  ) => void
  reorderPlayers: (id: string, orderedIds: string[]) => void
  updateSettings: (id: string, patch: Partial<GameSettings>) => void

  startGame: (id: string) => void
  submitScore: (id: string, playerId: string, value: number) => void
  nextRound: (id: string) => void
  endGame: (id: string) => void
  /** Start a fresh game with the same roster and settings. */
  rematch: (id: string) => string | null

  setHasHydrated: (value: boolean) => void
}

/** Apply a transform to the game with `id`, stamping updatedAt. */
function mapGame(games: Game[], id: string, fn: (game: Game) => Game): Game[] {
  return games.map((game) => (game.id === id ? touch(fn(game)) : game))
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      games: [],
      activeGameId: null,
      hasHydrated: false,

      createGame: (mode) => {
        const game = makeGame(mode, Date.now())
        set((s) => ({ games: [...s.games, game], activeGameId: game.id }))
        return game.id
      },

      deleteGame: (id) =>
        set((s) => ({
          games: s.games.filter((g) => g.id !== id),
          activeGameId: s.activeGameId === id ? null : s.activeGameId,
        })),

      setActiveGame: (id) => set({ activeGameId: id }),

      renameGame: (id, name) =>
        set((s) => ({ games: mapGame(s.games, id, (g) => ({ ...g, name })) })),

      addPlayer: (id) =>
        set((s) => ({
          games: mapGame(s.games, id, (g) =>
            g.players.length >= PLAYER_LIMITS.max
              ? g
              : { ...g, players: [...g.players, makePlayer(g.players.length)] },
          ),
        })),

      removePlayer: (id, playerId) =>
        set((s) => ({
          games: mapGame(s.games, id, (g) =>
            g.players.length <= PLAYER_LIMITS.min
              ? g
              : {
                  ...g,
                  players: g.players
                    .filter((p) => p.id !== playerId)
                    .map((p, index) => ({ ...p, order: index })),
                },
          ),
        })),

      updatePlayer: (id, playerId, patch) =>
        set((s) => ({
          games: mapGame(s.games, id, (g) => ({
            ...g,
            players: g.players.map((p) =>
              p.id === playerId ? { ...p, ...patch } : p,
            ),
          })),
        })),

      reorderPlayers: (id, orderedIds) =>
        set((s) => ({
          games: mapGame(s.games, id, (g) =>
            reorderPlayersTransform(g, orderedIds),
          ),
        })),

      updateSettings: (id, patch) =>
        set((s) => ({
          games: mapGame(s.games, id, (g) => ({
            ...g,
            settings: { ...g.settings, ...patch },
          })),
        })),

      startGame: (id) =>
        set((s) => ({
          games: mapGame(s.games, id, (g) =>
            g.players.length >= PLAYER_LIMITS.min ? startGameTransform(g) : g,
          ),
        })),

      submitScore: (id, playerId, value) =>
        set((s) => ({
          games: mapGame(s.games, id, (g) =>
            g.status === 'playing' ? recordScore(g, playerId, value) : g,
          ),
        })),

      nextRound: (id) =>
        set((s) => ({
          games: mapGame(s.games, id, (g) =>
            g.status === 'playing' ? advanceRound(g) : g,
          ),
        })),

      endGame: (id) =>
        set((s) => ({
          games: mapGame(s.games, id, (g) => finishGame(g)),
        })),

      rematch: (id) => {
        const source = get().games.find((g) => g.id === id)
        if (!source) return null
        const now = Date.now()
        const game: Game = {
          id: createId(),
          name: source.name,
          players: source.players.map((p) => ({ ...p, id: createId() })),
          rounds: [createRound(0)],
          settings: { ...source.settings },
          status: 'playing',
          currentRoundIndex: 0,
          winnerId: null,
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({ games: [...s.games, game], activeGameId: game.id }))
        return game.id
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'flipscore-games',
      version: 1,
      partialize: (s) => ({ games: s.games, activeGameId: s.activeGameId }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
)

// ---- Selector hooks -------------------------------------------------------

export const useGames = () => useGameStore((s) => s.games)
export const useHasHydrated = () => useGameStore((s) => s.hasHydrated)
export const useGame = (id: string | null | undefined) =>
  useGameStore((s) => (id ? s.games.find((g) => g.id === id) : undefined))
export const useActiveGame = () =>
  useGameStore((s) =>
    s.activeGameId ? s.games.find((g) => g.id === s.activeGameId) : undefined,
  )
