import { finishedGames, gamePlayerLines } from './analysis'
import type { Game, Player } from './types'

/**
 * League tables for a set of games — the natural "tournament" shape for a
 * multiplayer card game, where a knockout bracket doesn't fit. Each finished
 * game awards points by finishing position; totals across the games rank the
 * table. Works over any game set: a single Game Night, or a whole season.
 */

export type LeaguePreset = 'podium' | 'f1' | 'winner'

export interface LeagueConfig {
  /** Points awarded by finishing position (index 0 = 1st). Positions past the
   *  array's end score 0. Tied players share a rank and each get its points. */
  pointsByRank: number[]
  /** Bonus points per Flip 7 hit across the games (0 disables). */
  flip7Bonus: number
  /** Bonus points for winning a game (added on top of 1st-place points). */
  winBonus: number
}

export const LEAGUE_PRESETS: Record<LeaguePreset, LeagueConfig> = {
  // Simple 3-2-1 for the top three — friendly for casual nights.
  podium: { pointsByRank: [3, 2, 1], flip7Bonus: 0, winBonus: 0 },
  // F1-style: rewards showing up well across a longer series.
  f1: {
    pointsByRank: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
    flip7Bonus: 0,
    winBonus: 0,
  },
  // Only the win counts.
  winner: { pointsByRank: [1], flip7Bonus: 0, winBonus: 0 },
}

export const LEAGUE_PRESET_LABELS: Record<LeaguePreset, string> = {
  podium: 'Podium (3-2-1)',
  f1: 'Grand Prix (25-18-15…)',
  winner: 'Winner takes all',
}

export interface LeagueRow {
  player: Player
  played: number
  wins: number
  /** Top-three finishes. */
  podiums: number
  points: number
  /** Best (lowest) finishing position achieved. */
  bestFinish: number
  /** Mean finishing position (lower is better). */
  avgFinish: number
  flip7: number
  /** 1-based table position; tied rows share a position. */
  position: number
}

interface Acc {
  player: Player
  played: number
  wins: number
  podiums: number
  points: number
  bestFinish: number
  finishes: number[]
  flip7: number
}

/** Points for a 1-based finishing rank under a config (0 past the table). */
function pointsForRank(config: LeagueConfig, rank: number): number {
  return config.pointsByRank[rank - 1] ?? 0
}

/** League order: points, then wins, then average finish, then name. */
function byLeague(a: LeagueRow, b: LeagueRow): number {
  return (
    b.points - a.points ||
    b.wins - a.wins ||
    a.avgFinish - b.avgFinish ||
    a.player.name.localeCompare(b.player.name)
  )
}

/**
 * Build a league table across `allGames` (only finished, non-deleted games
 * count). Pass `roster` to keep canonical player identity (name/colour/avatar)
 * where a player's id appears; otherwise identity is taken from each game.
 */
export function computeLeagueTable(
  allGames: Game[],
  config: LeagueConfig = LEAGUE_PRESETS.podium,
  roster: Player[] = [],
): LeagueRow[] {
  const games = finishedGames(allGames)
  const rosterById = new Map(roster.map((p) => [p.id, p]))
  const accs = new Map<string, Acc>()

  for (const game of games) {
    for (const [id, line] of gamePlayerLines(game)) {
      const player: Player = rosterById.get(id) ?? {
        id: line.playerId,
        name: line.name,
        color: line.color,
        order: 0,
      }
      let acc = accs.get(id)
      if (!acc) {
        acc = {
          player,
          played: 0,
          wins: 0,
          podiums: 0,
          points: 0,
          bestFinish: Infinity,
          finishes: [],
          flip7: 0,
        }
        accs.set(id, acc)
      }
      acc.played += 1
      if (line.won) acc.wins += 1
      if (line.rank <= 3) acc.podiums += 1
      acc.points +=
        pointsForRank(config, line.rank) +
        line.flip7 * config.flip7Bonus +
        (line.won ? config.winBonus : 0)
      acc.bestFinish = Math.min(acc.bestFinish, line.rank)
      acc.finishes.push(line.rank)
      acc.flip7 += line.flip7
    }
  }

  const rows: LeagueRow[] = [...accs.values()]
    .map((a) => ({
      player: a.player,
      played: a.played,
      wins: a.wins,
      podiums: a.podiums,
      points: a.points,
      bestFinish: a.bestFinish === Infinity ? 0 : a.bestFinish,
      avgFinish:
        a.finishes.reduce((s, x) => s + x, 0) / Math.max(1, a.finishes.length),
      flip7: a.flip7,
      position: 0,
    }))
    .sort(byLeague)

  // Assign 1-based positions; identical points+wins+avgFinish share a position.
  let position = 0
  let prevKey: string | null = null
  rows.forEach((row, index) => {
    // Exact key (no rounding) so rows the sort ordered apart never share a
    // position — equal floats stringify identically, so no epsilon is needed.
    const key = `${row.points}|${row.wins}|${row.avgFinish}`
    if (key !== prevKey) {
      position = index + 1
      prevKey = key
    }
    row.position = position
  })

  return rows
}
