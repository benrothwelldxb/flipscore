import { generateAvatar } from '@/domain/avatar/generate'
import { createId } from '@/lib/id'

import { colorForIndex } from './colors'
import { determineWinner, isGameOver } from './scoring'
import {
  DEFAULT_TARGET_SCORE,
  type Game,
  type GameMode,
  type Player,
  type Round,
  type RoundFlags,
} from './types'

/** Merge or clear a player's round flags, dropping empty entries. */
function withFlag(
  existing: Record<string, RoundFlags> | undefined,
  playerId: string,
  flags: RoundFlags | undefined,
): Record<string, RoundFlags> | undefined {
  const next = { ...(existing ?? {}) }
  if (flags && (flags.flip7 || flags.bust)) {
    next[playerId] = flags
  } else {
    delete next[playerId]
  }
  return Object.keys(next).length > 0 ? next : undefined
}

export function createPlayer(order: number, name?: string): Player {
  const id = createId()
  return {
    id,
    name: name ?? `Player ${order + 1}`,
    color: colorForIndex(order).key,
    order,
    avatar: generateAvatar(id),
  }
}

export function createRound(index: number): Round {
  return { id: createId(), index, scores: {} }
}

/** A fresh game in setup, seeded with two players to start editing from. */
export function createGame(mode: GameMode, now: number): Game {
  return {
    id: createId(),
    name: '',
    players: [createPlayer(0), createPlayer(1)],
    rounds: [],
    settings: { mode, targetScore: DEFAULT_TARGET_SCORE },
    status: 'setup',
    currentRoundIndex: 0,
    winnerId: null,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    rev: 1,
    deletedAt: null,
  }
}

// ---- State-machine transforms (pure; the store stamps updatedAt) ----------

/** setup → playing: open the first round. */
export function startGame(game: Game): Game {
  return {
    ...game,
    status: 'playing',
    rounds: [createRound(0)],
    currentRoundIndex: 0,
    winnerId: null,
  }
}

/** Record a player's score for the current round; finishes if target reached. */
export function recordScore(
  game: Game,
  playerId: string,
  value: number,
  flags?: RoundFlags,
): Game {
  const rounds = game.rounds.map((round) =>
    round.index === game.currentRoundIndex
      ? {
          ...round,
          scores: { ...round.scores, [playerId]: value },
          flags: withFlag(round.flags, playerId, flags),
        }
      : round,
  )
  const next: Game = { ...game, rounds }
  if (isGameOver(next)) {
    return { ...next, status: 'finished', winnerId: determineWinner(next) }
  }
  return next
}

/** Open the next round for scoring. */
export function advanceRound(game: Game): Game {
  const nextIndex = game.currentRoundIndex + 1
  return {
    ...game,
    rounds: [...game.rounds, createRound(nextIndex)],
    currentRoundIndex: nextIndex,
  }
}

/** playing → finished, resolving the winner from current totals. */
export function finishGame(game: Game): Game {
  return { ...game, status: 'finished', winnerId: determineWinner(game) }
}

/** Reorder players to match the given id order, re-stamping `order`. */
export function reorderPlayers(game: Game, orderedIds: string[]): Game {
  const byId = new Map(game.players.map((p) => [p.id, p]))
  const reordered = orderedIds
    .map((id, index) => {
      const player = byId.get(id)
      return player ? { ...player, order: index } : null
    })
    .filter((p): p is Player => p !== null)
  // Guard: only apply when the id set matches exactly.
  if (reordered.length !== game.players.length) return game
  return { ...game, players: reordered }
}

/** Re-derive status + winner from current totals (used after edits). */
export function recompute(game: Game): Game {
  if (game.status === 'setup') return game
  if (isGameOver(game)) {
    return { ...game, status: 'finished', winnerId: determineWinner(game) }
  }
  return { ...game, status: 'playing', winnerId: null }
}

/** Edit a single score in any (possibly past) round, then re-derive status. */
export function setRoundScore(
  game: Game,
  roundIndex: number,
  playerId: string,
  value: number,
): Game {
  const rounds = game.rounds.map((round) =>
    round.index === roundIndex
      ? {
          ...round,
          scores: { ...round.scores, [playerId]: value },
          // A manual edit no longer reflects any Card Builder flags.
          flags: withFlag(round.flags, playerId, undefined),
        }
      : round,
  )
  return recompute({ ...game, rounds })
}

/** Delete a round, re-index the rest, and re-derive status. Keeps ≥1 round. */
export function removeRound(game: Game, roundIndex: number): Game {
  if (game.rounds.length <= 1) return game
  const rounds = game.rounds
    .filter((round) => round.index !== roundIndex)
    .map((round, index) => ({ ...round, index }))
  const currentRoundIndex = Math.min(game.currentRoundIndex, rounds.length - 1)
  return recompute({ ...game, rounds, currentRoundIndex })
}

/** Clear a round's scores and reopen it for re-entry. */
export function replayRound(game: Game, roundIndex: number): Game {
  const rounds = game.rounds.map((round) =>
    round.index === roundIndex ? { ...round, scores: {} } : round,
  )
  return {
    ...game,
    rounds,
    currentRoundIndex: roundIndex,
    status: 'playing',
    winnerId: null,
  }
}
