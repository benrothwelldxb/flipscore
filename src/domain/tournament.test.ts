import { describe, expect, it } from 'vitest'

import {
  LEAGUE_PRESETS,
  computeLeagueTable,
  type LeagueConfig,
} from './tournament'
import type { Game, Player, RoundFlags } from './types'

function P(id: string, name: string, order: number): Player {
  return { id, name, color: 'red', order }
}

const ROSTER = [P('a', 'Ada', 0), P('b', 'Bo', 1), P('c', 'Cy', 2)]

function mkGame(
  id: string,
  players: Player[],
  scores: Record<string, number>,
  winnerId: string,
  flags?: Record<string, RoundFlags>,
  overrides: Partial<Game> = {},
): Game {
  return {
    id,
    name: '',
    players,
    rounds: [{ id: `${id}-r0`, index: 0, scores, flags }],
    settings: { mode: 'host', targetScore: 200 },
    status: 'finished',
    currentRoundIndex: 0,
    winnerId,
    favorite: false,
    createdAt: 0,
    updatedAt: 100,
    finishedAt: 100,
    rev: 1,
    deletedAt: null,
    ...overrides,
  }
}

describe('computeLeagueTable', () => {
  it('awards podium points and ranks by total points', () => {
    const g1 = mkGame('g1', ROSTER, { a: 200, b: 120, c: 60 }, 'a')
    const g2 = mkGame('g2', ROSTER, { a: 50, b: 200, c: 90 }, 'b')

    const table = computeLeagueTable([g1, g2], LEAGUE_PRESETS.podium, ROSTER)

    const ada = table.find((r) => r.player.id === 'a')!
    const bo = table.find((r) => r.player.id === 'b')!
    const cy = table.find((r) => r.player.id === 'c')!

    // Ada: 1st (3) + 3rd (1) = 4. Bo: 2nd (2) + 1st (3) = 5. Cy: 3rd+2nd = 3.
    expect(bo.points).toBe(5)
    expect(ada.points).toBe(4)
    expect(cy.points).toBe(3)
    expect(table[0].player.id).toBe('b')
    expect(table.map((r) => r.position)).toEqual([1, 2, 3])
    expect(bo.wins).toBe(1)
    expect(ada.wins).toBe(1)
    expect(ada.played).toBe(2)
  })

  it('shares a position when points, wins and average finish tie', () => {
    // Mirror-image results: Ada and Bo each win one and place 2nd once.
    const g1 = mkGame('g1', ROSTER, { a: 200, b: 120, c: 60 }, 'a')
    const g2 = mkGame('g2', ROSTER, { a: 120, b: 200, c: 60 }, 'b')
    const table = computeLeagueTable([g1, g2], LEAGUE_PRESETS.podium, ROSTER)
    const ada = table.find((r) => r.player.id === 'a')!
    const bo = table.find((r) => r.player.id === 'b')!
    expect(ada.points).toBe(bo.points)
    expect(ada.position).toBe(bo.position)
    expect(ada.position).toBe(1)
    // Cy is alone in the lower position (both leaders share 1).
    expect(table.find((r) => r.player.id === 'c')!.position).toBe(3)
  })

  it('applies flip7 and win bonuses', () => {
    const config: LeagueConfig = {
      pointsByRank: [3, 2, 1],
      flip7Bonus: 2,
      winBonus: 5,
    }
    const g1 = mkGame('g1', ROSTER, { a: 200, b: 120, c: 60 }, 'a', {
      a: { flip7: true },
      b: { flip7: true },
    })
    const table = computeLeagueTable([g1], config, ROSTER)
    const ada = table.find((r) => r.player.id === 'a')!
    // 1st (3) + win bonus (5) + 1 flip7 (2) = 10.
    expect(ada.points).toBe(10)
    expect(ada.flip7).toBe(1)
    // Bo: 2nd (2) + 1 flip7 (2) = 4, no win bonus.
    expect(table.find((r) => r.player.id === 'b')!.points).toBe(4)
  })

  it('ignores unfinished and deleted games', () => {
    const finished = mkGame('g1', ROSTER, { a: 200, b: 120, c: 60 }, 'a')
    const playing = mkGame('g2', ROSTER, { a: 10 }, 'a', undefined, {
      status: 'playing',
      finishedAt: null,
    })
    const deleted = mkGame('g3', ROSTER, { a: 200 }, 'a', undefined, {
      deletedAt: 5,
    })
    const table = computeLeagueTable(
      [finished, playing, deleted],
      LEAGUE_PRESETS.podium,
      ROSTER,
    )
    expect(table.find((r) => r.player.id === 'a')!.played).toBe(1)
  })

  it('winner-takes-all only rewards first place', () => {
    const g1 = mkGame('g1', ROSTER, { a: 200, b: 120, c: 60 }, 'a')
    const table = computeLeagueTable([g1], LEAGUE_PRESETS.winner, ROSTER)
    expect(table.find((r) => r.player.id === 'a')!.points).toBe(1)
    expect(table.find((r) => r.player.id === 'b')!.points).toBe(0)
  })

  it('returns an empty table when there are no finished games', () => {
    expect(computeLeagueTable([], LEAGUE_PRESETS.podium)).toEqual([])
  })
})
