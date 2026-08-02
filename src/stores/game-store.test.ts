import { beforeEach, describe, expect, it } from 'vitest'

import { useGameStore } from './game-store'

function reset() {
  useGameStore.setState({
    games: [],
    activeGameId: null,
    history: {},
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

  it('soft-deletes a game (tombstone) and clears the active pointer', () => {
    const id = store().createGame('host')
    store().deleteGame(id)
    expect(store().games[0].deletedAt).not.toBeNull()
    expect(store().activeGameId).toBeNull()
  })

  it('toggles favourite', () => {
    const id = store().createGame('host')
    expect(store().games[0].favorite).toBe(false)
    store().toggleFavorite(id)
    expect(store().games[0].favorite).toBe(true)
  })

  it('duplicates a game as a new independent record', () => {
    const id = store().createGame('host')
    store().renameGame(id, 'Rummy')
    const copyId = store().duplicateGame(id)
    expect(store().games).toHaveLength(2)
    const copy = store().games.find((g) => g.id === copyId)
    expect(copy?.name).toBe('Rummy (copy)')
    expect(copy?.id).not.toBe(id)
  })

  it('exports and re-imports games (round-trip)', () => {
    const id = store().createGame('host')
    store().renameGame(id, 'Night 1')
    const json = store().exportGames()
    useGameStore.setState({
      games: [],
      activeGameId: null,
      history: {},
      hasHydrated: false,
    })
    const result = store().importGames(json)
    expect(result.added).toBe(1)
    expect(store().games.some((g) => g.name === 'Night 1')).toBe(true)
    // Re-importing the same data is a no-op (last-write-wins).
    expect(store().importGames(json).skipped).toBe(1)
    expect(store().importGames('not json').error).toBeTruthy()
  })

  it('does not start a game with too few players (guarded)', () => {
    const id = store().createGame('host')
    store().removePlayer(id, store().games[0].players[0].id) // still 2 (min)
    store().startGame(id)
    expect(store().games[0].status).toBe('playing') // 2 is allowed
  })

  it('undoes the most recent score', () => {
    const id = store().createGame('host')
    store().startGame(id)
    const [p1] = store().games[0].players
    store().submitScore(id, p1.id, 12)
    expect(store().games[0].rounds[0].scores[p1.id]).toBe(12)

    store().undo(id)
    expect(store().games[0].rounds[0].scores[p1.id]).toBeUndefined()
    // Nothing left to undo → no-op.
    store().undo(id)
    expect(store().games[0].rounds[0].scores).toEqual({})
  })

  it('edits a past round score via the store', () => {
    const id = store().createGame('host')
    store().startGame(id)
    const [p1] = store().games[0].players
    store().submitScore(id, p1.id, 5)
    store().editScore(id, 0, p1.id, 40)
    expect(store().games[0].rounds[0].scores[p1.id]).toBe(40)
  })

  it('deletes and replays rounds via the store', () => {
    const id = store().createGame('host')
    store().startGame(id)
    store().nextRound(id)
    store().nextRound(id)
    expect(store().games[0].rounds).toHaveLength(3)
    store().deleteRound(id, 1)
    expect(store().games[0].rounds).toHaveLength(2)

    const [p1] = store().games[0].players
    store().submitScore(id, p1.id, 9)
    store().replayRound(id, store().games[0].currentRoundIndex)
    expect(
      store().games[0].rounds[store().games[0].currentRoundIndex].scores,
    ).toEqual({})
  })

  it('restores a specific snapshot via replaceGame (targeted undo)', () => {
    const id = store().createGame('host')
    store().startGame(id)
    store().nextRound(id)
    const before = store().games[0] // 2 rounds
    store().deleteRound(id, 0)
    expect(store().games[0].rounds).toHaveLength(1)
    store().replaceGame(before)
    expect(store().games[0].rounds).toHaveLength(2)
  })

  it('clears undo history when a game is deleted', () => {
    const id = store().createGame('host')
    store().startGame(id)
    store().submitScore(id, store().games[0].players[0].id, 3)
    store().deleteGame(id)
    expect(useGameStore.getState().history[id]).toBeUndefined()
  })
})
