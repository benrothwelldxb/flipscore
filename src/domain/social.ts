import { normalizeName } from './analysis'
import { computeLegacyCard, type LegacyProfile } from './legacy'
import { computeStats } from './stats'
import type { Game, GameNight } from './types'

/**
 * The small, public stats snapshot an account publishes for its claimed player
 * identity. Everything here is derived from the account's own games with the
 * same engines the rest of the app uses (computeStats, computeLegacyCard), so a
 * friend's leaderboard row always agrees with what that friend sees locally.
 */
export interface IdentityStats {
  gamesPlayed: number
  gamesWon: number
  /** 0..1 */
  winPct: number
  flip7Count: number
  longestWinStreak: number
  highestRound: number | null
  level: number
}

export function emptyIdentityStats(): IdentityStats {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    winPct: 0,
    flip7Count: 0,
    longestWinStreak: 0,
    highestRound: null,
    level: 1,
  }
}

export interface IdentityStatsInput {
  games: Game[]
  nights: GameNight[]
  /** The player name this identity claims. */
  name: string
  unlockedStickerIds: string[]
  totalStickers: number
  profile: LegacyProfile
  now: number
}

/** Compute the publishable stats snapshot for a claimed player name. */
export function computeIdentityStats(input: IdentityStatsInput): IdentityStats {
  const key = normalizeName(input.name)
  if (!key) return emptyIdentityStats()

  const player = computeStats(input.games).players.find(
    (p) => normalizeName(p.name) === key,
  )
  if (!player) return emptyIdentityStats()

  // Level comes from the Legacy Card so it matches the player's profile exactly.
  const card = computeLegacyCard({
    games: input.games,
    nights: input.nights,
    name: input.name,
    unlockedStickerIds: input.unlockedStickerIds,
    totalStickers: input.totalStickers,
    profile: input.profile,
    now: input.now,
  })

  return {
    gamesPlayed: player.gamesPlayed,
    gamesWon: player.gamesWon,
    winPct: player.winPct,
    flip7Count: player.flip7Count,
    longestWinStreak: player.longestWinStreak,
    highestRound: player.highestRound,
    level: card.level.level,
  }
}

/** Coerce an untrusted stats blob (a friend's published snapshot) into shape. */
export function parseIdentityStats(data: unknown): IdentityStats {
  const o = (data && typeof data === 'object' ? data : {}) as Record<
    string,
    unknown
  >
  const num = (v: unknown, fallback = 0): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return {
    gamesPlayed: num(o.gamesPlayed),
    gamesWon: num(o.gamesWon),
    winPct: num(o.winPct),
    flip7Count: num(o.flip7Count),
    longestWinStreak: num(o.longestWinStreak),
    highestRound: typeof o.highestRound === 'number' ? o.highestRound : null,
    level: num(o.level, 1),
  }
}

export interface LeaderboardEntry {
  accountId: string
  displayName: string
  isSelf: boolean
  stats: IdentityStats
}

/**
 * Rank leaderboard rows: most wins first, then win rate, then games played,
 * then name — a total order so every device sorts identically.
 */
export function rankLeaderboard(
  entries: LeaderboardEntry[],
): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    const x = a.stats
    const y = b.stats
    if (y.gamesWon !== x.gamesWon) return y.gamesWon - x.gamesWon
    if (y.winPct !== x.winPct) return y.winPct - x.winPct
    if (y.gamesPlayed !== x.gamesPlayed) return y.gamesPlayed - x.gamesPlayed
    return a.displayName.localeCompare(b.displayName)
  })
}

/** Distinct player names in the library, most-played first — the claim picker. */
export function playerNameOptions(games: Game[]): string[] {
  return computeStats(games)
    .players.slice()
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
    .map((p) => p.name)
}

/**
 * The player who "is you" on this device: an explicit choice if made, otherwise
 * the most-played name (a sensible default so achievements are personal out of
 * the box). Returns null only when there are no games to infer from.
 */
export function resolveIdentityName(
  explicit: string | null | undefined,
  games: Game[],
): string | null {
  const trimmed = explicit?.trim()
  if (trimmed) return trimmed
  return playerNameOptions(games)[0] ?? null
}
