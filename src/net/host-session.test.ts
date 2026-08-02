import { describe, expect, it } from 'vitest'

import { createGame } from '@/domain/game'
import type { Game, Player } from '@/domain/types'

import {
  attachPeer,
  decideJoin,
  decideScore,
  detachPeer,
  pickColor,
  seatByPeer,
  type Seat,
} from './host-session'
import { PROTOCOL_VERSION } from './protocol'

function player(
  id: string,
  name: string,
  color: string,
  order: number,
): Player {
  return { id, name, color, order }
}

function lobby(players: Player[] = []): Game {
  return { ...createGame('connected', 1), players, rounds: [], status: 'setup' }
}

describe('decideJoin', () => {
  it('rejects an incompatible protocol version', () => {
    const d = decideJoin([], lobby(), {
      version: PROTOCOL_VERSION + 1,
      name: 'Ann',
    })
    expect(d).toEqual({ type: 'reject', reason: 'version' })
  })

  it('accepts a fresh player in the lobby', () => {
    const d = decideJoin([], lobby(), {
      version: PROTOCOL_VERSION,
      name: 'Ann',
    })
    expect(d.type).toBe('new')
    if (d.type === 'new') expect(d.name).toBe('Ann')
  })

  it('rejects a duplicate name case-insensitively', () => {
    const game = lobby([player('p1', 'Ann', 'red', 0)])
    const d = decideJoin([], game, { version: PROTOCOL_VERSION, name: 'ann' })
    expect(d).toEqual({ type: 'reject', reason: 'name-taken' })
  })

  it('rejects a fresh join once the game has started', () => {
    const game = {
      ...lobby([player('p1', 'Ann', 'red', 0)]),
      status: 'playing' as const,
    }
    const d = decideJoin([], game, { version: PROTOCOL_VERSION, name: 'Bo' })
    expect(d).toEqual({ type: 'reject', reason: 'started' })
  })

  it('treats a matching token as a reconnect even mid-game', () => {
    const seat: Seat = { playerId: 'p1', token: 'tok', peerId: null }
    const game = {
      ...lobby([player('p1', 'Ann', 'red', 0)]),
      status: 'playing' as const,
    }
    const d = decideJoin([seat], game, {
      version: PROTOCOL_VERSION,
      name: 'Ann',
      token: 'tok',
    })
    expect(d).toEqual({ type: 'reconnect', seat })
  })

  it('names an empty submission by position', () => {
    const d = decideJoin([], lobby([player('p1', 'Ann', 'red', 0)]), {
      version: PROTOCOL_VERSION,
      name: '   ',
    })
    expect(d.type).toBe('new')
    if (d.type === 'new') expect(d.name).toBe('Player 2')
  })

  it('rejects when the roster is full', () => {
    const players = Array.from({ length: 12 }, (_, i) =>
      player(`p${i}`, `P${i}`, 'red', i),
    )
    const d = decideJoin([], lobby(players), {
      version: PROTOCOL_VERSION,
      name: 'Extra',
    })
    expect(d).toEqual({ type: 'reject', reason: 'full' })
  })
})

describe('pickColor', () => {
  it('honours a free preferred colour', () => {
    expect(pickColor(lobby(), 'blue')).toBe('blue')
  })

  it('falls back to the first unused colour on collision', () => {
    const game = lobby([player('p1', 'Ann', 'red', 0)])
    expect(pickColor(game, 'red')).toBe('orange')
  })

  it('ignores an unknown preferred colour', () => {
    expect(pickColor(lobby(), 'chartreuse')).toBe('red')
  })
})

describe('decideScore', () => {
  const seat: Seat = { playerId: 'p1', token: 'tok', peerId: 'peer-1' }
  const playing: Game = {
    ...lobby([player('p1', 'Ann', 'red', 0)]),
    status: 'playing',
    rounds: [{ id: 'r0', index: 0, scores: {} }],
    currentRoundIndex: 0,
  }

  it('applies a valid score from the seat owner', () => {
    const d = decideScore([seat], playing, 'peer-1', { round: 0, value: 15 })
    expect(d).toEqual({
      type: 'apply',
      playerId: 'p1',
      value: 15,
      flags: undefined,
    })
  })

  it('ignores a score from an unknown peer', () => {
    const d = decideScore([seat], playing, 'ghost', { round: 0, value: 15 })
    expect(d).toEqual({ type: 'ignore', reason: 'unknown-peer' })
  })

  it('ignores a stale round', () => {
    const d = decideScore([seat], playing, 'peer-1', { round: 5, value: 15 })
    expect(d).toEqual({ type: 'ignore', reason: 'stale-round' })
  })

  it('ignores a non-integer or out-of-range score', () => {
    expect(
      decideScore([seat], playing, 'peer-1', { round: 0, value: 1.5 }).type,
    ).toBe('ignore')
    expect(
      decideScore([seat], playing, 'peer-1', { round: 0, value: 1e9 }).type,
    ).toBe('ignore')
  })

  it('ignores scoring before the game is playing', () => {
    const d = decideScore(
      [seat],
      lobby([player('p1', 'Ann', 'red', 0)]),
      'peer-1',
      {
        round: 0,
        value: 15,
      },
    )
    expect(d).toEqual({ type: 'ignore', reason: 'not-playing' })
  })
})

describe('seat table', () => {
  it('attaches and detaches peers by token / peer id', () => {
    let seats: Seat[] = [{ playerId: 'p1', token: 'tok', peerId: null }]
    seats = attachPeer(seats, 'tok', 'peer-9')
    expect(seatByPeer(seats, 'peer-9')?.playerId).toBe('p1')
    seats = detachPeer(seats, 'peer-9')
    expect(seatByPeer(seats, 'peer-9')).toBeUndefined()
    expect(seats[0].peerId).toBeNull()
  })
})
