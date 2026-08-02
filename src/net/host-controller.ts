import { createId } from '@/lib/id'
import type { Game, RoundFlags } from '@/domain/types'

import {
  attachPeer,
  decideJoin,
  decideScore,
  detachPeer,
  seatByPeer,
  type Seat,
} from './host-session'
import { decodeGuestMessage, encode, msg } from './protocol'
import type { PeerLink } from './transport'

/**
 * The host's authoritative connection manager. It owns the live seat table and,
 * for every guest link handed to it by a transport, enforces the rules in
 * {@link host-session} and keeps every peer in sync with the one true game.
 *
 * It never touches a store or a socket directly — the {@link HostBridge} is the
 * only seam to the outside world, which keeps this class unit-testable over the
 * in-process mock link.
 */
export interface HostBridge {
  /** The current authoritative game. */
  get(): Game
  /** Add a roster slot; returns the new player id. */
  addPlayer(name: string, color: string): string
  /** Remove a roster slot (lobby only — before the game starts). */
  removePlayer(playerId: string): void
  /** Apply a validated score to the current round. */
  recordScore(playerId: string, value: number, flags?: RoundFlags): void
}

export interface HostEvents {
  /** Fired whenever the seat table changes (connect / disconnect / join). */
  onSeatsChange?: (seats: Seat[]) => void
}

export class HostController {
  private readonly bridge: HostBridge
  private readonly events: HostEvents
  private seats: Seat[] = []
  private links = new Map<string, PeerLink>()

  constructor(bridge: HostBridge, events: HostEvents = {}) {
    this.bridge = bridge
    this.events = events
  }

  getSeats(): Seat[] {
    return this.seats
  }

  /** Wire up a newly-connected guest link. */
  addPeer(link: PeerLink): void {
    this.links.set(link.id, link)
    link.onMessage((raw) => this.handleMessage(link, raw))
    link.onClose(() => this.handleClose(link.id))
  }

  private handleMessage(link: PeerLink, raw: string): void {
    const message = decodeGuestMessage(raw)
    if (!message) return

    switch (message.t) {
      case 'join':
        this.handleJoin(
          link,
          message.name,
          message.token,
          message.color,
          message.v,
        )
        break
      case 'score':
        this.handleScore(link.id, {
          round: message.round,
          value: message.value,
          flags: message.flags,
        })
        break
      case 'leave':
        this.handleLeave(link.id)
        break
      case 'ping':
        link.send(encode(msg.pong(message.ts)))
        break
    }
  }

  private handleJoin(
    link: PeerLink,
    name: string,
    token: string | undefined,
    color: string | undefined,
    version: number,
  ): void {
    // A repeat join from a peer that already holds a seat is idempotent — just
    // re-confirm it rather than treating it as a new (clashing) player.
    const held = seatByPeer(this.seats, link.id)
    if (held) {
      link.send(
        encode(msg.accepted(held.playerId, held.token, this.bridge.get())),
      )
      return
    }

    const decision = decideJoin(this.seats, this.bridge.get(), {
      version,
      name,
      color,
      token,
    })

    if (decision.type === 'reject') {
      link.send(encode(msg.rejected(decision.reason)))
      // Don't keep a rejected peer around receiving broadcasts.
      link.close()
      this.links.delete(link.id)
      return
    }

    if (decision.type === 'reconnect') {
      // Close any link still mapped to the seat's previous peer before
      // repointing, so a half-open zombie can't linger receiving broadcasts.
      const prevPeer = decision.seat.peerId
      if (prevPeer && prevPeer !== link.id) {
        this.links.get(prevPeer)?.close()
        this.links.delete(prevPeer)
      }
      // Reclaim the existing seat for this (new) peer connection.
      this.seats = attachPeer(this.seats, decision.seat.token, link.id)
      link.send(
        encode(
          msg.accepted(
            decision.seat.playerId,
            decision.seat.token,
            this.bridge.get(),
          ),
        ),
      )
      this.emitSeats()
      return
    }

    // New seat: create the roster slot, then register + accept.
    const playerId = this.bridge.addPlayer(decision.name, decision.color)
    const seat: Seat = { playerId, token: createId(), peerId: link.id }
    this.seats = [...this.seats, seat]
    link.send(encode(msg.accepted(playerId, seat.token, this.bridge.get())))
    // Everyone else needs the new roster.
    this.broadcast(link.id)
    this.emitSeats()
  }

  private handleScore(
    peerId: string,
    req: {
      round: number
      value: number
      flags?: RoundFlags
    },
  ): void {
    const decision = decideScore(this.seats, this.bridge.get(), peerId, req)
    if (decision.type === 'ignore') {
      // Re-sync the stale guest so it converges on the real state.
      if (decision.reason === 'stale-round') this.syncOne(peerId)
      return
    }
    this.bridge.recordScore(decision.playerId, decision.value, decision.flags)
    this.broadcast()
  }

  private handleLeave(peerId: string): void {
    const seat = seatByPeer(this.seats, peerId)
    this.links.get(peerId)?.close()
    this.links.delete(peerId)
    if (!seat) return
    // Leaving the lobby frees the slot; leaving mid-game keeps the seat (and
    // its scores) so the standings stay intact and a reconnect is possible.
    if (this.bridge.get().status === 'setup') {
      this.seats = this.seats.filter((s) => s.token !== seat.token)
      this.bridge.removePlayer(seat.playerId)
      this.broadcast()
    } else {
      this.seats = detachPeer(this.seats, peerId)
    }
    this.emitSeats()
  }

  private handleClose(peerId: string): void {
    this.links.delete(peerId)
    // Retain the seat so the player can reconnect with their token.
    this.seats = detachPeer(this.seats, peerId)
    this.emitSeats()
  }

  /** Push the current game to every *seated* guest (optionally excluding one).
   *  A connected-but-not-yet-joined (or rejected) peer never sees game state. */
  broadcast(except?: string): void {
    const payload = encode(msg.sync(this.bridge.get()))
    for (const [id, link] of this.links) {
      if (id === except || link.state !== 'open') continue
      if (!seatByPeer(this.seats, id)) continue
      link.send(payload)
    }
  }

  private syncOne(peerId: string): void {
    const link = this.links.get(peerId)
    if (link && link.state === 'open')
      link.send(encode(msg.sync(this.bridge.get())))
  }

  /** Remove a seat and its player (host kicks a guest from the lobby). */
  kick(playerId: string): void {
    const seat = this.seats.find((s) => s.playerId === playerId)
    if (!seat) return
    if (seat.peerId) {
      const link = this.links.get(seat.peerId)
      link?.send(encode(msg.bye('kicked')))
      link?.close()
      this.links.delete(seat.peerId)
    }
    this.seats = this.seats.filter((s) => s.token !== seat.token)
    this.emitSeats()
  }

  /** Tell every guest the host is leaving, then tear the links down. */
  close(): void {
    const payload = encode(msg.bye('host-closing'))
    for (const link of this.links.values()) {
      if (link.state === 'open') link.send(payload)
      link.close()
    }
    this.links.clear()
    this.seats = []
  }

  private emitSeats(): void {
    this.events.onSeatsChange?.(this.seats)
  }
}
