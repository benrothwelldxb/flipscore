import { PLAYER_COLORS } from '@/domain/colors'
import type { Game, RoundFlags } from '@/domain/types'

import { isCompatibleVersion, type RejectReason } from './protocol'

/**
 * Host-side session logic, kept pure so every authority decision — who may
 * join, whether a score is legal, how a reconnect is matched — is unit-testable
 * without a network. The impure controller (net-store) owns the real
 * {@link Game} and the transport; it feeds current state in and applies the
 * decisions these functions return.
 */

export interface Seat {
  /** The roster slot (Game player id) this seat owns. */
  playerId: string
  /** Secret the guest presents to reclaim the seat after a disconnect. */
  token: string
  /** The peer currently occupying the seat, or null while disconnected. */
  peerId: string | null
}

const MAX_PLAYERS = PLAYER_COLORS.length
const MAX_SCORE = 9999

// ---- Seat table (immutable helpers) ---------------------------------------

export function seatByPeer(seats: Seat[], peerId: string): Seat | undefined {
  return seats.find((s) => s.peerId === peerId)
}

export function seatByToken(seats: Seat[], token: string): Seat | undefined {
  return seats.find((s) => s.token === token)
}

export function seatByPlayer(
  seats: Seat[],
  playerId: string,
): Seat | undefined {
  return seats.find((s) => s.playerId === playerId)
}

/** Attach a live peer to the seat holding `token` (reconnect / first connect). */
export function attachPeer(
  seats: Seat[],
  token: string,
  peerId: string,
): Seat[] {
  return seats.map((s) => (s.token === token ? { ...s, peerId } : s))
}

/** Detach whichever seat this peer occupied (disconnect). Seat is retained. */
export function detachPeer(seats: Seat[], peerId: string): Seat[] {
  return seats.map((s) => (s.peerId === peerId ? { ...s, peerId: null } : s))
}

// ---- Join ------------------------------------------------------------------

export interface JoinRequest {
  version: number
  name: string
  color?: string
  token?: string
}

export type JoinDecision =
  | { type: 'reject'; reason: RejectReason }
  /** An existing seat is being reclaimed (reconnect); reuse its identity. */
  | { type: 'reconnect'; seat: Seat }
  /** A brand-new seat should be created with this resolved name + colour. */
  | { type: 'new'; name: string; color: string }

export function decideJoin(
  seats: Seat[],
  game: Game,
  req: JoinRequest,
): JoinDecision {
  if (!isCompatibleVersion(req.version)) {
    return { type: 'reject', reason: 'version' }
  }

  // A presented token that matches a known seat is always a reconnect, even
  // mid-game — that is precisely how a dropped player gets back in.
  if (req.token) {
    const seat = seatByToken(seats, req.token)
    if (seat) return { type: 'reconnect', seat }
  }

  // Fresh joins are only accepted in the lobby (before the game starts).
  if (game.status !== 'setup') {
    return { type: 'reject', reason: 'started' }
  }
  if (game.players.length >= MAX_PLAYERS) {
    return { type: 'reject', reason: 'full' }
  }

  const name = req.name.trim() || `Player ${game.players.length + 1}`
  const clash = game.players.some(
    (p) => p.name.trim().toLowerCase() === name.toLowerCase(),
  )
  if (clash) return { type: 'reject', reason: 'name-taken' }

  return { type: 'new', name, color: pickColor(game, req.color) }
}

/** Choose a palette colour: the preferred one if free, else the first unused. */
export function pickColor(game: Game, preferred?: string): string {
  const taken = new Set(game.players.map((p) => p.color))
  if (preferred && PLAYER_COLORS.some((c) => c.key === preferred)) {
    if (!taken.has(preferred)) return preferred
  }
  const free = PLAYER_COLORS.find((c) => !taken.has(c.key))
  return (free ?? PLAYER_COLORS[game.players.length % PLAYER_COLORS.length]).key
}

// ---- Score -----------------------------------------------------------------

export interface ScoreRequest {
  round: number
  value: number
  flags?: RoundFlags
}

export type ScoreDecision =
  | { type: 'apply'; playerId: string; value: number; flags?: RoundFlags }
  | {
      type: 'ignore'
      reason: 'unknown-peer' | 'not-playing' | 'stale-round' | 'invalid'
    }

export function decideScore(
  seats: Seat[],
  game: Game,
  peerId: string,
  req: ScoreRequest,
): ScoreDecision {
  const seat = seatByPeer(seats, peerId)
  if (!seat) return { type: 'ignore', reason: 'unknown-peer' }
  if (game.status !== 'playing')
    return { type: 'ignore', reason: 'not-playing' }
  if (req.round !== game.currentRoundIndex) {
    return { type: 'ignore', reason: 'stale-round' }
  }
  if (!Number.isInteger(req.value) || Math.abs(req.value) > MAX_SCORE) {
    return { type: 'ignore', reason: 'invalid' }
  }
  return {
    type: 'apply',
    playerId: seat.playerId,
    value: req.value,
    flags: req.flags,
  }
}
