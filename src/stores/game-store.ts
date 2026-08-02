import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

import { exportPayload, parseImport } from '@/domain/backup'
import {
  advanceRound,
  createGame as makeGame,
  createPlayer as makePlayer,
  createRound,
  finishGame,
  recordScore,
  removeRound,
  reorderPlayers as reorderPlayersTransform,
  replayRound as replayRoundTransform,
  setRoundScore,
  startGame as startGameTransform,
} from '@/domain/game'
import { migrateGame } from '@/domain/migrate'
import { createId } from '@/lib/id'
import { useRosterStore } from '@/stores/roster-store'
import {
  GAMES_SCHEMA_VERSION,
  PLAYER_LIMITS,
  type Game,
  type GameMode,
  type GameSettings,
  type Player,
  type RoundFlags,
} from '@/domain/types'

/** Stamp updatedAt, bump the revision, and manage the finishedAt lifecycle. */
function touch(game: Game): Game {
  const now = Date.now()
  const finishedAt =
    game.status === 'finished' ? (game.finishedAt ?? now) : null
  return { ...game, updatedAt: now, rev: game.rev + 1, finishedAt }
}

export interface ImportResult {
  added: number
  updated: number
  skipped: number
  error?: string
}

const MAX_HISTORY = 30

interface GameState {
  games: Game[]
  activeGameId: string | null
  /** Per-game undo stacks (in-memory, not persisted). */
  history: Record<string, Game[]>
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
  /** Reset a connected game to an empty lobby (optionally seating the host). */
  beginConnectedLobby: (
    id: string,
    host: { name: string; color: string } | null,
  ) => string | null
  /** Add a named player (e.g. from the saved roster), respecting the max. */
  addNamedPlayer: (id: string, name: string, color: string) => void
  /** Add a player who has joined a connected lobby; returns the new player id. */
  addConnectedPlayer: (id: string, name: string, color: string) => string
  /** Remove a lobby player (no minimum-count guard, unlike removePlayer). */
  removeConnectedPlayer: (id: string, playerId: string) => void
  submitScore: (
    id: string,
    playerId: string,
    value: number,
    flags?: RoundFlags,
  ) => void
  nextRound: (id: string) => void
  endGame: (id: string) => void
  /** Edit a score in any round. */
  editScore: (
    id: string,
    roundIndex: number,
    playerId: string,
    value: number,
  ) => void
  deleteRound: (id: string, roundIndex: number) => void
  replayRound: (id: string, roundIndex: number) => void
  /** Revert the most recent tracked action for a game. */
  undo: (id: string) => void
  /** Replace a game with a specific snapshot (targeted undo). */
  replaceGame: (game: Game) => void
  /** Start a fresh game with the same roster and settings. */
  rematch: (id: string) => string | null
  /** Archive management. */
  toggleFavorite: (id: string) => void
  duplicateGame: (id: string) => string | null
  /** Export all live games as a portable JSON string. */
  exportGames: () => string
  /** Merge games from an import file (last-write-wins by rev/updatedAt). */
  importGames: (json: string) => ImportResult

  setHasHydrated: (value: boolean) => void
}

/** Apply a transform to the game with `id`, stamping updatedAt. */
function mapGame(games: Game[], id: string, fn: (game: Game) => Game): Game[] {
  return games.map((game) => (game.id === id ? touch(fn(game)) : game))
}

