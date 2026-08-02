import { describe, expect, it } from 'vitest'

import { computeStats } from '../stats'
import type { Game, GameMode, Player, Round, RoundFlags } from '../types'
import { computeAchievementMetrics } from './metrics'

function player(name: string, order: number): Player {
  return { id: name, name, color: 'red', order }
}

interface GameOpts {
  players: string[]
  /** One score map per round: playerName → round score. */
  rounds: Record<string, number>[]
  /** roundIndex → playerName → flags. */
  flags?: Record<number, Record<string, RoundFlags>>
  winner: string
  mode?: GameMode
  finishedAt?: number
  deletedAt?: number | null
}

function mkGame(opts: GameOpts): Game {
  const players = opts.players.map((n, i) => player(n, i))
  const rounds: Round[] = opts.rounds.map((scores, index) => ({
    id: `r${index}`,
    index,
    scores,
    flags: opts.flags?.[index],
  }))
  return {
    id: `g-${opts.players.join('-')}-${opts.finishedAt ?? 0}`,
    name: '',
    players,
    rounds,
    settings: { mode: opts.mode ?? 'host', targetScore: 200 },
    status: 'finished',
    currentRoundIndex: rounds.length - 1,
    winnerId: opts.winner,
    favorite: false,
    createdAt: 0,
    updatedAt: opts.finishedAt ?? 0,
    finishedAt: opts.finishedAt ?? 0,
    rev: 1,
    deletedAt: opts.deletedAt ?? null,
  }
}

