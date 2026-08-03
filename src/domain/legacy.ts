import { finishedGames, normalizeName } from './analysis'
import { STICKERS, STICKERS_BY_ID } from './stickers/catalog'
import { RARITIES } from './stickers/types'
import type { Sticker } from './stickers/types'
import { colorByKey } from './colors'
import {
  backgroundById,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_TITLE_ID,
  titleById,
  unlockedBackgrounds,
  unlockedTitles,
  type BackgroundDef,
  type TitleDef,
  type UnlockContext,
} from './cosmetics'
import { computePlayerHistory, type PlayerHistory } from './history'
import type { Game, GameMode, GameNight, AvatarConfig } from './types'
import {
  computeXpBreakdown,
  levelForXp,
  type LevelProgress,
  type XpLine,
} from './xp'

/**
 * The Legacy Card: one living, auto-updating trading card per player.
 *
 * `computeLegacyCard` is a *pure* function of the player's games, nights, the
 * device sticker collection and the player's cosmetic choices — nothing about a
 * card is stored except the cosmetic selections (see the profile store). That
 * keeps the card always-correct and makes future data sources (cloud sync,
 * friends, rankings) a matter of feeding different inputs in, with no redesign.
 */

// ---- Rarity ---------------------------------------------------------------

export const CARD_RARITIES = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'master',
  'legend',
] as const
export type CardRarity = (typeof CARD_RARITIES)[number]

export interface RarityStyle {
  key: CardRarity
  label: string
  /** Metallic gradient stops for the card frame. */
  frame: readonly string[]
  gem: string
  glow: string
  /** Holographic sheen for the premium tiers. */
  foil: boolean
}

export const RARITY_STYLES: Record<CardRarity, RarityStyle> = {
  bronze: {
    key: 'bronze',
    label: 'Bronze',
    frame: ['#d97706', '#92400e', '#78350f'],
    gem: '#f59e0b',
    glow: '#b45309',
    foil: false,
  },
  silver: {
    key: 'silver',
    label: 'Silver',
    frame: ['#f1f5f9', '#cbd5e1', '#94a3b8'],
    gem: '#e2e8f0',
    glow: '#cbd5e1',
    foil: false,
  },
  gold: {
    key: 'gold',
    label: 'Gold',
    frame: ['#fde68a', '#f59e0b', '#b45309'],
    gem: '#fbbf24',
    glow: '#f59e0b',
    foil: false,
  },
  platinum: {
    key: 'platinum',
    label: 'Platinum',
    frame: ['#f0f9ff', '#bae6fd', '#7dd3fc'],
    gem: '#e0f2fe',
    glow: '#38bdf8',
    foil: true,
  },
  diamond: {
    key: 'diamond',
    label: 'Diamond',
    frame: ['#cffafe', '#67e8f9', '#22d3ee'],
    gem: '#ecfeff',
    glow: '#22d3ee',
    foil: true,
  },
  master: {
    key: 'master',
    label: 'Master',
    frame: ['#ddd6fe', '#a78bfa', '#6d28d9'],
    gem: '#ede9fe',
    glow: '#8b5cf6',
    foil: true,
  },
  legend: {
    key: 'legend',
    label: 'Legend',
    frame: ['#fbbf24', '#f472b6', '#818cf8'],
    gem: '#ffffff',
    glow: '#f472b6',
    foil: true,
  },
}

/** Weighted "prestige" score → rarity tier. Grows with breadth of play. */
export function rarityScore(c: UnlockContext): number {
  return (
    c.gamesPlayed * 2 +
    c.wins * 3 +
    c.level * 10 +
    c.stickerCount * 8 +
    (c.collectionComplete ? 200 : 0)
  )
}

const RARITY_THRESHOLDS: [CardRarity, number][] = [
  ['legend', 3200],
  ['master', 2200],
  ['diamond', 1400],
  ['platinum', 800],
  ['gold', 400],
  ['silver', 150],
  ['bronze', 0],
]

