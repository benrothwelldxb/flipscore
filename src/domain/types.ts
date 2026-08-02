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

export interface Round {
  id: string
  /** 0-based round number. */
  index: number
  /** playerId → score for this round. Absent until the player has entered. */
  scores: Record<string, number>
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
  createdAt: number
  updatedAt: number
}

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
