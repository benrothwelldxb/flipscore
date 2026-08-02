import { describe, expect, it } from 'vitest'

import { computeNightSummary } from './game-night'
import { buildNightShareSvg, SHARE_WIDTH } from './night-share-card'
import type { Game, GameNight, Player } from './types'

function P(id: string, name: string, order: number): Player {
  return { id, name, color: 'blue', order }
}

const roster = [P('a', 'Ada', 0), P('b', 'Bo', 1)]

const night: GameNight = {
  id: 'n1',
  name: 'Christmas Cup',
  venue: 'The Lodge',
  date: new Date(2026, 11, 25).getTime(),
  players: roster,
  createdAt: 0,
  updatedAt: 0,
  finishedAt: 1,
  rev: 1,
  deletedAt: null,
}

const game: Game = {
  id: 'g1',
  name: '',
  players: roster,
  rounds: [{ id: 'r0', index: 0, scores: { a: 200, b: 40 } }],
  settings: { mode: 'host', targetScore: 200 },
  status: 'finished',
  currentRoundIndex: 0,
  winnerId: 'a',
  favorite: false,
  createdAt: 0,
  updatedAt: 0,
  finishedAt: 1,
  rev: 1,
  deletedAt: null,
  gameNightId: 'n1',
}

describe('buildNightShareSvg', () => {
  const svg = buildNightShareSvg(computeNightSummary(night, [game]))

  it('produces a sized SVG document', () => {
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain(`width="${SHARE_WIDTH}"`)
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
  })

  it('includes the occasion and the champion', () => {
    expect(svg).toContain('Christmas Cup')
    expect(svg).toContain('OVERALL CHAMPION')
    expect(svg).toContain('Ada')
  })

  it('escapes untrusted text', () => {
    const spicy = buildNightShareSvg(
      computeNightSummary({ ...night, name: 'Ben & <Co>' }, [game]),
    )
    expect(spicy).toContain('Ben &amp; &lt;Co&gt;')
    expect(spicy).not.toContain('Ben & <Co>')
  })
})