export function computeCardRarity(c: UnlockContext): RarityStyle {
  const score = rarityScore(c)
  const tier =
    RARITY_THRESHOLDS.find(([, min]) => score >= min)?.[0] ?? 'bronze'
  return RARITY_STYLES[tier]
}

// ---- Season ---------------------------------------------------------------

const SEASON_EPOCH = Date.UTC(2026, 0, 1)
const SEASON_MS = 1000 * 60 * 60 * 24 * 91 // ~13-week seasons

export function seasonForDate(now: number): number {
  return Math.max(1, Math.floor((now - SEASON_EPOCH) / SEASON_MS) + 1)
}

// ---- Card model -----------------------------------------------------------

/** The player's manually-chosen cosmetics — the only stored card state. */
export interface LegacyProfile {
  titleId?: string
  backgroundId?: string
  /** Accent colour override (hex); defaults to the player's game colour. */
  accentColor?: string
  /** Up to four pinned showcase stickers. */
  pinnedStickerIds?: string[]
  /** Last-edit time (epoch ms), stamped on every change for last-write-wins sync. */
  updatedAt?: number
}

export interface FormEntry {
  won: boolean
  rank: number
}

export interface LegacyCardStats {
  wins: number
  winPct: number
  gamesPlayed: number
  highestRound: number
  longestWinStreak: number
  bestComeback: number
}

export interface LegacyCard {
  name: string
  color: string
  accent: string
  avatar?: AvatarConfig
  title: TitleDef
  background: BackgroundDef
  rarity: RarityStyle
  level: LevelProgress
  season: number
  seasonLabel: string
  stickerCount: number
  totalStickers: number
  collectionComplete: boolean
  /** Up to six results, oldest → newest. */
  recentForm: FormEntry[]
  stats: LegacyCardStats
  favouriteModeLabel: string
  favouriteOpponent: string | null
  favouriteNight: string | null
  favouriteSticker: Sticker | null
  pinnedStickers: Sticker[]
  xp: { lines: XpLine[]; total: number }
  unlockedTitles: TitleDef[]
  unlockedBackgrounds: BackgroundDef[]
}

export interface LegacyCardInputs {
  games: Game[]
  nights: GameNight[]
  name: string
  unlockedStickerIds: string[]
  totalStickers: number
  profile: LegacyProfile
  now: number
  /** Pass a precomputed history to avoid recomputing it (the page already has it). */
  history?: PlayerHistory
}

const MODE_LABELS: Record<GameMode, string> = {
  host: 'Host',
  pass: 'Pass & Play',
  connected: 'Connected',
}

function rarityRank(sticker: Sticker): number {
  return RARITIES.indexOf(sticker.rarity)
}

