import { computeTotals } from './scoring'
import type { Game } from './types'

/**
 * A live "win chance" estimate for an in-progress game. Flip 7 races to a target
 * total, so we Monte-Carlo the rest of the game: repeatedly deal each player
 * sampled round scores until someone reaches the target, and tally who ends up
 * ahead. It is deliberately labelled an *estimate* in the UI — the sampling is a
 * rough model of how rounds tend to go, not a claim about the real deck.
 */

export interface WinChance {
  playerId: string
  name: string
  color: string
  /** Estimated probability of winning, 0..1. */
  probability: number
}

export interface TensionEstimate {
  chances: WinChance[]
  /** How many simulated games backed the estimate. */
  trials: number
  /**
   * Where the round-score samples came from:
   *   'decided' — a player already reached the target; the winner is settled,
   *   'live'    — sampled from scores actually recorded in this game,
   *   'prior'   — too few scores yet, so a generic Flip 7 distribution was used.
   */
  basis: 'decided' | 'live' | 'prior'
}

/** A representative spread of Flip 7 round outcomes, busts (0) included. */
const PRIOR_ROUND_SCORES = [
  0, 0, 0, 6, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20, 22, 24, 27, 32,
]

/** Below this many observed rounds we don't trust the live sample. */
const MIN_LIVE_SAMPLES = 6

/** Deterministic PRNG (mulberry32) so an estimate is stable for a given state. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A stable 32-bit hash of a string (FNV-1a). */
function hashString(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mean(values: number[]): number {
  return values.length ? values.reduce((s, x) => s + x, 0) / values.length : 0
}

/**
 * Pool of round scores to sample from: the game's own rounds, or a generic
 * prior. The live pool is only trusted with enough samples AND a positive mean —
 * a non-positive mean (possible with negative house-rule scores) can never race
 * to the target, which would otherwise spin the simulation up to its guard.
 */
function buildPool(game: Game): {
  pool: number[]
  basis: 'live' | 'prior'
  mean: number
} {
  const observed: number[] = []
  for (const round of game.rounds) {
    for (const value of Object.values(round.scores)) observed.push(value)
  }
  const observedMean = mean(observed)
  if (observed.length >= MIN_LIVE_SAMPLES && observedMean > 0) {
    return { pool: observed, basis: 'live', mean: observedMean }
  }
  return {
    pool: PRIOR_ROUND_SCORES,
    basis: 'prior',
    mean: mean(PRIOR_ROUND_SCORES),
  }
}

/** The current highest total's player id, ties broken by turn order. */
function leaderId(game: Game, totals: Record<string, number>): string {
  const ordered = [...game.players].sort(
    (a, b) => totals[b.id] - totals[a.id] || a.order - b.order,
  )
  return ordered[0]?.id ?? ''
}

export interface TensionOptions {
  trials?: number
  /** Override the RNG seed (defaults to a hash of the current game state). */
  seed?: number
}

/**
 * Estimate each player's chance of winning `game` from its current state.
 * Returns players ordered by descending probability.
 */
export function estimateWinChances(
  game: Game,
  options: TensionOptions = {},
): TensionEstimate {
  const trials = options.trials ?? 1500
  const target = game.settings.targetScore
  const totals = computeTotals(game)
  const players = game.players

  const chancesFor = (
    wins: Record<string, number>,
    denom: number,
    basis: TensionEstimate['basis'],
  ): TensionEstimate => ({
    trials: denom,
    basis,
    chances: players
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        color: p.color,
        probability: denom > 0 ? (wins[p.id] ?? 0) / denom : 0,
      }))
      .sort((a, b) => b.probability - a.probability),
  })

  if (players.length === 0) return chancesFor({}, 0, 'live')

  // Already decided: someone reached the target — the leader has won.
  if (players.some((p) => totals[p.id] >= target)) {
    const winner = leaderId(game, totals)
    return chancesFor({ [winner]: 1 }, 1, 'decided')
  }

  const { pool, basis, mean: poolMean } = buildPool(game)

  // Base each trial on completed rounds only; the in-progress round is finished
  // per-trial using the scores already entered (so entered players aren't dealt
  // a second score for the same round — the mid-round double-count bug).
  const currentIndex = game.currentRoundIndex
  const known = game.rounds[currentIndex]?.scores ?? {}
  const base: Record<string, number> = {}
  for (const p of players) base[p.id] = 0
  game.rounds.forEach((round, index) => {
    if (index === currentIndex) return
    for (const [id, value] of Object.entries(round.scores)) {
      if (id in base) base[id] += value
    }
  })
  for (const p of players) base[p.id] += known[p.id] ?? 0
  const needsSample = players.filter((p) => !(p.id in known))

  const seed =
    options.seed ??
    hashString(game.id) ^
      (game.rounds.length << 8) ^
      players.reduce((s, p) => s + (totals[p.id] ?? 0), 0)
  const rng = mulberry32(seed)
  const sample = () => pool[Math.floor(rng() * pool.length)]

  // Bound the per-trial round count to roughly what's needed to reach the
  // target, so a low-scoring pool can't blow the loop out (poolMean > 0 here).
  const maxCurrent = players.reduce((m, p) => Math.max(m, totals[p.id]), 0)
  const guardCap = Math.min(
    1000,
    Math.max(50, Math.ceil((3 * (target - maxCurrent)) / poolMean) + 10),
  )

  const wins: Record<string, number> = {}
  for (let t = 0; t < trials; t++) {
    const sim: Record<string, number> = { ...base }
    // Finish the current round for players who haven't entered a score yet.
    for (const p of needsSample) sim[p.id] += sample()

    // Then deal full rounds until someone reaches the target.
    let guard = 0
    while (!players.some((p) => sim[p.id] >= target) && guard < guardCap) {
      for (const p of players) sim[p.id] += sample()
      guard++
    }

    // Winner = highest total, ties broken by turn order (players in order).
    let winner = players[0].id
    let best = -Infinity
    for (const p of players) {
      if (sim[p.id] > best) {
        best = sim[p.id]
        winner = p.id
      }
    }
    wins[winner] = (wins[winner] ?? 0) + 1
  }

  return chancesFor(wins, trials, basis)
}
