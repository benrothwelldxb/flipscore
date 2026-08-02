import { beforeEach, describe, expect, it } from 'vitest'

import { useGameStore } from './game-store'

function reset() {
  useGameStore.setState({
    games: [],
    activeGameId: null,
    hasHydrated: false,
  })
}

const store = () => useGameStore.getState()

describe('game store', () => {
  beforeEach(reset)

  it('creates a game and marks it active', () => {
    const id = store().createGame('host')
    expect(store().games).toHaveLength(1)
    expect(store().activeGameId).toBe(id)
    expect(store().games[0].players).toHaveLength(2)
  })

  it('adds players up to the max and removes down to the min', () => {
    const id = store().createGame('host')
    for (let i = 0; i < 20; i++) store().addPlayer(id)
    expect(store().games[0].players).toHaveLength(12)

    const players = store().games[0].players
    for (const p of players) store().removePlayer(id, p.id)
    expect(store().games[0].players).toHaveLength(2)
  })

  it('updates a player and reorders', () => {
    const id = store().createGame('host')
    const [p1, p2] = store().games[0].players
    store().updatePlayer(id, p1.id, { name: 'Zoe', color: 'blue' })
    expect(store().games[0].players[0]).toMatchObject({
      name: 'Zoe',
      color: 'blue',
    })

    store().reorderPlayers(id, [p2.id, p1.id])
    expect(store().games[0].players.map((p) => p.id)).toEqual([p2.id, p1.id])
  })

  it('updates settings', () => {
    const id = store().createGame('host')
    store().updateSettings(id, { targetScore: 500 })
    expect(store().games[0].settings.targetScore).toBe(500)
  })

  it('plays through a game to a winner', () => {
    const id = store().createGame('host')
    store().updateSettings(id, { targetScore: 50 })
    store().startGame(id)
    expect(store().games[0].status).toBe('playing')

    const [p1, p2] = store().games[0].players
    store().submitScore(id, p1.id, 60)
    store().submitScore(id, p2.id, 10)
    expect(store().games[0].status).toBe('finished')
    expect(store().games[0].winnerId).toBe(p1.id)
  })

  it('opens the next round', () => {
    const id = store().createGame('host')
    store().startGame(id)
    store().nextRound(id)
    expect(store().games[0].rounds).toHaveLength(2)
    expect(store().games[0].currentRoundIndex).toBe(1)
  })

  it('ends a game manually', () => {
    const id = store().createGame('host')
    store().startGame(id)
    const [, p2] = store().games[0].players
    store().submitScore(id, p2.id, 5)
    store().endGame(id)
    expect(store().games[0].status).toBe('finished')
    expect(store().games[0].winnerId).toBe(p2.id)
  })

  it('deletes a game and clears the active pointer', () => {
    const id = store().createGame('host')
    store().deleteGame(id)
    expect(store().games).toHaveLength(0)
    expect(store().activeGameId).toBeNull()
  })

  it('does not start a game with too few players (guarded)', () => {
    const id = store().createGame('host')
    store().removePlayer(id, store().games[0].players[0].id) // still 2 (min)
    store().startGame(id)
    expect(store().games[0].status).toBe('playing') // 2 is allowed
  })
})
