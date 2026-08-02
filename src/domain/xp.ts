/**
 * The Legacy Card XP + level system.
 *
 * XP deliberately rewards *participation* over winning — showing up for a game
 * is worth more than the win bonus on top of it — so a Legacy Card grows for
 * everyone at the table, and levelling never gates gameplay (it only unlocks
 * cosmetics). All functions are pure so the level shown on a card is a direct,
 * testable function of what the player has done.
 */

/** Point values for each XP-earning action. */
export const XP_RULES = {
  /** Playing (finishing) a game — the biggest single driver. */
  perGame: 50,
  /** A win, *on top of* the play reward — smaller, so playing > winning. */
  perWin: 30,
  /** Being part of a completed Game Night. */
  perNight: 100,
  /** Each sticker unlocked in the collection. */
  perSticker: 40,
  /** Each career milestone reached. */
  perMilestone: 75,
  /** Each personal-best category set. */
  perPersonalBest: 25,
  /** One-off bonus for completing the whole sticker collection. */
  collectionBonus: 500,
} as const

export interface XpInputs {
  gamesPlayed: number
  wins: number
  /** Completed Game Nights the player took part in. */
  nightsFinished: number
  /** Stickers unlocked (device collection). */
  stickersUnlocked: number
  collectionComplete: boolean
  /** Career milestones reached (see history). */
  milestonesReached: number
  /** Distinct personal-best categories the player has set. */
  personalBests: number
}

export interface XpLine {
  label: string
  xp: number
}

/** Itemised XP with a total — drives the card and the "how XP works" view. */
export function computeXpBreakdown(i: XpInputs): {
  lines: XpLine[]
  total: number
} {
  const lines: XpLine[] = [
    { label: 'Games played', xp: i.gamesPlayed * XP_RULES.perGame },
    { label: 'Wins', xp: i.wins * XP_RULES.perWin },
    { label: 'Game Nights', xp: i.nightsFinished * XP_RULES.perNight },
    { label: 'Stickers', xp: i.stickersUnlocked * XP_RULES.perSticker },
    { label: 'Milestones', xp: i.milestonesReached * XP_RULES.perMilestone },
    {
      label: 'Personal bests',
      xp: i.personalBests * XP_RULES.perPersonalBest,
    },
  ]
  if (i.collectionComplete) {
    lines.push({ label: 'Collection complete', xp: XP_RULES.collectionBonus })
  }
  const total = lines.reduce((s, l) => s + l.xp, 0)
  return { lines: lines.filter((l) => l.xp > 0), total }
}

/** Total XP from the inputs (convenience over {@link computeXpBreakdown}). */
export function totalXp(inputs: XpInputs): number {
  return computeXpBreakdown(inputs).total
}

const LEVEL_BASE = 120
const LEVEL_STEP = 30
const MAX_LEVEL = 99

/** XP cost to advance *from* level `l` to `l + 1`. */
function levelCost(l: number): number {
  return LEVEL_BASE + (l - 1) * LEVEL_STEP
}

export interface LevelProgress {
  level: number
  /** XP accumulated within the current level. */
  xpIntoLevel: number
  /** XP needed to reach the next level (0 at max level). */
  xpForNext: number
  /** 0..1 fraction toward the next level. */
  progress: number
  /** Total XP this level was computed from. */
  totalXp: number
}

/** Resolve a total XP value into a level and progress toward the next. */
export function levelForXp(xp: number): LevelProgress {
  const safe = Math.max(0, Math.floor(xp))
  let level = 1
  let consumed = 0
  while (level < MAX_LEVEL) {
    const cost = levelCost(level)
    if (safe - consumed < cost) break
    consumed += cost
    level += 1
  }
  const xpIntoLevel = safe - consumed
  const xpForNext = level >= MAX_LEVEL ? 0 : levelCost(level)
  const progress = xpForNext > 0 ? xpIntoLevel / xpForNext : 1
  return { level, xpIntoLevel, xpForNext, progress, totalXp: safe }
}
