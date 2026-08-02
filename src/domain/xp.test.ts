import { describe, expect, it } from 'vitest'

import {
  computeXpBreakdown,
  levelForXp,
  totalXp,
  XP_RULES,
  type XpInputs,
} from './xp'

const base: XpInputs = {
  gamesPlayed: 0,
  wins: 0,
  nightsFinished: 0,
  stickersUnlocked: 0,
  collectionComplete: false,
  milestonesReached: 0,
  personalBests: 0,
}

describe('XP', () => {
  it('rewards participation more than winning', () => {
    // Playing a game is worth more than the bonus for winning it.
    expect(XP_RULES.perGame).toBeGreaterThan(XP_RULES.perWin)
    const played = totalXp({ ...base, gamesPlayed: 1 })
    const wonToo = totalXp({ ...base, gamesPlayed: 1, wins: 1 })
    expect(played).toBe(50)
    expect(wonToo).toBe(80)
  })

  it('sums every source', () => {
    const { total } = computeXpBreakdown({
      gamesPlayed: 10,
      wins: 4,
      nightsFinished: 2,
      stickersUnlocked: 5,
      collectionComplete: false,
      milestonesReached: 3,
      personalBests: 2,
    })
    expect(total).toBe(10 * 50 + 4 * 30 + 2 * 100 + 5 * 40 + 3 * 75 + 2 * 25)
  })

  it('adds the collection bonus only when complete', () => {
    expect(totalXp({ ...base, collectionComplete: true })).toBe(500)
    expect(totalXp({ ...base, collectionComplete: false })).toBe(0)
  })

  it('drops zero lines from the breakdown', () => {
    const { lines } = computeXpBreakdown({ ...base, gamesPlayed: 1 })
    expect(lines).toHaveLength(1)
    expect(lines[0].label).toBe('Games played')
  })
})

describe('levelForXp', () => {
  it('starts at level 1 with no XP', () => {
    const l = levelForXp(0)
    expect(l.level).toBe(1)
    expect(l.progress).toBe(0)
    expect(l.xpForNext).toBe(120)
  })

  it('advances a level exactly at the threshold', () => {
    expect(levelForXp(119).level).toBe(1)
    expect(levelForXp(120).level).toBe(2)
    expect(levelForXp(120).xpIntoLevel).toBe(0)
  })

  it('reports partial progress within a level', () => {
    const l = levelForXp(60)
    expect(l.level).toBe(1)
    expect(l.progress).toBeCloseTo(0.5)
  })

  it('is monotonic in XP', () => {
    let last = 0
    for (let xp = 0; xp < 20000; xp += 137) {
      const level = levelForXp(xp).level
      expect(level).toBeGreaterThanOrEqual(last)
      last = level
    }
  })

  it('caps at the max level', () => {
    const l = levelForXp(10_000_000)
    expect(l.level).toBe(99)
    expect(l.xpForNext).toBe(0)
    expect(l.progress).toBe(1)
  })
})
