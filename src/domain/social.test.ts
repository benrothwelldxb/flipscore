import { describe, expect, it } from 'vitest'

import {
  computeIdentityStats,
  emptyIdentityStats,
  headToHeadForFriend,
  parseIdentityStats,
  playerNameOptions,
  rankLeaderboard,
  type LeaderboardEntry,
} from './social'
import type { Game, Player } from './types'

function player(name: string, order: number): Player {
  return { id: name, name, color: 'red', order }
}

/** A finished 2-player game with one round of scores. */
function mkGame(
  id: string,
  scores: Record<string, number>,
  winner: string,
): Game {
  const names = Object.keys(scores)
  return {
    id,
    name: '',
    players: names.map((n, i) => player(n, i)),
    rounds: [{ id: `${id}-r0`, index: 0, scores }],
    settings: { mode: 'host', targetScore: 200 },
    status: 'finished',
    currentRoundIndex: 0,
    winnerId: winner,
    favorite: false,
    createdAt: 0,
    updatedAt: 0,
    finishedAt: 1,
    rev: 1,
    deletedAt: null,
  }
}

const baseInput = {
  nights: [],
  unlockedStickerIds: [],
  totalStickers: 50,
  profile: {},
  now: 1_700_000_000_000,
}

describe('computeIdentityStats', () => {
  it('returns zeros for a name with no games', () => {
    const stats = computeIdentityStats({
      ...baseInput,
      games: [],
      name: 'Nobody',
    })
    expect(stats).toEqual(emptyIdentityStats())
  })

  it('summarises a claimed player’s record', () => {
    const games = [
      mkGame('g1', { Ada: 200, Bo: 30 }, 'Ada'),
      mkGame('g2', { Ada: 210, Bo: 50 }, 'Ada'),
    ]
    const stats = computeIdentityStats({ ...baseInput, games, name: 'Ada' })
    expect(stats.gamesPlayed).toBe(2)
    expect(stats.gamesWon).toBe(2)
    expect(stats.winPct).toBe(1)
    expect(stats.level).toBeGreaterThanOrEqual(1)
  })

  it('matches a name case-insensitively', () => {
    const games = [mkGame('g1', { Ada: 200, Bo: 30 }, 'Ada')]
    const stats = computeIdentityStats({ ...baseInput, games, name: 'ADA' })
    expect(stats.gamesWon).toBe(1)
  })
})

describe('parseIdentityStats', () => {
  it('coerces junk into a safe shape', () => {
    expect(parseIdentityStats(null)).toEqual(emptyIdentityStats())
    const s = parseIdentityStats({ gamesWon: 3, level: 4, highestRound: 88 })
    expect(s.gamesWon).toBe(3)
    expect(s.level).toBe(4)
    expect(s.highestRound).toBe(88)
    expect(s.gamesPlayed).toBe(0)
  })
})

describe('rankLeaderboard', () => {
  function entry(
    name: string,
    gamesWon: number,
    winPct: number,
    isSelf = false,
  ): LeaderboardEntry {
    return {
      accountId: name,
      displayName: name,
      isSelf,
      stats: { ...emptyIdentityStats(), gamesWon, winPct },
    }
  }

  it('ranks by wins, then win rate', () => {
    const ranked = rankLeaderboard([
      entry('Bo', 3, 0.5),
      entry('Ada', 5, 0.6),
      entry('Cy', 5, 0.9),
    ])
    expect(ranked.map((e) => e.displayName)).toEqual(['Cy', 'Ada', 'Bo'])
  })
})

describe('headToHeadForFriend', () => {
  const games = [
    mkGame('g1', { Ada: 200, Bo: 10 }, 'Ada'),
    mkGame('g2', { Ada: 200, Bo: 10 }, 'Ada'),
    mkGame('g3', { Ada: 10, Bo: 200 }, 'Bo'),
  ]

  it('reports your record against a friend from shared games', () => {
    const h2h = headToHeadForFriend('Ada', 'Bo', games)
    expect(h2h).toEqual({ games: 3, mine: 2, theirs: 1 })
  })

  it('matches names case-insensitively', () => {
    expect(headToHeadForFriend('ada', 'BO', games)?.mine).toBe(2)
  })

  it('is null without an identity, a name, or any shared game', () => {
    expect(headToHeadForFriend(null, 'Bo', games)).toBeNull()
    expect(headToHeadForFriend('Ada', '', games)).toBeNull()
    expect(headToHeadForFriend('Ada', 'Nobody', games)).toBeNull()
    expect(headToHeadForFriend('Ada', 'Ada', games)).toBeNull()
  })
})

describe('playerNameOptions', () => {
  it('lists distinct player names, most-played first', () => {
    const games = [
      mkGame('g1', { Ada: 200, Bo: 30 }, 'Ada'),
      mkGame('g2', { Ada: 200, Cy: 30 }, 'Ada'),
    ]
    const names = playerNameOptions(games)
    expect(names[0]).toBe('Ada') // 2 games → first
    expect(new Set(names)).toEqual(new Set(['Ada', 'Bo', 'Cy']))
  })
})
