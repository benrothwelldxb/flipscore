/**
 * Sticker Book domain model.
 *
 * The app is a shared, device-local scorekeeper, so the collection is a single
 * album belonging to this device (mirroring how Stats aggregates every player).
 * An {@link Achievement} is the *rule* — a numeric metric plus the value it must
 * reach — and a {@link Sticker} is the *collectible* it awards. Once earned, a
 * sticker is never revoked (see the stickers store), which is what makes the
 * collection feel permanent even if games are later deleted.
 */

/** Rarity tiers, ordered from most common to rarest. */
export const RARITIES = [
  'common',
  'rare',
  'epic',
  'legendary',
  'mythic',
] as const
export type Rarity = (typeof RARITIES)[number]

/** Thematic shelves of the album, in display order. */
export const CATEGORIES = [
  'winning',
  'scoring',
  'risk',
  'luck',
  'consistency',
  'social',
  'milestones',
  'seasonal',
] as const
export type StickerCategory = (typeof CATEGORIES)[number]

/**
 * Every numeric signal an achievement can be measured against. All values are
 * numbers (booleans are modelled as 0/1 counts) so that unlocking is always the
 * single, uniform rule `metrics[metric] >= threshold` — trivial to test and to
 * show progress for. Derived entirely from finished games (see metrics.ts), so
 * the album is a direct, honest reflection of the statistics.
 */
export interface AchievementMetrics {
  /** Finished, non-deleted games on this device. */
  gamesFinished: number
  /** Total scored rounds across those games. */
  roundsPlayed: number
  /** Distinct player names ever seen. */
  distinctPlayers: number
  /** Most players seated in a single game. */
  biggestTable: number
  /** Finished games played in Connected mode. */
  connectedGames: number
  /** Finished games played in Pass-and-Play mode. */
  passGames: number
  /** Most games played by any one player. */
  bestGamesPlayed: number
  /** Most games won by any one player. */
  bestWins: number
  /** Longest run of consecutive wins by any one player. */
  bestWinStreak: number
  /** Most Flip 7 bonuses landed by any one player. */
  bestFlip7: number
  /** Most busts by any one player. */
  bestBusts: number
  /** Flip 7 bonuses landed across everyone. */
  totalFlip7: number
  /** Busts across everyone. */
  totalBusts: number
  /** Highest single-round score anyone has scored. */
  highestRound: number
  /** Highest final total anyone has finished a game on. */
  highestTotal: number
  /** Games won by a player who never busted in that game. */
  flawlessWins: number
  /** Games won by a player who was ranked last at some earlier round. */
  comebackWins: number
  /** Comeback wins where the winner trailed the leader by 40+ at some point. */
  bigComebackWins: number
  /** Games won by a player who busted at least once during that game. */
  winsWithBust: number
  /** Games decided by a margin of 3 points or fewer. */
  closeWins: number
  /** Games won on a final total of 120 or fewer. */
  lowScoringWins: number
  /** Games finished during December. */
  seasonDecember: number
  /** Games finished on New Year's Day. */
  seasonNewYear: number
  /** Games finished in summer (June–August). */
  seasonSummer: number
  /** Games finished on a Saturday or Sunday. */
  weekendGames: number
  /** Games finished between midnight and 5am. */
  lateNightGames: number
}

/** The rule that earns a sticker. */
export interface Achievement {
  /** Which metric this achievement watches. */
  metric: keyof AchievementMetrics
  /** Unlocks once the metric reaches (is ≥) this value. */
  threshold: number
  /** Short, player-facing description of how to earn it. */
  hint: string
}

/** A collectible sticker and the achievement that awards it. */
export interface Sticker {
  /** Stable id (also the key used in the collection and the art registry). */
  id: string
  /** Display name shown on the sticker and in the album. */
  name: string
  rarity: Rarity
  category: StickerCategory
  /** Key into the sticker-art motif registry. */
  art: string
  achievement: Achievement
}

/** A single permanent unlock. */
export interface StickerUnlock {
  id: string
  /** Epoch ms the sticker was first earned. */
  unlockedAt: number
}

/** The device's permanent sticker collection (the persisted store shape). */
export interface StickerCollection {
  unlocked: Record<string, StickerUnlock>
}
