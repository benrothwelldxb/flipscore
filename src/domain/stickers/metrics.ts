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
 * Whether the winner staged a comeback: at some round they were ranked strictly
 * last, and — separately — whether they ever trailed the leader by a big margin.
 * Walks the rounds cumulatively so it reflects how the game actually unfolded.
 */
function comeback(game: Game): { fromLast: boolean; big: boolean } {
  const winnerId = game.winnerId
  if (!winnerId || game.players.length < 2)
    return { fromLast: false, big: false }

  const totals = new Map(game.players.map((p) => [p.id, 0]))
  let fromLast = false
  let big = false

  for (const round of game.rounds) {
    for (const [id, value] of Object.entries(round.scores)) {
      if (totals.has(id)) totals.set(id, (totals.get(id) ?? 0) + value)
    }
    const winnerTotal = totals.get(winnerId) ?? 0
    let ahead = 0
    let leaderTotal = winnerTotal
    for (const [id, total] of totals) {
      if (id === winnerId) continue
      if (total > winnerTotal) ahead += 1
      if (total > leaderTotal) leaderTotal = total
    }
    // Ranked last = everyone else is ahead.
    if (ahead === game.players.length - 1) fromLast = true
    if (leaderTotal - winnerTotal >= BIG_DEFICIT) big = true
  }

  return { fromLast, big }
}

/** Did the winner bust at least once in this game? */
function winnerBusted(game: Game): boolean {
  if (!game.winnerId) return false
  return game.rounds.some((r) => r.flags?.[game.winnerId as string]?.bust)
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
 * Reduce every finished game into the numeric signals the achievement catalog
 * measures against. Built on the same primitives as Stats (computeStats,
 * computeLeaderboard, computeTotals) so the album can never disagree with the
 * statistics screen.
 */
export function computeAchievementMetrics(games: Game[]): AchievementMetrics {
  const m = emptyMetrics()

  // Per-player aggregates come straight from the stats engine.
  const stats = computeStats(games)
  m.distinctPlayers = stats.players.length
  for (const p of stats.players) {
    m.bestGamesPlayed = Math.max(m.bestGamesPlayed, p.gamesPlayed)
    m.bestWins = Math.max(m.bestWins, p.gamesWon)
    m.bestWinStreak = Math.max(m.bestWinStreak, p.longestWinStreak)
    m.bestFlip7 = Math.max(m.bestFlip7, p.flip7Count)
    m.bestBusts = Math.max(m.bestBusts, p.bustCount)
    m.totalFlip7 += p.flip7Count
    m.totalBusts += p.bustCount
    if (p.highestRound != null)
      m.highestRound = Math.max(m.highestRound, p.highestRound)
  }

  const finished = games.filter((g) => g.status === 'finished' && !g.deletedAt)
  m.gamesFinished = finished.length

  for (const game of finished) {
    m.biggestTable = Math.max(m.biggestTable, game.players.length)
    if (game.settings.mode === 'connected') m.connectedGames += 1
    if (game.settings.mode === 'pass') m.passGames += 1

    m.roundsPlayed += game.rounds.filter(
      (r) => Object.keys(r.scores).length > 0,
    ).length

    const totals = computeTotals(game)
    for (const value of Object.values(totals)) {
      m.highestTotal = Math.max(m.highestTotal, value)
    }

    // Winner-relative facts.
    const board = computeLeaderboard(game)
    if (game.winnerId) {
      const winnerTotal = totals[game.winnerId] ?? 0
      const second = board.find((e) => e.player.id !== game.winnerId)
      const margin = second ? winnerTotal - second.total : winnerTotal
      if (margin <= CLOSE_MARGIN) m.closeWins += 1
      if (winnerTotal <= LOW_TOTAL) m.lowScoringWins += 1

      if (winnerBusted(game)) m.winsWithBust += 1
      else m.flawlessWins += 1

      const { fromLast, big } = comeback(game)
      if (fromLast) m.comebackWins += 1
      if (big) m.bigComebackWins += 1
    }

    for (const round of game.rounds) {
      if (!round.flags) continue
      for (const f of Object.values(round.flags)) {
        if (f.secondChance) m.secondChances += 1
        if (f.freeze) m.freezes += 1
        if (f.flipThree) m.flipThrees += 1
      }
    }

    const w = whenFinished(game)
    if (w.december) m.seasonDecember += 1
    if (w.newYear) m.seasonNewYear += 1
    if (w.summer) m.seasonSummer += 1
    if (w.weekend) m.weekendGames += 1
    if (w.lateNight) m.lateNightGames += 1
  }

  return m
}
