export type GameMode = 'host' | 'pass' | 'connected'
export type GameStatus = 'setup' | 'playing' | 'finished'

/**
 * A tiny, deterministic description of a player's avatar. It is just numbers +
 * hex colours, so it serialises to JSON and synchronises over Connected mode
 * inside the player record — no images are ever transferred. Indices are
 * validated/clamped against the avatar palettes at render time.
 */
export interface AvatarConfig {
  skinTone: number
  faceShape: number
  hairStyle: number
  hairColour: string
  eyes: number
  eyebrows: number
  mouth: number
  glasses: number
  facialHair: number
  accessory: number
  shirtColour: string
  backgroundColour: string
}

export interface Player {
  id: string
  name: string
  /** A key into the player colour palette (see domain/colors). */
  color: string
  /** Display / turn order, 0-based. */
  order: number
  /** Generated SVG avatar config (optional for backward compatibility). */
  avatar?: AvatarConfig
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
  /** The Game Night this game belongs to, if any (see domain/game-night). */
  gameNightId?: string | null
}

/**
 * A Game Night: an evening of several games played by a shared roster. Games
 * link back via {@link Game.gameNightId}; the night owns the roster (with stable
 * player ids reused across its games) plus the occasion's metadata. Awards and
 * the summary are derived from the night's finished games (see game-night.ts).
 */
export interface GameNight {
  id: string
  /** e.g. "Friday Night", "Christmas", "Pub Night". */
  name: string
  venue?: string
  /** The night's date (epoch ms). */
  date: number
  notes?: string
  /** The night's roster; player ids are reused across the night's games. */
  players: Player[]
  createdAt: number
  updatedAt: number
  /** Set when the host wraps the night up (locks in the summary). */
  finishedAt: number | null
  rev: number
  deletedAt: number | null
}

/** Persisted schema version for the games store (see migrate in the store). */
export const GAMES_SCHEMA_VERSION = 2

/** Persisted schema version for the Game Nights store. */
export const NIGHTS_SCHEMA_VERSION = 1

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
