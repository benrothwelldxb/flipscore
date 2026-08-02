import {
  comebackWinnerId,
  finishedGames,
  gamePlayerLines,
  maxDeficitFaced,
  normalizeName,
  type PlayerGameLine,
} from './analysis'
import type { AvatarConfig, Game, GameMode } from './types'

/** One game on a player's timeline. */
export interface TimelinePoint {
  gameId: string
  date: number
  gameName: string
  rank: number
  playerCount: number
  total: number
  won: boolean
}

export interface PersonalBests {
  highestRound: number
  highestGameTotal: number
  /** Best (lowest) finishing position achieved. */
  bestFinish: number | null
  longestWinStreak: number
  mostFlip7InGame: number
  /** Biggest points gap over the runner-up in a game they won. */
  largestWinMargin: number
}

export interface Milestone {
  label: string
  reached: boolean
  /** Progress numerator when not yet reached (for a subtle hint). */
  current?: number
  target?: number
}

export interface HeadToHead {
  a: string
  b: string
  /** Games both players appeared in. */
  games: number
  /** Times a finished ahead of b, and vice versa. */
  aWins: number
  bWins: number
  aAvgFinish: number | null
  bAvgFinish: number | null
  /** Biggest total gap in a shared game, and who led it. */
  largestMargin: { leader: string; value: number } | null
}

export interface Rivalry {
  name: string
  color: string
  games: number
  headToHead: HeadToHead
}

export interface PlayerHistory {
  name: string
  color: string
  /** Most recent avatar this player was seen with, if any. */
  avatar?: AvatarConfig
  games: number
  wins: number
  winPct: number
  /** Total busts across all games. */
  busts: number
  /** Games won from last place. */
  comebacks: number
  /** Largest points deficit ever overcome to win a game. */
  bestComeback: number
  /** The mode they play most (null if none). */
  favouriteMode: GameMode | null
  timeline: TimelinePoint[]
  bests: PersonalBests
  /** Most recent games first (up to `recentCount`). */
  recentForm: TimelinePoint[]
  milestones: Milestone[]
  rivalries: Rivalry[]
}

/** The line for `name` in a game, or null if they didn't play. */
function lineForName(game: Game, name: string): PlayerGameLine | null {
  const key = normalizeName(name)
  for (const line of gamePlayerLines(game).values()) {
    if (normalizeName(line.name) === key) return line
  }
  return null
}