describe('computeAchievementMetrics', () => {
  it('returns an all-zero object for no games', () => {
    const m = computeAchievementMetrics([])
    for (const value of Object.values(m)) expect(value).toBe(0)
  })

  it('counts games, rounds, totals and highest round', () => {
    const g = mkGame({
      players: ['Ada', 'Bo'],
      rounds: [
        { Ada: 50, Bo: 10 },
        { Ada: 160, Bo: 20 },
      ],
      winner: 'Ada',
    })
    const m = computeAchievementMetrics([g])
    expect(m.gamesFinished).toBe(1)
    expect(m.roundsPlayed).toBe(2)
    expect(m.biggestTable).toBe(2)
    expect(m.distinctPlayers).toBe(2)
    expect(m.highestRound).toBe(160)
    expect(m.highestTotal).toBe(210)
    expect(m.bestWins).toBe(1)
    expect(m.flawlessWins).toBe(1)
    expect(m.winsWithBust).toBe(0)
  })

  it('ignores deleted and unfinished games', () => {
    const finished = mkGame({
      players: ['Ada', 'Bo'],
      rounds: [{ Ada: 200, Bo: 10 }],
      winner: 'Ada',
    })
    const deleted = mkGame({
      players: ['Ada', 'Bo'],
      rounds: [{ Ada: 200, Bo: 10 }],
      winner: 'Ada',
      deletedAt: 1,
    })
    const m = computeAchievementMetrics([finished, deleted])
    expect(m.gamesFinished).toBe(1)
    expect(m.bestWins).toBe(1)
  })

  it('detects a comeback from last place and a big deficit', () => {
    const g = mkGame({
      players: ['Ada', 'Bo'],
      rounds: [
        { Ada: 5, Bo: 60 }, // Ada last, trailing by 55
        { Ada: 200, Bo: 5 }, // Ada storms back to win
      ],
      winner: 'Ada',
    })
    const m = computeAchievementMetrics([g])
    expect(m.comebackWins).toBe(1)
    expect(m.bigComebackWins).toBe(1)
  })

  it('does not flag a wire-to-wire win as a comeback', () => {
    const g = mkGame({
      players: ['Ada', 'Bo'],
      rounds: [
        { Ada: 100, Bo: 10 },
        { Ada: 120, Bo: 30 },
      ],
      winner: 'Ada',
    })
    const m = computeAchievementMetrics([g])
    expect(m.comebackWins).toBe(0)
    expect(m.bigComebackWins).toBe(0)
  })

  it('counts flip 7 and bust flags, and a win that involved a bust', () => {
    const g = mkGame({
      players: ['Ada', 'Bo'],
      rounds: [
        { Ada: 15, Bo: 0 },
        { Ada: 200, Bo: 5 },
      ],
      flags: {
        0: { Ada: { flip7: true }, Bo: { bust: true } },
        1: { Ada: { bust: true } },
      },
      winner: 'Ada',
    })
    const m = computeAchievementMetrics([g])
    expect(m.totalFlip7).toBe(1)
    expect(m.bestFlip7).toBe(1)
    expect(m.totalBusts).toBe(2)
    expect(m.winsWithBust).toBe(1)
    expect(m.flawlessWins).toBe(0)
  })

  it('counts close wins and low-scoring wins', () => {
    const close = mkGame({
      players: ['Ada', 'Bo'],
      rounds: [{ Ada: 201, Bo: 200 }],
      winner: 'Ada',
    })
    const low = mkGame({
      players: ['Cy', 'Di'],
      rounds: [{ Cy: 118, Di: 90 }],
      winner: 'Cy',
    })
    const m = computeAchievementMetrics([close, low])
    expect(m.closeWins).toBe(1)
    expect(m.lowScoringWins).toBe(1)
  })

  it('tracks table size and game modes', () => {
    const big = mkGame({
      players: ['A', 'B', 'C', 'D', 'E', 'F'],
      rounds: [{ A: 200, B: 1, C: 1, D: 1, E: 1, F: 1 }],
      winner: 'A',
      mode: 'connected',
    })
    const pass = mkGame({
      players: ['A', 'B'],
      rounds: [{ A: 200, B: 1 }],
      winner: 'A',
      mode: 'pass',
    })
    const m = computeAchievementMetrics([big, pass])
    expect(m.biggestTable).toBe(6)
    expect(m.connectedGames).toBe(1)
    expect(m.passGames).toBe(1)
  })

  it('counts action-card usage across rounds', () => {
    const g = mkGame({
      players: ['Ada', 'Bo'],
      rounds: [
        { Ada: 30, Bo: 200 },
        { Ada: 200, Bo: 10 },
      ],
      flags: {
        0: { Ada: { secondChance: true }, Bo: { freeze: true } },
        1: { Ada: { flipThree: true }, Bo: { freeze: true } },
      },
      winner: 'Ada',
    })
    const m = computeAchievementMetrics([g])
    expect(m.secondChances).toBe(1)
    expect(m.freezes).toBe(2)
    expect(m.flipThrees).toBe(1)
  })

  it('derives seasonal facts from when a game finished', () => {
    const dec = mkGame({
      players: ['A', 'B'],
      rounds: [{ A: 200, B: 1 }],
      winner: 'A',
      finishedAt: new Date(2026, 11, 25, 14).getTime(), // Christmas Day, afternoon
    })
    const newYear = mkGame({
      players: ['A', 'B'],
      rounds: [{ A: 200, B: 1 }],
      winner: 'A',
      finishedAt: new Date(2026, 0, 1, 2).getTime(), // Jan 1, 2am
    })
    const m = computeAchievementMetrics([dec, newYear])
    expect(m.seasonDecember).toBe(1)
    expect(m.seasonNewYear).toBe(1)
    expect(m.lateNightGames).toBe(1)
  })

  it('agrees with the statistics engine (linkage)', () => {
    const games = [
      mkGame({
        players: ['Ada', 'Bo'],
        rounds: [{ Ada: 200, Bo: 10 }],
        flags: { 0: { Ada: { flip7: true } } },
        winner: 'Ada',
      }),
      mkGame({
        players: ['Ada', 'Bo'],
        rounds: [{ Ada: 200, Bo: 10 }],
        flags: { 0: { Ada: { flip7: true } } },
        winner: 'Ada',
      }),
    ]
    const m = computeAchievementMetrics(games)
    const stats = computeStats(games)
    const maxWins = Math.max(...stats.players.map((p) => p.gamesWon))
    const totalFlip7 = stats.players.reduce((s, p) => s + p.flip7Count, 0)
    expect(m.bestWins).toBe(maxWins)
    expect(m.bestWins).toBe(2)
    expect(m.totalFlip7).toBe(totalFlip7)
    expect(m.distinctPlayers).toBe(stats.players.length)
  })
})
