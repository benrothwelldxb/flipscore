import { describe, expect, it } from 'vitest'

import {
  computeLeaderboard,
  computeTotals,
  determineWinner,
  getLeader,
  hasAnyScore,
  isGameOver,
  isRoundComplete,
} from './scoring'
import type { Game, Player, Round } from './types'

function player(id: string, order: number): Player {
  return { id, name: id.toUpperCase(), color: 'red', order }
}

function round(index: number, scores: Record<string, number>): Round {
  return { id: `r${index}`, index, scores }
}

function game(players: Player[], rounds: Round[], targetScore = 200): Game {
  return {
    id: 'g',
    name: '',
    players,
    rounds,
    settings: { mode: 'host', targetScore },
    status: 'playing',
    currentRoundIndex: Math.max(0, rounds.length - 1),
    winnerId: null,
    favorite: false,
    createdAt: 0,
    updatedAt: 0,
    finishedAt: null,
    rev: 1,
    deletedAt: null,
  }
}

const a = player('a', 0)
const b = player('b', 1)
const c = player('c', 2)

describe('computeTotals', () => {
  it('sums scores across rounds per player', () => {
    const g = game(
      [a, b],
      [round(0, { a: 10, b: 5 }), round(1, { a: 3, b: 20 })],
    )
    expect(computeTotals(g)).toEqual({ a: 13, b: 25 })
  })

  it('treats missing scores as zero', () => {
    const g = game([a, b], [round(0, { a: 10 })])
    expect(computeTotals(g)).toEqual({ a: 10, b: 0 })
  })

  it('ignores scores for unknown players', () => {
    const g = game([a], [round(0, { a: 5, ghost: 99 })])
    expect(computeTotals(g)).toEqual({ a: 5 })
  })
})

describe('hasAnyScore', () => {
  it('is false before any entry', () => {
    expect(hasAnyScore(game([a, b], [round(0, {})]))).toBe(false)
  })
  it('is true once a score exists', () => {
    expect(hasAnyScore(game([a, b], [round(0, { a: 1 })]))).toBe(true)
  })
})

describe('computeLeaderboard', () => {
  it('ranks by total descending', () => {
    const g = game([a, b, c], [round(0, { a: 5, b: 20, c: 12 })])
    const lb = computeLeaderboard(g)
    expect(lb.map((e) => e.player.id)).toEqual(['b', 'c', 'a'])
    expect(lb.map((e) => e.rank)).toEqual([1, 2, 3])
  })

  it('shares a rank for ties and breaks display order by turn order', () => {
    const g = game([a, b, c], [round(0, { a: 10, b: 10, c: 4 })])
    const lb = computeLeaderboard(g)
    expect(lb.map((e) => e.player.id)).toEqual(['a', 'b', 'c'])
    expect(lb.map((e) => e.rank)).toEqual([1, 1, 3])
    expect(lb.filter((e) => e.isLeader).map((e) => e.player.id)).toEqual([
      'a',
      'b',
    ])
  })

  it('marks nobody as leader before any score', () => {
    const lb = computeLeaderboard(game([a, b], [round(0, {})]))
    expect(lb.every((e) => !e.isLeader)).toBe(true)
  })

  it('flags players that reached the target', () => {
    const g = game([a, b], [round(0, { a: 200, b: 50 })], 200)
    const lb = computeLeaderboard(g)
    expect(lb.find((e) => e.player.id === 'a')?.reachedTarget).toBe(true)
    expect(lb.find((e) => e.player.id === 'b')?.reachedTarget).toBe(false)
  })
})

describe('getLeader', () => {
  it('returns the sole leader', () => {
    expect(getLeader(game([a, b], [round(0, { a: 9, b: 3 })]))?.id).toBe('a')
  })
  it('returns null on a tie', () => {
    expect(getLeader(game([a, b], [round(0, { a: 9, b: 9 })]))).toBeNull()
  })
  it('returns null before any score', () => {
    expect(getLeader(game([a, b], [round(0, {})]))).toBeNull()
  })
})

describe('isRoundComplete', () => {
  it('is true only when every player has entered', () => {
    expect(isRoundComplete(round(0, { a: 1, b: 2 }), [a, b])).toBe(true)
    expect(isRoundComplete(round(0, { a: 1 }), [a, b])).toBe(false)
  })
})

describe('isGameOver / determineWinner', () => {
  it('is over when any player reaches the target', () => {
    expect(isGameOver(game([a, b], [round(0, { a: 200, b: 10 })], 200))).toBe(
      true,
    )
    expect(isGameOver(game([a, b], [round(0, { a: 199, b: 10 })], 200))).toBe(
      false,
    )
  })

  it('names the highest total as winner', () => {
    expect(
      determineWinner(game([a, b], [round(0, { a: 210, b: 40 })], 200)),
    ).toBe('a')
  })

  it('has no winner before any score', () => {
    expect(determineWinner(game([a, b], [round(0, {})]))).toBeNull()
  })
})
