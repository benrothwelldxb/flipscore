import type { Game, LeaderboardEntry, Player, Round } from './types'

/** Sum of every recorded score per player across all rounds. */
export function computeTotals(game: Game): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const player of game.players) totals[player.id] = 0
  for (const round of game.rounds) {
    for (const [playerId, value] of Object.entries(round.scores)) {
      if (playerId in totals) totals[playerId] += value
    }
  }
  return totals
}

/** Has any score been entered anywhere in the game yet? */
export function hasAnyScore(game: Game): boolean {
  return game.rounds.some((round) => Object.keys(round.scores).length > 0)
}

/**
 * Players ranked by total (desc), ties broken by turn order. Ties share a
 * rank. The leader flag is only set once at least one score exists, so an
 * all-zero start doesn't mark everyone as leading.
 */
export function computeLeaderboard(game: Game): LeaderboardEntry[] {
  const totals = computeTotals(game)
  const scored = hasAnyScore(game)
  const target = game.settings.targetScore

  const ordered = [...game.players].sort(
    (a, b) => totals[b.id] - totals[a.id] || a.order - b.order,
  )

  const topTotal = ordered.length ? totals[ordered[0].id] : 0

  let rank = 0
  let previousTotal: number | null = null

  return ordered.map((player, index) => {
    const total = totals[player.id]
    if (previousTotal === null || total !== previousTotal) {
      rank = index + 1
      previousTotal = total
    }
    return {
      player,
      total,
      rank,
      isLeader: scored && total === topTotal,
      reachedTarget: total >= target,
    }
  })
}

/** The current single leader, or null if nobody has scored or there's a tie. */
export function getLeader(game: Game): Player | null {
  const leaders = computeLeaderboard(game).filter((e) => e.isLeader)
  return leaders.length === 1 ? leaders[0].player : null
}

/** Every player has entered a score for this round. */
export function isRoundComplete(round: Round, players: Player[]): boolean {
  return players.length > 0 && players.every((p) => p.id in round.scores)
}

/** A game is over once any player's total reaches the target. */
export function isGameOver(game: Game): boolean {
  const totals = computeTotals(game)
  return game.players.some((p) => totals[p.id] >= game.settings.targetScore)
}

/** Winner = highest total (ties resolved by turn order). Null if no scores. */
export function determineWinner(game: Game): string | null {
  if (!hasAnyScore(game)) return null
  const leaderboard = computeLeaderboard(game)
  return leaderboard.length ? leaderboard[0].player.id : null
}
