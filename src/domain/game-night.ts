import {
  comebackWinnerId,
  finishedGames,
  gamePlayerLines,
  stdDev,
} from './analysis'
import type { Game, GameNight, Player } from './types'

/** Aggregate performance for one player across a Game Night's games. */
export interface NightPlayerStat {
  player: Player
  games: number
  wins: number
  points: number
  /** Mean finishing position across games played (lower is better). */
  avgFinish: number
  highestRound: number
  busts: number
  flip7: number
  /** Mean per-round score. */
  avgRound: number
  /** Std-dev of round scores (lower = more consistent). */
  consistency: number
  comebackWins: number
  rounds: number
}

export type AwardKey =
  | 'champion'
  | 'runner-up'
  | 'wooden-spoon'
  | 'highest-round'
  | 'most-busts'
  | 'luckiest'
  | 'most-aggressive'
  | 'most-consistent'
  | 'comeback'
  | 'best-average-finish'

export interface NightAward {
  key: AwardKey
  title: string
  player: Player
  /** Headline value, e.g. "3 wins" or "128 pts". */
  value: string
  caption: string
}

export interface GameNightSummary {
  night: GameNight
  gamesPlayed: number
  /** Players who played ≥1 game, ranked best → worst. */
  standings: NightPlayerStat[]
  awards: NightAward[]
  champion: NightPlayerStat | null
}

interface Acc {
  player: Player
  games: number
  wins: number
  points: number
  finishes: number[]
  roundScores: number[]
  highestRound: number
  busts: number
  flip7: number
  comebackWins: number
}

/** Rank: most wins, then best average finish, then most points, then name. */
function byRanking(a: NightPlayerStat, b: NightPlayerStat): number {
  return (
    b.wins - a.wins ||
    a.avgFinish - b.avgFinish ||
    b.points - a.points ||
    a.player.name.localeCompare(b.player.name)
  )
}

/** Pick the player maximising `select` (ties broken by ranking order). */
function best(
  standings: NightPlayerStat[],
  select: (s: NightPlayerStat) => number,
): NightPlayerStat | null {
  let winner: NightPlayerStat | null = null
  let bestValue = -Infinity
  for (const s of standings) {
    const value = select(s)
    if (value > bestValue) {
      bestValue = value
      winner = s
    }
  }
  return winner && bestValue > -Infinity ? winner : null
}

/**
 * Build the end-of-night summary: per-player standings plus the ten awards.
 * Awards whose metric is zero for everyone (e.g. nobody busted) are omitted.
 */
export function computeNightSummary(
  night: GameNight,
  allGames: Game[],
): GameNightSummary {
  const games = finishedGames(
    allGames.filter((g) => g.gameNightId === night.id),
  )

  const accs = new Map<string, Acc>()
  const rosterById = new Map(night.players.map((p) => [p.id, p]))

  for (const game of games) {
    const lines = gamePlayerLines(game)
    const comebackId = comebackWinnerId(game)
    for (const [id, line] of lines) {
      // Keep the night roster's identity (name/colour/avatar) where we can.
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
          games: 0,
          wins: 0,
          points: 0,
          finishes: [],
          roundScores: [],
          highestRound: 0,
          busts: 0,
          flip7: 0,
          comebackWins: 0,
        }
        accs.set(id, acc)
      }
      acc.games += 1
      if (line.won) acc.wins += 1
      acc.points += line.total
      acc.finishes.push(line.rank)
      acc.roundScores.push(...line.roundScores)
      acc.highestRound = Math.max(acc.highestRound, line.highestRound)
      acc.busts += line.busts
      acc.flip7 += line.flip7
      if (comebackId === id) acc.comebackWins += 1
    }
  }

  const standings: NightPlayerStat[] = [...accs.values()]
    .map((a) => ({
      player: a.player,
      games: a.games,
      wins: a.wins,
      points: a.points,
      avgFinish:
        a.finishes.reduce((s, x) => s + x, 0) / Math.max(1, a.finishes.length),
      highestRound: a.highestRound,
      busts: a.busts,
      flip7: a.flip7,
      avgRound: a.roundScores.length
        ? a.roundScores.reduce((s, x) => s + x, 0) / a.roundScores.length
        : 0,
      consistency: stdDev(a.roundScores),
      comebackWins: a.comebackWins,
      rounds: a.roundScores.length,
    }))
    .sort(byRanking)

  const awards: NightAward[] = []
  const add = (
    key: AwardKey,
    title: string,
    player: Player | null | undefined,
    value: string,
    caption: string,
  ) => {
    if (player) awards.push({ key, title, player, value, caption })
  }

  const champion = standings[0] ?? null
  const runnerUp = standings[1] ?? null
  const spoon = standings.length >= 3 ? standings[standings.length - 1] : null

  add(
    'champion',
    'Overall Champion',
    champion?.player,
    champion ? `${champion.wins} ${champion.wins === 1 ? 'win' : 'wins'}` : '',
    'Top of the table',
  )
  add(
    'runner-up',
    'Runner Up',
    runnerUp?.player,
    runnerUp ? `${runnerUp.wins} ${runnerUp.wins === 1 ? 'win' : 'wins'}` : '',
    'So close',
  )
  add(
    'wooden-spoon',
    'Wooden Spoon',
    spoon?.player,
    spoon ? `avg #${spoon.avgFinish.toFixed(1)}` : '',
    'Better luck next time',
  )

  const highestRound = best(standings, (s) => s.highestRound)
  if (highestRound && highestRound.highestRound > 0)
    add(
      'highest-round',
      'Highest Round',
      highestRound.player,
      `${highestRound.highestRound}`,
      'Biggest single round',
    )

  const mostBusts = best(standings, (s) => s.busts)
  if (mostBusts && mostBusts.busts > 0)
    add(
      'most-busts',
      'Most Busts',
      mostBusts.player,
      `${mostBusts.busts}`,
      'Lived dangerously',
    )

  const luckiest = best(standings, (s) => s.flip7)
  if (luckiest && luckiest.flip7 > 0)
    add(
      'luckiest',
      'Luckiest Player',
      luckiest.player,
      `${luckiest.flip7} Flip 7`,
      'Fortune smiled',
    )

  const aggressive = best(standings, (s) => s.avgRound)
  if (aggressive && aggressive.avgRound > 0)
    add(
      'most-aggressive',
      'Most Aggressive',
      aggressive.player,
      `${aggressive.avgRound.toFixed(1)}/round`,
      'Chased the big numbers',
    )

  // Most consistent = steadiest scorer, among those with enough rounds to judge.
  const consistent = [...standings]
    .filter((s) => s.rounds >= 4)
    .sort((a, b) => a.consistency - b.consistency)[0]
  if (consistent)
    add(
      'most-consistent',
      'Most Consistent',
      consistent.player,
      `±${consistent.consistency.toFixed(1)}`,
      'Metronome',
    )

  const comeback = best(standings, (s) => s.comebackWins)
  if (comeback && comeback.comebackWins > 0)
    add(
      'comeback',
      'Comeback Award',
      comeback.player,
      `${comeback.comebackWins}`,
      'Won from last place',
    )

  const bestFinish = [...standings].sort((a, b) => a.avgFinish - b.avgFinish)[0]
  if (bestFinish)
    add(
      'best-average-finish',
      'Best Average Finish',
      bestFinish.player,
      `#${bestFinish.avgFinish.toFixed(1)}`,
      'Reliably near the top',
    )

  return {
    night,
    gamesPlayed: games.length,
    standings,
    awards,
    champion,
  }
}