export function computeLegacyCard(inputs: LegacyCardInputs): LegacyCard {
  const {
    games,
    nights,
    name,
    unlockedStickerIds,
    totalStickers,
    profile,
    now,
  } = inputs
  const key = normalizeName(name)
  const history = inputs.history ?? computePlayerHistory(games, name)

  const { busts, comebacks, bestComeback, favouriteMode } = history
  const avatar = history.avatar
  const color = history.color

  // Stickers (device collection) + the player's showcase.
  const unlockedSet = new Set(unlockedStickerIds)
  const stickerCount = unlockedSet.size
  const collectionComplete = totalStickers > 0 && stickerCount >= totalStickers
  const pinnedStickers = (profile.pinnedStickerIds ?? [])
    .filter((id) => unlockedSet.has(id) && STICKERS_BY_ID.has(id))
    .map((id) => STICKERS_BY_ID.get(id) as Sticker)
    .slice(0, 4)
  const rarestUnlocked = STICKERS.filter((s) => unlockedSet.has(s.id)).sort(
    (a, b) => rarityRank(b) - rarityRank(a),
  )[0]
  const favouriteSticker = pinnedStickers[0] ?? rarestUnlocked ?? null

  // XP → level.
  const milestonesReached = history.milestones.filter((m) => m.reached).length
  const b = history.bests
  const personalBests = [
    b.highestRound > 0,
    b.highestGameTotal > 0,
    b.bestFinish != null,
    b.longestWinStreak > 0,
    b.mostFlip7InGame > 0,
    b.largestWinMargin > 0,
  ].filter(Boolean).length
  const nightsFinished = nights.filter(
    (n) =>
      !n.deletedAt &&
      n.finishedAt != null &&
      n.players.some((p) => normalizeName(p.name) === key),
  ).length

  const xp = computeXpBreakdown({
    gamesPlayed: history.games,
    wins: history.wins,
    nightsFinished,
    stickersUnlocked: stickerCount,
    collectionComplete,
    milestonesReached,
    personalBests,
  })
  const level = levelForXp(xp.total)

  // Rarity + cosmetic unlocks share one context.
  const ctx: UnlockContext = {
    level: level.level,
    gamesPlayed: history.games,
    wins: history.wins,
    winPct: history.winPct,
    highestRound: b.highestRound,
    busts,
    stickerCount,
    comebacks,
    collectionComplete,
  }
  const rarity = computeCardRarity(ctx)
  const titles = unlockedTitles(ctx)
  const backgrounds = unlockedBackgrounds(ctx)

  const title =
    (profile.titleId && titles.find((t) => t.id === profile.titleId)) ||
    titleById(DEFAULT_TITLE_ID) ||
    titles[0]
  const background =
    (profile.backgroundId &&
      backgrounds.find((bg) => bg.id === profile.backgroundId)) ||
    backgroundById(DEFAULT_BACKGROUND_ID) ||
    backgrounds[0]

  const accent = profile.accentColor ?? colorByKey(color).hex

  // Favourite Game Night: prefer one they "won" (most wins on the night),
  // else the one they played most. Derived cheaply from winner ids — no need
  // to compute full night standings/awards just to pick a favourite.
  const finished = finishedGames(games)
  let favouriteNight: string | null = null
  let bestNightScore = -1
  for (const night of nights) {
    if (night.deletedAt) continue
    if (!night.players.some((p) => normalizeName(p.name) === key)) continue
    const nightGames = finished.filter((g) => g.gameNightId === night.id)
    if (nightGames.length === 0) continue
    let mineGames = 0
    const winsByName = new Map<string, number>()
    for (const g of nightGames) {
      if (g.players.some((p) => normalizeName(p.name) === key)) mineGames += 1
      const w = g.players.find((p) => p.id === g.winnerId)
      if (w) {
        const wk = normalizeName(w.name)
        winsByName.set(wk, (winsByName.get(wk) ?? 0) + 1)
      }
    }
    if (mineGames === 0) continue
    const topWins = Math.max(0, ...winsByName.values())
    const wonNight = topWins > 0 && (winsByName.get(key) ?? 0) === topWins
    const score = (wonNight ? 1000 : 0) + mineGames
    if (score > bestNightScore) {
      bestNightScore = score
      favouriteNight = night.name
    }
  }

  const recentForm: FormEntry[] = history.recentForm
    .slice(0, 6)
    .reverse()
    .map((t) => ({ won: t.won, rank: t.rank }))

  const seasonNumber = seasonForDate(now)

  return {
    name: history.name,
    color,
    accent,
    avatar,
    title,
    background,
    rarity,
    level,
    season: seasonNumber,
    seasonLabel: `Season ${seasonNumber}`,
    stickerCount,
    totalStickers,
    collectionComplete,
    recentForm,
    stats: {
      wins: history.wins,
      winPct: history.winPct,
      gamesPlayed: history.games,
      highestRound: b.highestRound,
      longestWinStreak: b.longestWinStreak,
      bestComeback,
    },
    favouriteModeLabel: favouriteMode ? MODE_LABELS[favouriteMode] : '—',
    favouriteOpponent: history.rivalries[0]?.name ?? null,
    favouriteNight,
    favouriteSticker,
    pinnedStickers,
    xp,
    unlockedTitles: titles,
    unlockedBackgrounds: backgrounds,
  }
}