/** Snapshot the current game before a tracked mutation so it can be undone. */
function pushHistory(
  history: Record<string, Game[]>,
  games: Game[],
  id: string,
): Record<string, Game[]> {
  const current = games.find((g) => g.id === id)
  if (!current) return history
  return {
    ...history,
    [id]: [...(history[id] ?? []), current].slice(-MAX_HISTORY),
  }
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      games: [],
      activeGameId: null,
      history: {},
      hasHydrated: false,

      createGame: (mode) => {
        const game = makeGame(mode, Date.now())
        set((s) => ({ games: [...s.games, game], activeGameId: game.id }))
        return game.id
      },

      deleteGame: (id) =>
        set((s) => {
          const history = { ...s.history }
          delete history[id]
          // Soft-delete (tombstone) so a future sync backend can reconcile.
          return {
            games: s.games.map((g) =>
              g.id === id ? { ...g, deletedAt: Date.now(), rev: g.rev + 1 } : g,
            ),
            activeGameId: s.activeGameId === id ? null : s.activeGameId,
            history,
          }
        }),

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

      startGame: (id) => {
        const game = get().games.find((g) => g.id === id)
        set((s) => ({
          games: mapGame(s.games, id, (g) =>
            g.players.length >= PLAYER_LIMITS.min ? startGameTransform(g) : g,
          ),
        }))
        // Remember the roster so it can be reused next time (keeps names — and
        // therefore stats — consistent across games).
        if (game && game.players.length >= PLAYER_LIMITS.min) {
          useRosterStore.getState().rememberMany(game.players)
        }
      },

      addNamedPlayer: (id, name, color) =>
        set((s) => ({
          games: mapGame(s.games, id, (g) =>
            g.players.length >= PLAYER_LIMITS.max
              ? g
              : {
                  ...g,
                  players: [
                    ...g.players,
                    {
                      id: createId(),
                      name,
                      color,
                      order: g.players.length,
                    },
                  ],
                },
          ),
        })),

      beginConnectedLobby: (id, host) => {
        const hostId = host ? createId() : null
        set((s) => ({
          games: mapGame(s.games, id, (g) => ({
            ...g,
            players:
              host && hostId
                ? [{ id: hostId, name: host.name, color: host.color, order: 0 }]
                : [],
            rounds: [],
            status: 'setup',
            currentRoundIndex: 0,
            winnerId: null,
          })),
        }))
        return hostId
      },

      addConnectedPlayer: (id, name, color) => {
        const playerId = createId()
        set((s) => ({
          games: mapGame(s.games, id, (g) => ({
            ...g,
            players: [
              ...g.players,
              { id: playerId, name, color, order: g.players.length },
            ],
          })),
        }))
        return playerId
      },

      removeConnectedPlayer: (id, playerId) =>
        set((s) => ({
          games: mapGame(s.games, id, (g) => ({
            ...g,
            players: g.players
              .filter((p) => p.id !== playerId)
              .map((p, index) => ({ ...p, order: index })),
          })),
        })),

      submitScore: (id, playerId, value, flags) =>
        set((s) => ({
          history: pushHistory(s.history, s.games, id),
          games: mapGame(s.games, id, (g) =>
            g.status === 'playing' ? recordScore(g, playerId, value, flags) : g,
          ),
        })),

      nextRound: (id) =>
        set((s) => ({
          history: pushHistory(s.history, s.games, id),
          games: mapGame(s.games, id, (g) =>
            g.status === 'playing' ? advanceRound(g) : g,
          ),
        })),

      endGame: (id) =>
        set((s) => ({
          history: pushHistory(s.history, s.games, id),
          games: mapGame(s.games, id, (g) => finishGame(g)),
        })),

      editScore: (id, roundIndex, playerId, value) =>
        set((s) => ({
          history: pushHistory(s.history, s.games, id),
          games: mapGame(s.games, id, (g) =>
            setRoundScore(g, roundIndex, playerId, value),
          ),
        })),

      deleteRound: (id, roundIndex) =>
        set((s) => ({
          history: pushHistory(s.history, s.games, id),
          games: mapGame(s.games, id, (g) => removeRound(g, roundIndex)),
        })),

      replayRound: (id, roundIndex) =>
        set((s) => ({
          history: pushHistory(s.history, s.games, id),
          games: mapGame(s.games, id, (g) =>
            replayRoundTransform(g, roundIndex),
          ),
        })),

      undo: (id) =>
        set((s) => {
          const stack = s.history[id]
          if (!stack || stack.length === 0) return {}
          const previous = stack[stack.length - 1]
          return {
            games: s.games.map((g) => (g.id === id ? previous : g)),
            history: { ...s.history, [id]: stack.slice(0, -1) },
          }
        }),

      replaceGame: (game) =>
        set((s) => ({
          games: s.games.map((g) => (g.id === game.id ? game : g)),
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
          favorite: false,
          createdAt: now,
          updatedAt: now,
          finishedAt: null,
          rev: 1,
          deletedAt: null,
        }
        set((s) => ({ games: [...s.games, game], activeGameId: game.id }))
        return game.id
      },

      toggleFavorite: (id) =>
        set((s) => ({
          games: mapGame(s.games, id, (g) => ({ ...g, favorite: !g.favorite })),
        })),

      duplicateGame: (id) => {
        const source = get().games.find((g) => g.id === id)
        if (!source) return null
        const now = Date.now()
        const copy: Game = {
          ...structuredClone(source),
          id: createId(),
          name: source.name ? `${source.name} (copy)` : '',
          favorite: false,
          createdAt: now,
          updatedAt: now,
          rev: 1,
          deletedAt: null,
        }
        set((s) => ({ games: [...s.games, copy] }))
        return copy.id
      },

      exportGames: () => exportPayload(get().games.filter((g) => !g.deletedAt)),

      importGames: (json) => {
        const incoming = parseImport(json)
        if (!incoming) {
          return {
            added: 0,
            updated: 0,
            skipped: 0,
            error: 'Unrecognised file',
          }
        }
        let added = 0
        let updated = 0
        let skipped = 0
        set((s) => {
          const byId = new Map(s.games.map((g) => [g.id, g]))
          for (const game of incoming) {
            const existing = byId.get(game.id)
            if (!existing) {
              byId.set(game.id, game)
              added += 1
            } else if (
              game.rev > existing.rev ||
              game.updatedAt > existing.updatedAt
            ) {
              byId.set(game.id, game)
              updated += 1
            } else {
              skipped += 1
            }
          }
          return { games: [...byId.values()] }
        })
        return { added, updated, skipped }
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'flipscore-games',
      version: GAMES_SCHEMA_VERSION,
      partialize: (s) => ({ games: s.games, activeGameId: s.activeGameId }),
      migrate: (persisted) => {
        const state = (persisted ?? {}) as {
          games?: unknown[]
          activeGameId?: string | null
        }
        return {
          games: Array.isArray(state.games)
            ? state.games.map((g) => migrateGame(g))
            : [],
          activeGameId: state.activeGameId ?? null,
        }
      },
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
)

// ---- Selector hooks -------------------------------------------------------

export const useHasHydrated = () => useGameStore((s) => s.hasHydrated)

/** Raw games (including tombstones) — input for stats, which filter internally. */
export const useAllGames = () => useGameStore((s) => s.games)

export const useActiveGames = () =>
  useGameStore(
    useShallow((s) =>
      s.games.filter((g) => !g.deletedAt && g.status !== 'finished'),
    ),
  )

export const useFinishedGames = () =>
  useGameStore(
    useShallow((s) =>
      s.games.filter((g) => !g.deletedAt && g.status === 'finished'),
    ),
  )

export const useGame = (id: string | null | undefined) =>
  useGameStore((s) => {
    if (!id) return undefined
    const game = s.games.find((g) => g.id === id)
    return game && !game.deletedAt ? game : undefined
  })

export const useActiveGame = () =>
  useGameStore((s) => {
    if (!s.activeGameId) return undefined
    const game = s.games.find((g) => g.id === s.activeGameId)
    return game && !game.deletedAt ? game : undefined
  })

export const useCanUndo = (id: string | null | undefined) =>
  useGameStore((s) => (id ? (s.history[id]?.length ?? 0) > 0 : false))
