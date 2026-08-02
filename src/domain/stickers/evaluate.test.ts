import { describe, expect, it } from 'vitest'

import { STICKERS_BY_ID } from './catalog'
import { isUnlocked, progressOf, unlockedIds } from './evaluate'
import { computeAchievementMetrics } from './metrics'
import type { AchievementMetrics } from './types'

function metrics(overrides: Partial<AchievementMetrics>): AchievementMetrics {
  return { ...computeAchievementMetrics([]), ...overrides }
}

const firstWin = STICKERS_BY_ID.get('first-win')!
const fiveWins = STICKERS_BY_ID.get('five-wins')!

describe('sticker evaluation', () => {
  it('unlocks once the metric reaches the threshold', () => {
    expect(isUnlocked(firstWin, metrics({ bestWins: 0 }))).toBe(false)
    expect(isUnlocked(firstWin, metrics({ bestWins: 1 }))).toBe(true)
    expect(isUnlocked(fiveWins, metrics({ bestWins: 4 }))).toBe(false)
    expect(isUnlocked(fiveWins, metrics({ bestWins: 5 }))).toBe(true)
  })

  it('reports capped progress toward a sticker', () => {
    expect(progressOf(fiveWins, metrics({ bestWins: 0 }))).toEqual({
      current: 0,
      target: 5,
      ratio: 0,
    })
    expect(progressOf(fiveWins, metrics({ bestWins: 2 })).ratio).toBeCloseTo(
      0.4,
    )
    // Progress never exceeds the target.
    expect(progressOf(fiveWins, metrics({ bestWins: 99 }))).toEqual({
      current: 5,
      target: 5,
      ratio: 1,
    })
  })

  it('lists unlocked ids in catalog order', () => {
    const ids = unlockedIds(metrics({ bestWins: 5, gamesFinished: 1 }))
    expect(ids).toContain('first-win')
    expect(ids).toContain('five-wins')
    expect(ids).toContain('first-steps')
    // first-win is defined before five-wins in the catalog.
    expect(ids.indexOf('first-win')).toBeLessThan(ids.indexOf('five-wins'))
    // A far-off achievement stays locked.
    expect(ids).not.toContain('legend')
  })
})
