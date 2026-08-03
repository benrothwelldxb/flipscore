import { beforeEach, describe, expect, it } from 'vitest'

import { resolveIdentityName } from '@/domain/social'
import type { Game } from '@/domain/types'

import { shouldPromptIdentity, useIdentityStore } from './identity-store'

function mkGame(
  id: string,
  scores: Record<string, number>,
  winner: string,
): Game {
  const names = Object.keys(scores)
  return {
    id,
    name: '',
    players: names.map((n, i) => ({ id: n, name: n, color: 'red', order: i })),
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

describe('identity store', () => {
  beforeEach(() => useIdentityStore.setState({ name: null }))

  it('setName trims and normalises empty to null', () => {
    useIdentityStore.getState().setName('  Ada  ')
    expect(useIdentityStore.getState().name).toBe('Ada')
    useIdentityStore.getState().setName('   ')
    expect(useIdentityStore.getState().name).toBeNull()
  })
})

describe('resolveIdentityName', () => {
  const games = [
    mkGame('g1', { Ada: 200, Bo: 10 }, 'Ada'),
    mkGame('g2', { Ada: 200, Bo: 10 }, 'Ada'),
    mkGame('g3', { Bo: 200, Cy: 10 }, 'Bo'),
  ]

  it('prefers an explicit name', () => {
    expect(resolveIdentityName('Cy', games)).toBe('Cy')
  })

  it('falls back to the most-played player', () => {
    // Ada plays 2, Bo plays 3 → Bo is most-played.
    expect(resolveIdentityName(null, games)).toBe('Bo')
  })

  it('is null when there is nothing to infer from', () => {
    expect(resolveIdentityName(null, [])).toBeNull()
  })
})

describe('shouldPromptIdentity', () => {
  const finished = [mkGame('g1', { Ada: 200, Bo: 10 }, 'Ada')]

  it('prompts after a first finished game when nothing is chosen or seen', () => {
    expect(shouldPromptIdentity(finished, null, false)).toBe(true)
  })

  it('does not prompt once seen', () => {
    expect(shouldPromptIdentity(finished, null, true)).toBe(false)
  })

  it('does not prompt when an identity is already chosen', () => {
    expect(shouldPromptIdentity(finished, 'Ada', false)).toBe(false)
  })

  it('does not prompt before any finished game exists', () => {
    const unfinished: Game = { ...finished[0], status: 'playing' }
    expect(shouldPromptIdentity([unfinished], null, false)).toBe(false)
    expect(shouldPromptIdentity([], null, false)).toBe(false)
  })

  it('ignores a deleted finished game', () => {
    const deleted: Game = { ...finished[0], deletedAt: 123 }
    expect(shouldPromptIdentity([deleted], null, false)).toBe(false)
  })
})
