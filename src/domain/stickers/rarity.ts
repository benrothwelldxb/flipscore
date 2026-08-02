import type { Rarity, StickerCategory } from './types'

/**
 * Presentation metadata for rarities and categories. Kept in the domain so the
 * art renderer, the album, and the detail view all speak with one voice.
 */

export interface RarityStyle {
  label: string
  /** Two-to-three stop gradient for the sticker's foil frame. */
  frame: readonly string[]
  /** Glow/shadow colour used behind rarer stickers. */
  glow: string
  /** Whether this tier gets a foil sheen + sparkles. */
  foil: boolean
}

export const RARITY_STYLES: Record<Rarity, RarityStyle> = {
  common: {
    label: 'Common',
    frame: ['#e2e8f0', '#94a3b8'],
    glow: '#94a3b8',
    foil: false,
  },
  rare: {
    label: 'Rare',
    frame: ['#7dd3fc', '#2563eb'],
    glow: '#3b82f6',
    foil: false,
  },
  epic: {
    label: 'Epic',
    frame: ['#d8b4fe', '#7c3aed'],
    glow: '#8b5cf6',
    foil: true,
  },
  legendary: {
    label: 'Legendary',
    frame: ['#fde68a', '#f59e0b', '#ea580c'],
    glow: '#f59e0b',
    foil: true,
  },
  mythic: {
    label: 'Mythic',
    frame: ['#fda4af', '#ec4899', '#8b5cf6'],
    glow: '#ec4899',
    foil: true,
  },
}

export const CATEGORY_LABELS: Record<StickerCategory, string> = {
  winning: 'Winning',
  scoring: 'Scoring',
  risk: 'Risk',
  luck: 'Luck',
  consistency: 'Consistency',
  social: 'Social',
  milestones: 'Milestones',
  seasonal: 'Seasonal',
}

/** Short blurb shown at the top of each album shelf. */
export const CATEGORY_BLURBS: Record<StickerCategory, string> = {
  winning: 'Trophies for taking the crown.',
  scoring: 'Big numbers and huge rounds.',
  risk: 'Rewards for living dangerously.',
  luck: 'When fortune flips your way.',
  consistency: 'Showing up and holding steady.',
  social: 'The more the merrier.',
  milestones: 'Marks of a well-played journey.',
  seasonal: 'Caught at just the right time.',
}
