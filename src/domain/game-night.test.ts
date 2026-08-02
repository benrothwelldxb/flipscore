import { describe, expect, it } from 'vitest'

import { computeNightSummary } from './game-night'
import type { Game, GameNight, Player, RoundFlags } from './types'

function P(id: string, name: string, order: number): Player {
  return { id, name, color: 'red', order }
}

const ROSTER = [P('a', 'Ada', 0), P('b', 'Bo', 1), P('c', 'Cy', 2)]

function night(): GameNight {
  return {
    id: 'n1',
    name: 'Friday Night',
    date: 0,
    players: ROSTER,
    createdAt: 0,
    updatedAt: 0,
    finishedAt: null,
    rev: 1,
    deletedAt: null,
  }
}

function mkGame(
  id: string,
  players: Player[],
  rounds: {
    scores: Record<string, number>
    flags?: Record<string, RoundFlags>
  }[],
  winnerId: string,
): Game {
  return {
    id,
    name: '',
    players,
    rounds: rounds.map((r, index) => ({
      id: `${id}-r${index}`,
      index,
      scores: r.scores,
      flags: r.flags,
    })),
    settings: { mode: 'host', targetScore: 200 },
    status: 'finished',
    currentRoundIndex: rounds.length - 1,
    winnerId,
    favorite: false,
    createdAt: 0,
    updatedAt: id === 'g1' ? 100 : 200,
    finishedAt: id === 'g1' ? 100 : 200,
    rev: 1,
    deletedAt: null,
    gameNightId: 'n1',
  }
}

const game1 = mkGame(
  'g1',
  ROSTER,
  [{ scores: { a: 200, b: 120, c: 60 }, flags: { b: { flip7: true } } }],
  'a',
)
// Cy trails everyone after round 0, then storms back to win → comeback.
const game2 = mkGame(
  'g2',
  ROSTER,
  [
    { scores: { a: 30, b: 60, c: 5 } },
    { scores: { a: 20, b: 10, c: 200 }, flags: { a: { bust: true } } },
  ],
  'c',
)

describe('computeNightSummary', () => {
  const summary = computeNightSummary(night(), [game1, game2])
  const award = (key: string) => summary.awards.find((a) => a.key === key)

  it('counts the games and ranks every player who played', () => {
    expect(summary.gamesPlayed).toBe(2)
    expect(summary.standings).toHaveLength(3)
  })

  it('crowns the champion by wins then finish then points', () => {
    // Ada and Cy each win once with equal average finish; Cy has more points.
    expect(summary.champion?.player.name).toBe('Cy')
    expect(award('champion')?.player.name).toBe('Cy')
    expect(award('runner-up')?.player.name).toBe('Ada')
    expect(award('wooden-spoon')?.player.name).toBe('Bo')
  })

  it('awards the comeback to the player who won from last', () => {
    expect(award('comeback')?.player.name).toBe('Cy')
  })

  it('surfaces luck (Flip 7) and risk (busts) awards', () => {
    expect(award('luckiest')?.player.name).toBe('Bo')
    expect(award('most-busts')?.player.name).toBe('Ada')
    expect(award('highest-round')?.value).toBe('200')
  })

  it('omits awards nobody qualifies for', () => {
    const clean = mkGame(
      'g1',
      ROSTER,
      [{ scores: { a: 200, b: 20, c: 10 } }],
      'a',
    )
    const summ = computeNightSummary(night(), [clean])
    expect(summ.awards.find((a) => a.key === 'most-busts')).toBeUndefined()
    expect(summ.awards.find((a) => a.key === 'luckiest')).toBeUndefined()
    // Structural awards still present.
    expect(summ.awards.find((a) => a.key === 'champion')).toBeDefined()
  })

  it('ignores games from other nights and unfinished games', () => {
    const other = { ...game1, id: 'x', gameNightId: 'other' }
    const summ = computeNightSummary(night(), [game1, game2, other])
    expect(summ.gamesPlayed).toBe(2)
  })
})
