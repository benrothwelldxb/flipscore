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

describe('computeAchievementMetrics (personal to "you")', () => {
  it('returns all-zero for no games', () => {
    const m = computeAchievementMetrics([])
    for (const value of Object.values(m)) expect(value).toBe(0)
  })

  it('returns all-zero when no identity is given', () => {
    const g = mkGame({
      players: ['Ada', 'Bo'],
      rounds: [{ Ada: 200, Bo: 10 }],
      winner: 'Ada',
    })
    const m = computeAchievementMetrics([g]) // no "me"
    for (const value of Object.values(m)) expect(value).toBe(0)
  })

  it('counts only your games, rounds, totals and highest round', () => {
    const g = mkGame({
      players: ['Ada', 'Bo'],
      rounds: [
        { Ada: 50, Bo: 10 },
        { Ada: 160, Bo: 20 },
      ],
      winner: 'Ada',
    })
    const m = computeAchievementMetrics([g], 'Ada')
    expect(m.gamesFinished).toBe(1)
    expect(m.roundsPlayed).toBe(2)
    expect(m.biggestTable).toBe(2)
    expect(m.distinctPlayers).toBe(1) // opponents only (Bo)
    expect(m.highestRound).toBe(160)
    expect(m.highestTotal).toBe(210)
    expect(m.bestWins).toBe(1)
    expect(m.flawlessWins).toBe(1)
    expect(m.winsWithBust).toBe(0)
  })

  it('is case-insensitive on the identity name', () => {
    const g = mkGame({
      players: ['Ada', 'Bo'],
      rounds: [{ Ada: 200, Bo: 10 }],
      winner: 'Ada',
    })
    expect(computeAchievementMetrics([g], 'ADA').bestWins).toBe(1)
  })

  it('does not credit you for another player’s achievements', () => {
    const g = mkGame({
      players: ['Ada', 'Bo'],
      rounds: [{ Ada: 10, Bo: 200 }],
      flags: { 0: { Bo: { flip7: true } } },
      winner: 'Bo',
    })
    // From Ada's perspective: she played, but Bo's win and Flip 7 aren't hers.
    const m = computeAchievementMetrics([g], 'Ada')
    expect(m.gamesFinished).toBe(1)
    expect(m.bestWins).toBe(0)
    expect(m.totalFlip7).toBe(0)
    expect(m.flawlessWins).toBe(0)
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
    const m = computeAchievementMetrics([finished, deleted], 'Ada')
    expect(m.gamesFinished).toBe(1)
    expect(m.bestWins).toBe(1)
  })

  it('detects your comeback from last place and a big deficit', () => {
    const g = mkGame({
      players: ['Ada', 'Bo'],
      rounds: [
        { Ada: 5, Bo: 60 }, // Ada last, trailing by 55
        { Ada: 200, Bo: 5 }, // Ada storms back to win
      ],
      winner: 'Ada',
    })
    const m = computeAchievementMetrics([g], 'Ada')
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
    const m = computeAchievementMetrics([g], 'Ada')
    expect(m.comebackWins).toBe(0)
    expect(m.bigComebackWins).toBe(0)
  })

  it('counts your flip 7s and busts, and a win where you busted', () => {
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
    const m = computeAchievementMetrics([g], 'Ada')
    expect(m.totalFlip7).toBe(1)
    expect(m.bestFlip7).toBe(1)
    expect(m.totalBusts).toBe(1) // Ada's bust only, not Bo's
    expect(m.winsWithBust).toBe(1)
    expect(m.flawlessWins).toBe(0)
  })

  it('counts your close wins and low-scoring wins', () => {
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
    expect(computeAchievementMetrics([close], 'Ada').closeWins).toBe(1)
    expect(computeAchievementMetrics([close], 'Ada').lowScoringWins).toBe(0)
    expect(computeAchievementMetrics([low], 'Cy').lowScoringWins).toBe(1)
  })

  it('tracks the biggest table you sat at and your game modes', () => {
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
    const m = computeAchievementMetrics([big, pass], 'A')
    expect(m.biggestTable).toBe(6)
    expect(m.connectedGames).toBe(1)
    expect(m.passGames).toBe(1)
  })

  it('counts only your action-card usage', () => {
    const g = mkGame({
      players: ['Ada', 'Bo'],
      rounds: [
        { Ada: 30, Bo: 200 },
        { Ada: 200, Bo: 10 },
      ],
      flags: {
        0: { Ada: { secondChance: true, freeze: true }, Bo: { freeze: true } },
        1: { Ada: { flipThree: true, freeze: true } },
      },
      winner: 'Ada',
    })
    const m = computeAchievementMetrics([g], 'Ada')
    expect(m.secondChances).toBe(1)
    expect(m.freezes).toBe(2) // Ada's two freezes, not Bo's
    expect(m.flipThrees).toBe(1)
  })

  it('derives seasonal facts from your games', () => {
    const dec = mkGame({
      players: ['A', 'B'],
      rounds: [{ A: 200, B: 1 }],
      winner: 'A',
      finishedAt: new Date(2026, 11, 25, 14).getTime(), // Christmas afternoon
    })
    const newYear = mkGame({
      players: ['A', 'B'],
      rounds: [{ A: 200, B: 1 }],
      winner: 'A',
      finishedAt: new Date(2026, 0, 1, 2).getTime(), // Jan 1, 2am
    })
    const m = computeAchievementMetrics([dec, newYear], 'A')
    expect(m.seasonDecember).toBe(1)
    expect(m.seasonNewYear).toBe(1)
    expect(m.lateNightGames).toBe(1)
  })

  it('agrees with the statistics engine for the same player (linkage)', () => {
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
    const m = computeAchievementMetrics(games, 'Ada')
    const stats = computeStats(games)
    const ada = stats.players.find((p) => p.name === 'Ada')
    expect(ada).toBeDefined()
    expect(m.bestWins).toBe(ada?.gamesWon)
    expect(m.bestWins).toBe(2)
    expect(m.totalFlip7).toBe(ada?.flip7Count)
    expect(m.distinctPlayers).toBe(1) // just Bo
  })
})
