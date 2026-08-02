import { describe, expect, it } from 'vitest'

import {
  computeHeadToHead,
  computePlayerHistory,
  computeRivalries,
} from './history'
import type { Game, Player } from './types'

function P(id: string, name: string, order: number): Player {
  return { id, name, color: 'red', order }
}

let seq = 0
function mkGame(
  players: Player[],
  rounds: Record<string, number>[],
  winnerId: string,
  finishedAt: number,
): Game {
  seq += 1
  return {
    id: `g${seq}`,
    name: 'Game',
    players,
    rounds: rounds.map((scores, index) => ({
      id: `g${seq}-${index}`,
      index,
      scores,
    })),
    settings: { mode: 'host', targetScore: 200 },
    status: 'finished',
    currentRoundIndex: rounds.length - 1,
    winnerId,
    favorite: false,
    createdAt: 0,
    updatedAt: finishedAt,
    finishedAt,
    rev: 1,
    deletedAt: null,
  }
}

const ada = P('a', 'Ada', 0)
const bo = P('b', 'Bo', 1)

// Ada wins twice, Bo wins once; all three games shared.
const games = [
  mkGame([ada, bo], [{ a: 200, b: 50 }], 'a', 100),
  mkGame([ada, bo], [{ a: 40, b: 200 }], 'b', 200),
  mkGame([ada, bo], [{ a: 200, b: 190 }], 'a', 300),
]

describe('computePlayerHistory', () => {
  const history = computePlayerHistory(games, 'Ada')

  it('builds a chronological timeline and win record', () => {
    expect(history.games).toBe(3)
    expect(history.wins).toBe(2)
    expect(history.timeline.map((t) => t.date)).toEqual([100, 200, 300])
    expect(history.timeline.map((t) => t.won)).toEqual([true, false, true])
  })

  it('captures personal bests', () => {
    expect(history.bests.highestGameTotal).toBe(200)
    expect(history.bests.bestFinish).toBe(1)
    expect(history.bests.longestWinStreak).toBe(1)
    // Won game 3 by 200 - 190 = 10; won game 1 by 150.
    expect(history.bests.largestWinMargin).toBe(150)
  })

  it('marks reached milestones', () => {
    const first = history.milestones.find((m) => m.label === 'First win')
    expect(first?.reached).toBe(true)
    const ten = history.milestones.find((m) => m.label === 'Play 10 games')
    expect(ten?.reached).toBe(false)
  })

  it('lists recent form most-recent-first', () => {
    expect(history.recentForm[0].date).toBe(300)
  })

  it('is empty for an unknown player', () => {
    expect(computePlayerHistory(games, 'Nobody').games).toBe(0)
  })
})

describe('computeHeadToHead', () => {
  it('tallies wins, average finish and the largest margin', () => {
    const h = computeHeadToHead(games, 'Ada', 'Bo')
    expect(h.games).toBe(3)
    expect(h.aWins).toBe(2)
    expect(h.bWins).toBe(1)
    // Biggest gap in any shared game: Bo's 200–40 rout in game 2.
    expect(h.largestMargin).toEqual({ leader: 'Bo', value: 160 })
  })

  it('only counts games both players appeared in', () => {
    const cy = P('c', 'Cy', 0)
    const solo = mkGame([ada, cy], [{ a: 200, c: 10 }], 'a', 400)
    const h = computeHeadToHead([...games, solo], 'Ada', 'Bo')
    expect(h.games).toBe(3)
  })
})

describe('computeRivalries', () => {
  it('ranks opponents by games played together', () => {
    const rivalries = computeRivalries(games, 'Ada')
    expect(rivalries[0].name).toBe('Bo')
    expect(rivalries[0].games).toBe(3)
    expect(rivalries[0].headToHead.aWins).toBe(2)
  })
})
