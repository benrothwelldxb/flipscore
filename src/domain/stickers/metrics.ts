import { normalizeName } from '../analysis'
import { computeLeaderboard, computeTotals } from '../scoring'
import { computeStats } from '../stats'
import type { Game } from '../types'
import type { AchievementMetrics } from './types'

/** All-zero metrics — the starting point and the shape of the object. */
function emptyMetrics(): AchievementMetrics {
  return {
    gamesFinished: 0,
    roundsPlayed: 0,
    distinctPlayers: 0,
    biggestTable: 0,
    connectedGames: 0,
    passGames: 0,
    bestGamesPlayed: 0,
    bestWins: 0,
    bestWinStreak: 0,
    bestFlip7: 0,
    bestBusts: 0,
    totalFlip7: 0,
    totalBusts: 0,
    highestRound: 0,
    highestTotal: 0,
    flawlessWins: 0,
    comebackWins: 0,
    bigComebackWins: 0,
    winsWithBust: 0,
    closeWins: 0,
    lowScoringWins: 0,
    seasonDecember: 0,
    seasonNewYear: 0,
    seasonSummer: 0,
    weekendGames: 0,
    lateNightGames: 0,
    secondChances: 0,
    freezes: 0,
    flipThrees: 0,
  }
}

const CLOSE_MARGIN = 3
const LOW_TOTAL = 120
const BIG_DEFICIT = 40

/**
 * Whether `meId` staged a comeback in this game: at some round they were ranked
 * strictly last, and — separately — whether they ever trailed the leader by a
 * big margin. Walks the rounds cumulatively so it reflects how the game unfolded.
 */
function comeback(
  game: Game,
  meId: string,
): { fromLast: boolean; big: boolean } {
  if (game.players.length < 2) return { fromLast: false, big: false }

  const totals = new Map(game.players.map((p) => [p.id, 0]))
  let fromLast = false
  let big = false

  for (const round of game.rounds) {
    for (const [id, value] of Object.entries(round.scores)) {
      if (totals.has(id)) totals.set(id, (totals.get(id) ?? 0) + value)
    }
    const meTotal = totals.get(meId) ?? 0
    let ahead = 0
    let leaderTotal = meTotal
    for (const [id, total] of totals) {
      if (id === meId) continue
      if (total > meTotal) ahead += 1
      if (total > leaderTotal) leaderTotal = total
    }
    // Ranked last = everyone else is ahead.
    if (ahead === game.players.length - 1) fromLast = true
    if (leaderTotal - meTotal >= BIG_DEFICIT) big = true
  }

  return { fromLast, big }
}

/** Did `id` bust at least once in this game? */
function bustedIn(game: Game, id: string): boolean {
  return game.rounds.some((r) => r.flags?.[id]?.bust === true)
}

/** Local-time facts about when a game finished (falls back to updatedAt). */
function whenFinished(game: Game) {
  const date = new Date(game.finishedAt ?? game.updatedAt)
  const month = date.getMonth() // 0 = Jan … 11 = Dec
  const day = date.getDate()
  const weekday = date.getDay() // 0 = Sun … 6 = Sat
  const hour = date.getHours()
  return {
    december: month === 11,
    newYear: month === 0 && day === 1,
    summer: month >= 5 && month <= 7,
    weekend: weekday === 0 || weekday === 6,
    lateNight: hour >= 0 && hour < 5,
  }
}

/**
 * Reduce the library into the numeric signals the achievement catalog measures
 * against — from the perspective of one player, `meName`. Everything here is
 * personal: *your* wins, *your* Flip 7s and busts, games *you* won, tables *you*
 * sat at. Built on the same primitives as Stats (computeStats, computeLeaderboard,
 * computeTotals) so the album never disagrees with the statistics screen.
 *
 * With no identity (`meName` empty or matching no games) the result is all-zero:
 * an album is personal, so without a "you" there is nothing to earn yet.
 */
export function computeAchievementMetrics(
  games: Game[],
  meName?: string | null,
): AchievementMetrics {
  const m = emptyMetrics()
  const meKey = meName ? normalizeName(meName) : ''
  if (!meKey) return m

  // My career aggregates come straight from the stats engine (name-keyed).
  const me = computeStats(games).players.find(
    (p) => normalizeName(p.name) === meKey,
  )
  if (me) {
    m.bestGamesPlayed = me.gamesPlayed
    m.bestWins = me.gamesWon
    m.bestWinStreak = me.longestWinStreak
    // "best" and "total" collapse to my career count once it's personal.
    m.bestFlip7 = me.flip7Count
    m.totalFlip7 = me.flip7Count
    m.bestBusts = me.bustCount
    m.totalBusts = me.bustCount
    if (me.highestRound != null) m.highestRound = me.highestRound
  }

  const opponents = new Set<string>()
  const finished = games.filter(
    (g) =>
      g.status === 'finished' &&
      !g.deletedAt &&
      g.players.some((p) => normalizeName(p.name) === meKey),
  )
  m.gamesFinished = finished.length

  for (const game of finished) {
    const mePlayer = game.players.find((p) => normalizeName(p.name) === meKey)
    if (!mePlayer) continue
    const meId = mePlayer.id

    m.biggestTable = Math.max(m.biggestTable, game.players.length)
    if (game.settings.mode === 'connected') m.connectedGames += 1
    if (game.settings.mode === 'pass') m.passGames += 1

    for (const p of game.players) {
      const key = normalizeName(p.name)
      if (key && key !== meKey) opponents.add(key)
    }

    // Rounds I actually took part in.
    m.roundsPlayed += game.rounds.filter((r) => meId in r.scores).length

    const totals = computeTotals(game)
    m.highestTotal = Math.max(m.highestTotal, totals[meId] ?? 0)

    // Win-relative facts count only when *I* won.
    if (game.winnerId === meId) {
      const board = computeLeaderboard(game)
      const meTotal = totals[meId] ?? 0
      const second = board.find((e) => e.player.id !== meId)
      const margin = second ? meTotal - second.total : meTotal
      if (margin <= CLOSE_MARGIN) m.closeWins += 1
      if (meTotal <= LOW_TOTAL) m.lowScoringWins += 1

      if (bustedIn(game, meId)) m.winsWithBust += 1
      else m.flawlessWins += 1

      const { fromLast, big } = comeback(game, meId)
      if (fromLast) m.comebackWins += 1
      if (big) m.bigComebackWins += 1
    }

    // My action-card usage.
    for (const round of game.rounds) {
      const f = round.flags?.[meId]
      if (!f) continue
      if (f.secondChance) m.secondChances += 1
      if (f.freeze) m.freezes += 1
      if (f.flipThree) m.flipThrees += 1
    }

    const w = whenFinished(game)
    if (w.december) m.seasonDecember += 1
    if (w.newYear) m.seasonNewYear += 1
    if (w.summer) m.seasonSummer += 1
    if (w.weekend) m.weekendGames += 1
    if (w.lateNight) m.lateNightGames += 1
  }

  m.distinctPlayers = opponents.size

  return m
}
