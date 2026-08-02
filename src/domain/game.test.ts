import { describe, expect, it } from 'vitest'

import {
  advanceRound,
  createGame,
  createPlayer,
  finishGame,
  recordScore,
  removeRound,
  reorderPlayers,
  replayRound,
  setRoundScore,
  startGame,
} from './game'

describe('createGame', () => {
  it('creates a setup game with two seeded players and defaults', () => {
    const g = createGame('pass', 1000)
    expect(g.status).toBe('setup')
    expect(g.players).toHaveLength(2)
    expect(g.settings).toEqual({
      mode: 'pass',
      targetScore: 200,
      rules: { flip7Bonus: 15, flip7Count: 7 },
    })
    expect(g.rounds).toEqual([])
    expect(g.createdAt).toBe(1000)
  })

  it('gives seeded players distinct colours and order', () => {
    const g = createGame('host', 0)
    expect(g.players[0].order).toBe(0)
    expect(g.players[1].order).toBe(1)
    expect(g.players[0].color).not.toBe(g.players[1].color)
  })
})

describe('createPlayer', () => {
  it('defaults the name from the order', () => {
    expect(createPlayer(2).name).toBe('Player 3')
  })
  it('accepts an explicit name', () => {
    expect(createPlayer(0, 'Ada').name).toBe('Ada')
  })
})

describe('startGame', () => {
  it('moves to playing and opens the first round', () => {
    const g = startGame(createGame('host', 0))
    expect(g.status).toBe('playing')
    expect(g.rounds).toHaveLength(1)
    expect(g.rounds[0].index).toBe(0)
    expect(g.currentRoundIndex).toBe(0)
  })
})

describe('recordScore', () => {
  it('records a score in the current round', () => {
    const started = startGame(createGame('host', 0))
    const pid = started.players[0].id
    const g = recordScore(started, pid, 42)
    expect(g.rounds[0].scores[pid]).toBe(42)
    expect(g.status).toBe('playing')
  })

  it('finishes the game and sets the winner when the target is reached', () => {
    let g = startGame(createGame('host', 0))
    g.settings = { ...g.settings, targetScore: 50 }
    const [p1, p2] = g.players
    g = recordScore(g, p1.id, 60)
    g = recordScore(g, p2.id, 10)
    expect(g.status).toBe('finished')
    expect(g.winnerId).toBe(p1.id)
  })
})

describe('advanceRound', () => {
  it('opens the next round', () => {
    const g = advanceRound(startGame(createGame('host', 0)))
    expect(g.rounds).toHaveLength(2)
    expect(g.currentRoundIndex).toBe(1)
    expect(g.rounds[1].index).toBe(1)
  })
})

describe('finishGame', () => {
  it('finishes and resolves the winner from totals', () => {
    let g = startGame(createGame('host', 0))
    const [p1, p2] = g.players
    g = recordScore(g, p1.id, 5)
    g = recordScore(g, p2.id, 30)
    const done = finishGame(g)
    expect(done.status).toBe('finished')
    expect(done.winnerId).toBe(p2.id)
  })
})

describe('reorderPlayers', () => {
  it('reorders players and re-stamps order', () => {
    const g = createGame('host', 0)
    const [p1, p2] = g.players
    const reordered = reorderPlayers(g, [p2.id, p1.id])
    expect(reordered.players.map((p) => p.id)).toEqual([p2.id, p1.id])
    expect(reordered.players.map((p) => p.order)).toEqual([0, 1])
  })

  it('ignores an id set that does not match', () => {
    const g = createGame('host', 0)
    expect(reorderPlayers(g, ['nope']).players).toEqual(g.players)
  })
})

describe('round editing', () => {
  it('setRoundScore edits a past round and re-derives the winner', () => {
    let g = startGame(createGame('host', 0))
    g = { ...g, settings: { ...g.settings, targetScore: 50 } }
    const [p1, p2] = g.players
    g = recordScore(g, p1.id, 20)
    g = recordScore(g, p2.id, 10)
    expect(g.status).toBe('playing')

    // Correct p1's round-1 score up to a winning total.
    g = setRoundScore(g, 0, p1.id, 60)
    expect(g.rounds[0].scores[p1.id]).toBe(60)
    expect(g.status).toBe('finished')
    expect(g.winnerId).toBe(p1.id)
  })

  it('setRoundScore can reopen a finished game when lowered below target', () => {
    let g = startGame(createGame('host', 0))
    g = { ...g, settings: { ...g.settings, targetScore: 50 } }
    const [p1] = g.players
    g = recordScore(g, p1.id, 60)
    expect(g.status).toBe('finished')
    g = setRoundScore(g, 0, p1.id, 10)
    expect(g.status).toBe('playing')
    expect(g.winnerId).toBeNull()
  })

  it('removeRound deletes and re-indexes, keeping at least one round', () => {
    let g = advanceRound(advanceRound(startGame(createGame('host', 0)))) // 3 rounds
    expect(g.rounds).toHaveLength(3)
    g = removeRound(g, 1)
    expect(g.rounds).toHaveLength(2)
    expect(g.rounds.map((r) => r.index)).toEqual([0, 1])

    const oneRound = startGame(createGame('host', 0))
    expect(removeRound(oneRound, 0).rounds).toHaveLength(1) // guarded
  })

  it('replayRound clears scores and reopens the round', () => {
    let g = startGame(createGame('host', 0))
    const [p1] = g.players
    g = recordScore(g, p1.id, 10)
    g = advanceRound(g)
    g = replayRound(g, 0)
    expect(g.rounds[0].scores).toEqual({})
    expect(g.currentRoundIndex).toBe(0)
    expect(g.status).toBe('playing')
  })
})
