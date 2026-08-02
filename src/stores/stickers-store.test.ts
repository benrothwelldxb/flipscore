import { beforeEach, describe, expect, it } from 'vitest'

import { computeAchievementMetrics } from '@/domain/stickers/metrics'
import type { AchievementMetrics } from '@/domain/stickers/types'
import type { Game } from '@/domain/types'

import { useStickersStore } from './stickers-store'

function metrics(overrides: Partial<AchievementMetrics>): AchievementMetrics {
  return { ...computeAchievementMetrics([]), ...overrides }
}

function newState() {
  return useStickersStore.getState()
}

describe('stickers store', () => {
  beforeEach(() => newState().reset())

  it('unlocks the achievements earned by the metrics', () => {
    const earned = newState().reconcile(
      metrics({ bestWins: 1, gamesFinished: 1 }),
      100,
    )
    const ids = earned.map((s) => s.id)
    expect(ids).toContain('first-win')
    expect(ids).toContain('first-steps')

    const unlocked = newState().unlocked
    expect(unlocked['first-win']).toEqual({ id: 'first-win', unlockedAt: 100 })
  })

  it('prevents duplicate unlocks and preserves the original time', () => {
    newState().reconcile(metrics({ gamesFinished: 1 }), 100)
    // Same metrics again → nothing new.
    const again = newState().reconcile(metrics({ gamesFinished: 1 }), 200)
    expect(again).toEqual([])

    // A later reconcile that earns more keeps earlier unlock times intact.
    const more = newState().reconcile(
      metrics({ gamesFinished: 1, bestWins: 1 }),
      300,
    )
    expect(more.map((s) => s.id)).toEqual(['first-win'])
    const unlocked = newState().unlocked
    expect(unlocked['first-steps'].unlockedAt).toBe(100)
    expect(unlocked['first-win'].unlockedAt).toBe(300)
  })

  it('tracks acknowledgement so freshly-earned stickers can be flagged', () => {
    newState().reconcile(metrics({ bestWins: 1, gamesFinished: 1 }), 100)
    const ids = Object.keys(newState().unlocked)
    expect(newState().acknowledged).toEqual([])

    newState().acknowledge([ids[0]])
    expect(newState().acknowledged).toEqual([ids[0]])

    newState().acknowledgeAll()
    expect(new Set(newState().acknowledged)).toEqual(new Set(ids))
  })

  it('only acknowledges ids that are actually unlocked', () => {
    newState().reconcile(metrics({ gamesFinished: 1 }), 100)
    newState().acknowledge(['legend']) // not unlocked
    expect(newState().acknowledged).toEqual([])
  })

  it('reconciles straight from game history (statistics linkage)', () => {
    const game: Game = {
      id: 'g1',
      name: '',
      players: [
        { id: 'a', name: 'Ada', color: 'red', order: 0 },
        { id: 'b', name: 'Bo', color: 'blue', order: 1 },
      ],
      rounds: [{ id: 'r0', index: 0, scores: { a: 200, b: 10 } }],
      settings: { mode: 'host', targetScore: 200 },
      status: 'finished',
      currentRoundIndex: 0,
      winnerId: 'a',
      favorite: false,
      createdAt: 0,
      updatedAt: 0,
      finishedAt: 0,
      rev: 1,
      deletedAt: null,
    }
    const earned = newState().reconcile(computeAchievementMetrics([game]), 100)
    expect(earned.map((s) => s.id)).toContain('first-win')
  })

  it('resets the collection', () => {
    newState().reconcile(metrics({ gamesFinished: 1 }), 100)
    expect(Object.keys(newState().unlocked).length).toBeGreaterThan(0)
    newState().reset()
    expect(newState().unlocked).toEqual({})
    expect(newState().acknowledged).toEqual([])
  })
})
