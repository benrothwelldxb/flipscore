import { describe, expect, it } from 'vitest'

import { estimateWinChances } from './tension'
import type { Game, Player, Round } from './types'

function P(id: string, order: number): Player {
  return { id, name: id.toUpperCase(), color: 'red', order }
}

function mkGame(
  players: Player[],
  rounds: Record<string, number>[],
  targetScore = 200,
): Game {
  const rs: Round[] = rounds.map((scores, index) => ({
    id: `r${index}`,
    index,
    scores,
  }))
  return {
    id: 'game-1',
    name: '',
    players,
    rounds: rs,
    settings: { mode: 'host', targetScore },
    status: 'playing',
    currentRoundIndex: rounds.length - 1,
    winnerId: null,
    favorite: false,
    createdAt: 0,
    updatedAt: 0,
    finishedAt: null,
    rev: 1,
    deletedAt: null,
  }
}

const TWO = [P('a', 0), P('b', 1)]

describe('estimateWinChances', () => {
  it('is decided when a player has already reached the target', () => {
    const game = mkGame(TWO, [{ a: 200, b: 90 }])
    const est = estimateWinChances(game)
    expect(est.basis).toBe('decided')
    expect(est.chances.find((c) => c.playerId === 'a')!.probability).toBe(1)
    expect(est.chances.find((c) => c.playerId === 'b')!.probability).toBe(0)
  })

  it('is deterministic for a fixed seed', () => {
    const game = mkGame(TWO, [
      { a: 40, b: 35 },
      { a: 30, b: 45 },
    ])
    const a = estimateWinChances(game, { seed: 123, trials: 400 })
    const b = estimateWinChances(game, { seed: 123, trials: 400 })
    expect(a.chances).toEqual(b.chances)
  })

  it('probabilities sum to ~1 and favour a big leader', () => {
    const game = mkGame(TWO, [
      { a: 90, b: 20 },
      { a: 80, b: 15 },
    ])
    const est = estimateWinChances(game, { seed: 7, trials: 1000 })
    const total = est.chances.reduce((s, c) => s + c.probability, 0)
    expect(total).toBeCloseTo(1, 5)
    const a = est.chances.find((c) => c.playerId === 'a')!
    const b = est.chances.find((c) => c.playerId === 'b')!
    // Ada leads 170–35 with 30 to go — she should be the clear favourite.
    expect(a.probability).toBeGreaterThan(b.probability)
    expect(a.probability).toBeGreaterThan(0.8)
  })

  it('falls back to the prior distribution with too few live samples', () => {
    // A single round of two scores is below MIN_LIVE_SAMPLES.
    const game = mkGame(TWO, [{ a: 10, b: 8 }])
    expect(estimateWinChances(game, { seed: 1 }).basis).toBe('prior')
  })

  it('uses the live sample once enough rounds exist', () => {
    const game = mkGame(TWO, [
      { a: 15, b: 12 },
      { a: 18, b: 20 },
      { a: 9, b: 11 },
    ])
    expect(estimateWinChances(game, { seed: 1 }).basis).toBe('live')
  })

  it('sums to ~1 with a partially entered current round', () => {
    // Round 0 complete; round 1 in progress with only A entered.
    const game = mkGame(TWO, [{ a: 150, b: 150 }, { a: 40 }])
    const est = estimateWinChances(game, { seed: 5, trials: 1000 })
    const total = est.chances.reduce((s, c) => s + c.probability, 0)
    expect(total).toBeCloseTo(1, 5)
    // A has committed 190 (of 200) with B yet to play the round — A leads.
    const a = est.chances.find((c) => c.playerId === 'a')!
    const b = est.chances.find((c) => c.playerId === 'b')!
    expect(a.probability).toBeGreaterThan(b.probability)
  })

  it('counts scores already entered in the current round', () => {
    // Identical except B's current-round entry: entering a strong score for the
    // trailing player must raise their estimated win chance.
    const bWaiting = mkGame(TWO, [{ a: 150, b: 150 }, { a: 40 }])
    const bEntered = mkGame(TWO, [
      { a: 150, b: 150 },
      { a: 40, b: 48 },
    ])
    const pWaiting = estimateWinChances(bWaiting, {
      seed: 3,
      trials: 1000,
    }).chances.find((c) => c.playerId === 'b')!.probability
    const pEntered = estimateWinChances(bEntered, {
      seed: 3,
      trials: 1000,
    }).chances.find((c) => c.playerId === 'b')!.probability
    expect(pEntered).toBeGreaterThan(pWaiting)
  })

  it('handles an empty roster without throwing', () => {
    const game = mkGame([], [])
    const est = estimateWinChances(game)
    expect(est.chances).toEqual([])
  })
})
