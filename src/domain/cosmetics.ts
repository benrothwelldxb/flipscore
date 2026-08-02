/**
 * Cosmetics unlocked as a player levels up and racks up achievements. These are
 * the *only* things a player edits by hand (everything else on a Legacy Card is
 * derived). Titles unlock from career facts; backgrounds unlock from level.
 *
 * Palettes are concrete hex (not theme tokens) on purpose: a Legacy Card is a
 * trading card — it looks the same in light or dark mode, and, crucially, it
 * still renders correctly once serialised to a standalone PNG for sharing.
 *
 * The catalogs are data-only and open for extension, so future seasons, limited
 * editions or event cosmetics slot in without touching the renderer.
 */

/** The career facts a cosmetic can unlock against. */
export interface UnlockContext {
  level: number
  gamesPlayed: number
  wins: number
  winPct: number
  highestRound: number
  busts: number
  stickerCount: number
  comebacks: number
  collectionComplete: boolean
}

export interface TitleDef {
  id: string
  label: string
  hint: string
  unlocked: (c: UnlockContext) => boolean
}

export const DEFAULT_TITLE_ID = 'rookie'

export const TITLES: readonly TitleDef[] = [
  {
    id: 'rookie',
    label: 'Rookie',
    hint: 'Every legend starts somewhere.',
    unlocked: () => true,
  },
  {
    id: 'champion',
    label: 'Champion',
    hint: 'Win a game.',
    unlocked: (c) => c.wins >= 1,
  },
  {
    id: 'comeback-king',
    label: 'Comeback King',
    hint: 'Win from last place.',
    unlocked: (c) => c.comebacks >= 1,
  },
  {
    id: 'risk-taker',
    label: 'Risk Taker',
    hint: 'Bust 15 times.',
    unlocked: (c) => c.busts >= 15,
  },
  {
    id: 'high-roller',
    label: 'High Roller',
    hint: 'Score 50+ in a round.',
    unlocked: (c) => c.highestRound >= 50,
  },
  {
    id: 'veteran',
    label: 'Veteran',
    hint: 'Play 25 games.',
    unlocked: (c) => c.gamesPlayed >= 25,
  },
  {
    id: 'collector',
    label: 'Collector',
    hint: 'Unlock 20 stickers.',
    unlocked: (c) => c.stickerCount >= 20,
  },
  {
    id: 'master-strategist',
    label: 'Master Strategist',
    hint: 'Win over half of 10+ games.',
    unlocked: (c) => c.gamesPlayed >= 10 && c.winPct >= 0.5,
  },
  {
    id: 'legend',
    label: 'Legend',
    hint: 'Win 50 games.',
    unlocked: (c) => c.wins >= 50,
  },
] as const

export interface BackgroundDef {
  id: string
  label: string
  /** Gradient stops for the card face. */
  from: string
  via?: string
  to: string
  /** Accent used for glows/highlights when this background is equipped. */
  accent: string
  unlockLevel: number
}

export const DEFAULT_BACKGROUND_ID = 'midnight'

export const BACKGROUNDS: readonly BackgroundDef[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    from: '#312e81',
    via: '#1e1b4b',
    to: '#0f172a',
    accent: '#818cf8',
    unlockLevel: 1,
  },
  {
    id: 'ember',
    label: 'Ember',
    from: '#7c2d12',
    via: '#431407',
    to: '#1c1917',
    accent: '#fb923c',
    unlockLevel: 4,
  },
  {
    id: 'forest',
    label: 'Forest',
    from: '#14532d',
    via: '#052e16',
    to: '#0b1120',
    accent: '#4ade80',
    unlockLevel: 8,
  },
  {
    id: 'ocean',
    label: 'Ocean',
    from: '#0c4a6e',
    via: '#082f49',
    to: '#020617',
    accent: '#38bdf8',
    unlockLevel: 12,
  },
  {
    id: 'royal',
    label: 'Royal',
    from: '#581c87',
    via: '#3b0764',
    to: '#1e1b4b',
    accent: '#e879f9',
    unlockLevel: 18,
  },
  {
    id: 'aurora',
    label: 'Aurora',
    from: '#134e4a',
    via: '#0f766e',
    to: '#312e81',
    accent: '#5eead4',
    unlockLevel: 26,
  },
  {
    id: 'nebula',
    label: 'Nebula',
    from: '#831843',
    via: '#4a044e',
    to: '#1e1b4b',
    accent: '#f472b6',
    unlockLevel: 36,
  },
  {
    id: 'obsidian',
    label: 'Obsidian',
    from: '#1f2937',
    via: '#111827',
    to: '#030712',
    accent: '#e5e7eb',
    unlockLevel: 50,
  },
] as const

export function titleById(id: string | undefined): TitleDef | undefined {
  return TITLES.find((t) => t.id === id)
}

export function backgroundById(
  id: string | undefined,
): BackgroundDef | undefined {
  return BACKGROUNDS.find((b) => b.id === id)
}

export function unlockedTitles(c: UnlockContext): TitleDef[] {
  return TITLES.filter((t) => t.unlocked(c))
}

export function unlockedBackgrounds(c: UnlockContext): BackgroundDef[] {
  return BACKGROUNDS.filter((b) => c.level >= b.unlockLevel)
}
