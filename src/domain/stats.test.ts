import { describe, expect, it } from 'vitest'

import { computeStats } from './stats'
import type { Game, Player, Round } from './types'

function player(id: string, name: string): Player {
  return { id, name, color: 'red', order: 0 }
}

interface RoundSpec {
  scores: Record<string, number>
  flags?: Record<string, { flip7?: boolean; bust?: boolean }>
}

function round(index: number, spec: RoundSpec): Round {
  return { id: `r${index}`, index, scores: spec.scores, flags: spec.flags }
}

function finishedGame(config: {
  id: string
  players: Player[]
  rounds: Round[]
  winnerId: string
  finishedAt: number
  deletedAt?: number | null
}): Game {
  return {
    id: config.id,
    name: '',
    players: config.players,
    rounds: config.rounds,
    settings: { mode: 'host', targetScore: 50 },
    status: 'finished',
    currentRoundIndex: Math.max(0, config.rounds.length - 1),
    winnerId: config.winnerId,
    favorite: false,
    createdAt: 0,
    updatedAt: config.finishedAt,
    finishedAt: config.finishedAt,
    rev: 1,
    deletedAt: config.deletedAt ?? null,
  }
}

describe('computeStats', () => {
  it('aggregates wins, plays, win% and streaks by player name', () => {
    const a1 = player('a1', 'Ada')
    const b1 = player('b1', 'Bo')
    const a2 = player('a2', 'ada') // different case, same person
    const b2 = player('b2', 'Bo')

    const games = [
      finishedGame({
        id: 'g1',
        players: [a1, b1],
        rounds: [round(0, { scores: { a1: 60, b1: 20 } })],
        winnerId: 'a1',
        finishedAt: 100,
      }),
      finishedGame({
        id: 'g2',
        players: [a2, b2],
        rounds: [round(0, { scores: { a2: 55, b2: 40 } })],
        winnerId: 'a2',
        finishedAt: 200,
      }),
    ]

    const { totalGames, players } = computeStats(games)
    expect(totalGames).toBe(2)
    const ada = players.find((p) => p.name.toLowerCase() === 'ada')!
    expect(ada.gamesPlayed).toBe(2)
    expect(ada.gamesWon).toBe(2)
    expect(ada.winPct).toBe(1)
    expect(ada.longestWinStreak).toBe(2)

    const bo = players.find((p) => p.name === 'Bo')!
    expect(bo.gamesPlayed).toBe(2)
    expect(bo.gamesWon).toBe(0)
    expect(bo.winPct).toBe(0)
  })

  it('computes round extremes, average score and finishing position', () => {
    const a = player('a', 'Ada')
    const b = player('b', 'Bo')
    const games = [
      finishedGame({
        id: 'g1',
        players: [a, b],
        rounds: [
          round(0, { scores: { a: 30, b: 10 } }),
          round(1, { scores: { a: 5, b: 45 } }),
        ],
        winnerId: 'b', // b total 55 > a 35
        finishedAt: 100,
      }),
    ]
    const { players } = computeStats(games)
    const ada = players.find((p) => p.name === 'Ada')!
    expect(ada.highestRound).toBe(30)
    expect(ada.lowestRound).toBe(5)
    expect(ada.averageScore).toBe(35) // one game, total 35
    expect(ada.averageFinish).toBe(2) // came 2nd
  })

  it('counts Flip 7 bonuses and busts from round flags', () => {
    const a = player('a', 'Ada')
    const b = player('b', 'Bo')
    const games = [
      finishedGame({
        id: 'g1',
        players: [a, b],
        rounds: [
          round(0, {
            scores: { a: 43, b: 0 },
            flags: { a: { flip7: true }, b: { bust: true } },
          }),
          round(1, { scores: { a: 10, b: 60 }, flags: { b: { flip7: true } } }),
        ],
        winnerId: 'b',
        finishedAt: 100,
      }),
    ]
    const { players, records } = computeStats(games)
    const ada = players.find((p) => p.name === 'Ada')!
    const bo = players.find((p) => p.name === 'Bo')!
    expect(ada.flip7Count).toBe(1)
    expect(bo.flip7Count).toBe(1)
    expect(bo.bustCount).toBe(1)
    expect(records.mostBusts).toEqual({ name: 'Bo', value: 1 })
  })

  it('ignores unfinished and soft-deleted games', () => {
    const a = player('a', 'Ada')
    const b = player('b', 'Bo')
    const games = [
      finishedGame({
        id: 'g1',
        players: [a, b],
        rounds: [round(0, { scores: { a: 60, b: 10 } })],
        winnerId: 'a',
        finishedAt: 100,
        deletedAt: 500,
      }),
    ]
    expect(computeStats(games).totalGames).toBe(0)
    expect(computeStats([]).players).toEqual([])
  })
})
