import { describe, expect, it } from 'vitest'

import { MOTIF_KEYS } from '@/components/stickers/sticker-motifs'

import { STICKERS, STICKERS_BY_ID } from './catalog'
import { computeAchievementMetrics } from './metrics'
import { CATEGORIES, RARITIES } from './types'

const METRIC_KEYS = new Set(Object.keys(computeAchievementMetrics([])))

describe('sticker catalog', () => {
  it('has roughly forty stickers', () => {
    expect(STICKERS.length).toBeGreaterThanOrEqual(40)
    expect(STICKERS.length).toBeLessThanOrEqual(48)
  })

  it('has unique ids', () => {
    const ids = STICKERS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(STICKERS_BY_ID.size).toBe(ids.length)
  })

  it('uses only valid rarities and categories', () => {
    for (const s of STICKERS) {
      expect(RARITIES).toContain(s.rarity)
      expect(CATEGORIES).toContain(s.category)
    }
  })

  it('covers every category and rarity', () => {
    for (const c of CATEGORIES) {
      expect(STICKERS.some((s) => s.category === c)).toBe(true)
    }
    for (const r of RARITIES) {
      expect(STICKERS.some((s) => s.rarity === r)).toBe(true)
    }
  })

  it('references a real metric and a positive threshold', () => {
    for (const s of STICKERS) {
      expect(METRIC_KEYS.has(s.achievement.metric)).toBe(true)
      expect(s.achievement.threshold).toBeGreaterThan(0)
      expect(s.achievement.hint.length).toBeGreaterThan(0)
    }
  })

  it('has artwork for every sticker', () => {
    const motifs = new Set(MOTIF_KEYS)
    for (const s of STICKERS) {
      expect(motifs.has(s.art)).toBe(true)
    }
  })
})
