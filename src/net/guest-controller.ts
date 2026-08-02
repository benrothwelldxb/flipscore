import { migrateGame } from '@/domain/migrate'
import type { Game, RoundFlags } from '@/domain/types'

import { decodeHostMessage, encode, msg, type RejectReason } from './protocol'
import type { PeerLink } from './transport'

/**
 * The guest's view of a Connected game. It sends a join (with a reconnect token
 * when it has one), keeps a read-only replica in sync from the host's
 * broadcasts, and forwards the player's own score requests. It holds a single
 * link; reconnection is orchestrated one level up (the net-store re-runs the
 * transport and constructs a fresh controller with the saved token).
 */
export interface GuestBridge {
  setSnapshot(game: Game): void
}

export type GuestStatus =
  'joining' | 'joined' | 'rejected' | 'ended' | 'kicked' | 'disconnected'

export interface GuestIdentity {
  playerId: string
  token: string
}

export interface GuestProfile {
  name: string
  color?: string
  token?: string
}

export interface GuestEvents {
  onStatus?: (status: GuestStatus, reason?: RejectReason) => void
  onIdentity?: (identity: GuestIdentity) => void
}

export class GuestController {
  private readonly link: PeerLink
  private readonly profile: GuestProfile
  private readonly bridge: GuestBridge
  private readonly events: GuestEvents
  private identity: GuestIdentity | null = null
  /** Set once the host has ended/kicked/rejected us — a later socket close
   *  must not downgrade that explicit reason to a plain disconnect. */
  private terminal = false

  constructor(
    link: PeerLink,
    profile: GuestProfile,
    bridge: GuestBridge,
    events: GuestEvents = {},
  ) {
    this.link = link
    this.profile = profile
    this.bridge = bridge
    this.events = events
    // onOpen fires immediately when the link is already open, so this covers
    // both the connecting and already-open cases with a single join.
    link.onOpen(() => this.sendJoin())
    link.onMessage((raw) => this.handleMessage(raw))
    link.onClose(() => {
      if (!this.terminal) this.events.onStatus?.('disconnected')
    })
  }

  private sendJoin(): void {
    this.events.onStatus?.('joining')
    const token = this.profile.token ?? this.identity?.token
    this.link.send(
      encode(msg.join(this.profile.name, token, this.profile.color)),
    )
  }

  private handleMessage(raw: string): void {
    const message = decodeHostMessage(raw)
    if (!message) return
    switch (message.t) {
      case 'accepted':
        this.identity = { playerId: message.playerId, token: message.token }
        this.events.onIdentity?.(this.identity)
        this.bridge.setSnapshot(migrateGame(message.snapshot))
        this.events.onStatus?.('joined')
        break
      case 'sync':
        this.bridge.setSnapshot(migrateGame(message.snapshot))
        break
      case 'rejected':
        this.terminal = true
        this.events.onStatus?.('rejected', message.reason)
        break
      case 'bye':
        this.terminal = true
        this.events.onStatus?.(message.reason === 'kicked' ? 'kicked' : 'ended')
        break
      case 'pong':
        break
    }
  }

  /** Request that the host record `value` for this player in `round`. */
  submitScore(round: number, value: number, flags?: RoundFlags): void {
    if (this.link.state !== 'open') return
    this.link.send(encode(msg.score(round, value, flags)))
  }

  getIdentity(): GuestIdentity | null {
    return this.identity
  }

  /** Politely leave (frees the lobby seat) and close the link. */
  leave(): void {
    if (this.link.state === 'open') this.link.send(encode(msg.leave()))
    this.link.close()
  }
}