function longestRun(flags: boolean[]): number {
  let best = 0
  let run = 0
  for (const f of flags) {
    run = f ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

function milestone(label: string, current: number, target: number): Milestone {
  return { label, reached: current >= target, current, target }
}

const RECENT_COUNT = 8

/** Everything the Player History screen needs for one player (by name). */
export function computePlayerHistory(
  games: Game[],
  name: string,
): PlayerHistory {
  const key = normalizeName(name)
  const timeline: TimelinePoint[] = []
  const bests: PersonalBests = {
    highestRound: 0,
    highestGameTotal: 0,
    bestFinish: null,
    longestWinStreak: 0,
    mostFlip7InGame: 0,
    largestWinMargin: 0,
  }
  let color = 'slate'
  let displayName = name
  let avatar: AvatarConfig | undefined
  let busts = 0
  let comebacks = 0
  let bestComeback = 0
  const modeCounts: Record<GameMode, number> = {
    host: 0,
    pass: 0,
    connected: 0,
  }

  for (const game of finishedGames(games)) {
    const lines = gamePlayerLines(game)
    let mine: PlayerGameLine | null = null
    for (const line of lines.values()) {
      if (normalizeName(line.name) === key) {
        mine = line
        break
      }
    }
    if (!mine) continue

    color = mine.color
    displayName = mine.name
    const seated = game.players.find((p) => p.id === mine!.playerId)
    if (seated?.avatar) avatar = seated.avatar
    modeCounts[game.settings.mode] += 1
    busts += mine.busts
    if (comebackWinnerId(game) === mine.playerId) comebacks += 1
    if (mine.won) {
      bestComeback = Math.max(
        bestComeback,
        maxDeficitFaced(game, mine.playerId),
      )
    }
    timeline.push({
      gameId: game.id,
      date: game.finishedAt ?? game.updatedAt,
      gameName: game.name || 'Game',
      rank: mine.rank,
      playerCount: game.players.length,
      total: mine.total,
      won: mine.won,
    })

    bests.highestRound = Math.max(bests.highestRound, mine.highestRound)
    bests.highestGameTotal = Math.max(bests.highestGameTotal, mine.total)
    bests.mostFlip7InGame = Math.max(bests.mostFlip7InGame, mine.flip7)
    bests.bestFinish =
      bests.bestFinish == null
        ? mine.rank
        : Math.min(bests.bestFinish, mine.rank)
    if (mine.won) {
      const others = [...lines.values()].filter(
        (l) => l.playerId !== mine!.playerId,
      )
      const runnerUp = others.reduce((m, l) => Math.max(m, l.total), 0)
      bests.largestWinMargin = Math.max(
        bests.largestWinMargin,
        mine.total - runnerUp,
      )
    }
  }

  bests.longestWinStreak = longestRun(timeline.map((t) => t.won))
  const wins = timeline.filter((t) => t.won).length
  const gamesPlayed = timeline.length

  const milestones: Milestone[] = [
    { label: 'Played first game', reached: gamesPlayed >= 1 },
    { label: 'First win', reached: wins >= 1 },
    milestone('Play 10 games', gamesPlayed, 10),
    milestone('Win 5 games', wins, 5),
    milestone('Play 25 games', gamesPlayed, 25),
    milestone('Win 10 games', wins, 10),
    { label: 'Landed a Flip 7', reached: bests.mostFlip7InGame >= 1 },
    {
      label: '3-win streak',
      reached: bests.longestWinStreak >= 3,
      current: bests.longestWinStreak,
      target: 3,
    },
  ]

  const recentForm = [...timeline].reverse().slice(0, RECENT_COUNT)
  const favouriteMode =
    (Object.entries(modeCounts) as [GameMode, number][])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    name: displayName,
    color,
    avatar,
    games: gamesPlayed,
    wins,
    winPct: gamesPlayed ? wins / gamesPlayed : 0,
    busts,
    comebacks,
    bestComeback,
    favouriteMode,
    timeline,
    bests,
    recentForm,
    milestones,
    rivalries: computeRivalries(games, name),
  }
}

/** Full head-to-head record between two players (by name), over shared games. */
export function computeHeadToHead(
  games: Game[],
  a: string,
  b: string,
): HeadToHead {
  let shared = 0
  let aWins = 0
  let bWins = 0
  const aFinishes: number[] = []
  const bFinishes: number[] = []
  let largestMargin: { leader: string; value: number } | null = null
  let aName = a
  let bName = b

  for (const game of finishedGames(games)) {
    const la = lineForName(game, a)
    const lb = lineForName(game, b)
    if (!la || !lb) continue
    shared += 1
    aName = la.name
    bName = lb.name
    aFinishes.push(la.rank)
    bFinishes.push(lb.rank)
    if (la.rank < lb.rank) aWins += 1
    else if (lb.rank < la.rank) bWins += 1
    const margin = Math.abs(la.total - lb.total)
    if (!largestMargin || margin > largestMargin.value) {
      largestMargin = {
        leader: la.total >= lb.total ? la.name : lb.name,
        value: margin,
      }
    }
  }

  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null

  return {
    a: aName,
    b: bName,
    games: shared,
    aWins,
    bWins,
    aAvgFinish: avg(aFinishes),
    bAvgFinish: avg(bFinishes),
    largestMargin: shared ? largestMargin : null,
  }
}

/** Opponents this player has faced most, with their head-to-head records. */
export function computeRivalries(games: Game[], name: string): Rivalry[] {
  const key = normalizeName(name)
  const opponents = new Map<
    string,
    { name: string; color: string; games: number }
  >()

  for (const game of finishedGames(games)) {
    const lines = [...gamePlayerLines(game).values()]
    if (!lines.some((l) => normalizeName(l.name) === key)) continue
    for (const line of lines) {
      const oppKey = normalizeName(line.name)
      if (oppKey === key) continue
      const existing = opponents.get(oppKey)
      if (existing) {
        existing.games += 1
        existing.name = line.name
        existing.color = line.color
      } else {
        opponents.set(oppKey, { name: line.name, color: line.color, games: 1 })
      }
    }
  }

  return [...opponents.values()]
    .sort((x, y) => y.games - x.games || x.name.localeCompare(y.name))
    .slice(0, 5)
    .map((opp) => ({
      name: opp.name,
      color: opp.color,
      games: opp.games,
      headToHead: computeHeadToHead(games, name, opp.name),
    }))
}
