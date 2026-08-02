export type GameMode = 'host' | 'pass' | 'connected'
export type GameStatus = 'setup' | 'playing' | 'finished'

export interface Player {
  id: string
  name: string
  /** A key into the player colour palette (see domain/colors). */
  color: string
  /** Display / turn order, 0-based. */
  order: number
}

/** Optional metadata captured when a score comes from the Card Builder. */
export interface RoundFlags {
  flip7?: boolean
  bust?: boolean
}

export interface Round {
  id: string
  /** 0-based round number. */
  index: number
  /** playerId → score for this round. Absent until the player has entered. */
  scores: Record<string, number>
  /** playerId → how the score was achieved (Flip 7 / bust), when known. */
  flags?: Record<string, RoundFlags>
}

export interface GameSettings {
  mode: GameMode
  /** Reaching this total finishes the game. */
  targetScore: number
}

export interface Game {
  id: string
  name: string
  players: Player[]
  rounds: Round[]
  settings: GameSettings
  status: GameStatus
  /** Index into `rounds` of the round currently being played. */
  currentRoundIndex: number
  winnerId: string | null
  favorite: boolean
  createdAt: number
  updatedAt: number
  /** Set when the game first reaches `finished`; cleared if reopened. */
  finishedAt: number | null
  /** Monotonic revision, bumped on every mutation (for last-write-wins sync). */
  rev: number
  /** Soft-delete tombstone timestamp (kept so a sync backend can reconcile). */
  deletedAt: number | null
}

/** Persisted schema version for the games store (see migrate in the store). */
export const GAMES_SCHEMA_VERSION = 2

export interface LeaderboardEntry {
  player: Player
  total: number
  /** 1-based rank; tied totals share a rank. */
  rank: number
  isLeader: boolean
  reachedTarget: boolean
}

export const PLAYER_LIMITS = { min: 2, max: 12 } as const
export const DEFAULT_TARGET_SCORE = 200
