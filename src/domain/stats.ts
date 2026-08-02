import { computeLeaderboard, computeTotals } from './scoring'
import type { Game } from './types'

export interface PlayerStats {
  name: string
  color: string
  gamesPlayed: number
  gamesWon: number
  /** 0..1 */
  winPct: number
  highestRound: number | null
  lowestRound: number | null
  /** Average final total across games, rounded. */
  averageScore: number
  /** Average 1-based finishing position, to one decimal. */
  averageFinish: number | null
  longestWinStreak: number
  flip7Count: number
  bustCount: number
}

export interface StatRecord {
  name: string
  value: number
}

export interface StatsSummary {
  totalGames: number
  players: PlayerStats[]
  records: {
    highestRound?: StatRecord
    longestStreak?: StatRecord
    mostFlip7?: StatRecord
    mostBusts?: StatRecord
  }
}

function normalize(name: string): string {
  return name.trim().toLowerCase()
}

function longestRun(results: boolean[]): number {
  let best = 0
  let current = 0
  for (const won of results) {
    if (won) {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }
  return best
}

function pickMax(
  players: PlayerStats[],
  select: (p: PlayerStats) => number | null,
): StatRecord | undefined {
  let best: StatRecord | undefined
  for (const player of players) {
    const value = select(player)
    if (value == null || value <= 0) continue
    if (!best || value > best.value) best = { name: player.name, value }
  }
  return best
}

interface Accumulator {
  name: string
  color: string
  played: number
  won: number
  totals: number[]
  finishes: number[]
  roundScores: number[]
  flip7: number
  bust: number
  results: boolean[]
}

/** Aggregate player statistics across all finished, non-deleted games. */
export function computeStats(games: Game[]): StatsSummary {
  const finished = games
    .filter((g) => g.status === 'finished' && !g.deletedAt)
    .sort(
      (a, b) => (a.finishedAt ?? a.updatedAt) - (b.finishedAt ?? b.updatedAt),
    )

  const accumulators = new Map<string, Accumulator>()

  for (const game of finished) {
    const totals = computeTotals(game)
    const rankById = new Map(
      computeLeaderboard(game).map((entry) => [entry.player.id, entry.rank]),
    )

    for (const player of game.players) {
      const key = normalize(player.name)
      let acc = accumulators.get(key)
      if (!acc) {
        acc = {
          name: player.name,
          color: player.color,
          played: 0,
          won: 0,
          totals: [],
          finishes: [],
          roundScores: [],
          flip7: 0,
          bust: 0,
          results: [],
        }
        accumulators.set(key, acc)
      }
      // Keep the most recent display name / colour.
      acc.name = player.name
      acc.color = player.color
      acc.played += 1
      const won = game.winnerId === player.id
      if (won) acc.won += 1
      acc.results.push(won)
      acc.totals.push(totals[player.id] ?? 0)
      const rank = rankById.get(player.id)
      if (rank != null) acc.finishes.push(rank)
      for (const round of game.rounds) {
        if (player.id in round.scores) {
          acc.roundScores.push(round.scores[player.id])
        }
        const flags = round.flags?.[player.id]
        if (flags?.flip7) acc.flip7 += 1
        if (flags?.bust) acc.bust += 1
      }
    }
  }

  const players: PlayerStats[] = [...accumulators.values()].map((a) => ({
    name: a.name,
    color: a.color,
    gamesPlayed: a.played,
    gamesWon: a.won,
    winPct: a.played ? a.won / a.played : 0,
    highestRound: a.roundScores.length ? Math.max(...a.roundScores) : null,
    lowestRound: a.roundScores.length ? Math.min(...a.roundScores) : null,
    averageScore: a.totals.length
      ? Math.round(a.totals.reduce((s, x) => s + x, 0) / a.totals.length)
      : 0,
    averageFinish: a.finishes.length
      ? Number(
          (a.finishes.reduce((s, x) => s + x, 0) / a.finishes.length).toFixed(
            1,
          ),
        )
      : null,
    longestWinStreak: longestRun(a.results),
    flip7Count: a.flip7,
    bustCount: a.bust,
  }))

  players.sort(
    (a, b) =>
      b.gamesWon - a.gamesWon ||
      b.winPct - a.winPct ||
      b.gamesPlayed - a.gamesPlayed ||
      a.name.localeCompare(b.name),
  )

  return {
    totalGames: finished.length,
    players,
    records: {
      highestRound: pickMax(players, (p) => p.highestRound),
      longestStreak: pickMax(players, (p) => p.longestWinStreak),
      mostFlip7: pickMax(players, (p) => p.flip7Count),
      mostBusts: pickMax(players, (p) => p.bustCount),
    },
  }
}
