import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { computeLegacyCard } from '@/domain/legacy'
import type { Game, Player } from '@/domain/types'

import { LegacyCardSvg } from './legacy-card'

function P(id: string, name: string, order: number): Player {
  return { id, name, color: 'violet', order }
}

const game: Game = {
  id: 'g1',
  name: '',
  players: [P('a', 'Ada', 0), P('b', 'Bo', 1)],
  rounds: [{ id: 'r0', index: 0, scores: { a: 200, b: 40 } }],
  settings: { mode: 'host', targetScore: 200 },
  status: 'finished',
  currentRoundIndex: 0,
  winnerId: 'a',
  favorite: false,
  createdAt: 0,
  updatedAt: 0,
  finishedAt: 0,
  rev: 1,
  deletedAt: null,
}

function card() {
  return computeLegacyCard({
    games: [game],
    nights: [],
    name: 'Ada',
    unlockedStickerIds: [],
    totalStickers: 43,
    profile: {},
    now: 0,
  })
}

describe('LegacyCardSvg', () => {
  it('renders an accessible card image', () => {
    const { getByRole } = render(<LegacyCardSvg card={card()} />)
    const svg = getByRole('img')
    expect(svg.getAttribute('aria-label')).toMatch(/Ada/)
    expect(svg.getAttribute('aria-label')).toMatch(/Bronze/)
    expect(svg.getAttribute('aria-label')).toMatch(/level \d+/)
  })

  it('shows the identity, rarity and headline stats', () => {
    const { container } = render(<LegacyCardSvg card={card()} />)
    const text = container.querySelector('svg')?.textContent ?? ''
    expect(text).toContain('Ada')
    expect(text).toContain('BRONZE')
    expect(text).toContain('WINS')
    expect(text).toContain('WIN %')
    expect(text).toContain('100%') // one game, one win
  })

  it('serialises to a standalone SVG for sharing', () => {
    const { container } = render(<LegacyCardSvg card={card()} />)
    const svg = container.querySelector('svg')!
    const serialised = new XMLSerializer().serializeToString(svg)
    expect(serialised.startsWith('<svg')).toBe(true)
    expect(serialised).toContain('http://www.w3.org/2000/svg')
    expect(serialised).toContain('Ada')
  })
})
