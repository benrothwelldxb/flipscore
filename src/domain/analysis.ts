import { computeLeaderboard, computeTotals } from './scoring'
import type { Game } from './types'

/**
 * Per-game analysis primitives shared by Game Night summaries and Player
 * History. Built on the same scoring engine as the leaderboard so every derived
 * number agrees with what the game itself showed.
 */

export interface PlayerGameLine {
  playerId: string
  name: string
  color: string
  /** 1-based finishing position (ties share a rank). */
  rank: number
  total: number
  won: boolean
  roundScores: number[]
  busts: number
  flip7: number
  highestRound: number
}

/** Per-player facts for one game, keyed by player id. */
export function gamePlayerLines(game: Game): Map<string, PlayerGameLine> {
  const totals = computeTotals(game)
  const rankById = new Map(
    computeLeaderboard(game).map((e) => [e.player.id, e.rank]),
  )
  const lines = new Map<string, PlayerGameLine>()

  for (const p of game.players) {
    const roundScores: number[] = []
    let busts = 0
    let flip7 = 0
    for (const round of game.rounds) {
      if (p.id in round.scores) roundScores.push(round.scores[p.id])
      const f = round.flags?.[p.id]
      if (f?.bust) busts += 1
      if (f?.flip7) flip7 += 1
    }
    lines.set(p.id, {
      playerId: p.id,
      name: p.name,
      color: p.color,
      rank: rankById.get(p.id) ?? game.players.length,
      total: totals[p.id] ?? 0,
      won: game.winnerId === p.id,
      roundScores,
      busts,
      flip7,
      highestRound: roundScores.length ? Math.max(...roundScores) : 0,
    })
  }
  return lines
}

/**
 * The winner's id if they were ranked strictly last (everyone else ahead) at
 * some point during the game — i.e. they staged a comeback — else null.
 */
export function comebackWinnerId(game: Game): string | null {
  const winnerId = game.winnerId
  if (!winnerId || game.players.length < 2) return null

  const totals = new Map(game.players.map((p) => [p.id, 0]))
  let fromLast = false

  for (const round of game.rounds) {
    for (const [id, value] of Object.entries(round.scores)) {
      if (totals.has(id)) totals.set(id, (totals.get(id) ?? 0) + value)
    }
    const winnerTotal = totals.get(winnerId) ?? 0
    let ahead = 0
    for (const [id, total] of totals) {
      if (id !== winnerId && total > winnerTotal) ahead += 1
    }
    if (ahead === game.players.length - 1) fromLast = true
  }
  return fromLast ? winnerId : null
}

/** Population standard deviation — our "consistency" measure (lower = steadier). */
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((s, x) => s + x, 0) / values.length
  const variance =
    values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/** Finished, non-deleted games, oldest first (by finish time). */
export function finishedGames(games: Game[]): Game[] {
  return games
    .filter((g) => g.status === 'finished' && !g.deletedAt)
    .sort(
      (a, b) => (a.finishedAt ?? a.updatedAt) - (b.finishedAt ?? b.updatedAt),
    )
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}
