import { create } from 'zustand'

import type { Game, RoundFlags } from '@/domain/types'
import {
  GuestController,
  type GuestIdentity,
  type GuestStatus,
} from '@/net/guest-controller'
import { HostController, type HostBridge } from '@/net/host-controller'
import type { Seat } from '@/net/host-session'
import { clearJoin, loadJoin, saveJoin } from '@/net/join-storage'
import type { RejectReason } from '@/net/protocol'
import { RelayGuestTransport, RelayHostTransport } from '@/net/relay-transport'
import { createRoomCode } from '@/net/room-code'
import type { GuestTransport, PeerLink } from '@/net/transport'
import { answerQrOffer, createQrOffer, type QrOffer } from '@/net/webrtc-qr'
import { useGameStore } from '@/stores/game-store'

/**
 * The Connected-mode orchestrator. It wires a signaling transport (relay or QR)
 * to the tested host/guest controllers and mirrors just enough of their state
 * into React. The controllers, transports and timers are not serializable and
 * would cause needless re-renders, so they live at module scope; only
 * observable facts live in the store.
 */
export type TransportMode = 'relay' | 'qr'

export type NetRole = 'idle' | 'hosting' | 'guest'

export type NetGuestStatus = 'connecting' | 'reconnecting' | GuestStatus // joining | joined | rejected | ended | kicked | disconnected

export interface SeatView {
  playerId: string
  connected: boolean
}

interface NetState {
  role: NetRole
  transportMode: TransportMode | null
  roomCode: string | null
  gameId: string | null
  hostReady: boolean
  hostPlayerId: string | null
  seats: SeatView[]
  error: string | null

  guestStatus: NetGuestStatus | null
  guestReason: RejectReason | null
  identity: GuestIdentity | null
  replica: Game | null
  /** Offline join only: the reply blob the guest shows for the host to scan. */
  answerBlob: string | null

  // Host actions -----------------------------------------------------------
  startHosting: (
    gameId: string,
    opts: { offline?: boolean; hostPlayerId?: string | null },
  ) => Promise<void>
  createOffer: () => Promise<{ id: string; blob: string }>
  acceptAnswer: (offerId: string, answerBlob: string) => Promise<void>
  kickPlayer: (playerId: string) => void
  stopHosting: () => void

  // Guest actions ----------------------------------------------------------
  joinRelay: (opts: {
    roomCode: string
    name: string
    color?: string
  }) => Promise<void>
  answerOffer: (
    offerBlob: string,
    opts: { name: string; color?: string },
  ) => Promise<{ blob: string }>
  submitMyScore: (value: number, flags?: RoundFlags) => void
  leaveGuest: () => void

  reset: () => void
}

// ---- Module-scope session refs (non-reactive) -----------------------------

let hostController: HostController | null = null
let hostTransport: RelayHostTransport | null = null
let guestController: GuestController | null = null
let guestTransport: GuestTransport | null = null
let unsubscribeGame: (() => void) | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempts = 0
let terminated = false
const pendingOffers = new Map<string, QrOffer>()

let guestCreds: {
  roomCode: string
  name: string
  color?: string
  token?: string
} | null = null

// Host relay reconnection: the room code is kept stable across reconnects so
// guests can always find the host at the same address.
let hostReconnectTimer: ReturnType<typeof setTimeout> | null = null
let hostReconnectAttempts = 0
let hostTerminated = true
let hostCreds: { gameId: string; roomCode: string } | null = null

const MAX_RECONNECTS = 10

export const useNetStore = create<NetState>()((set, get) => {
  function seatViews(seats: Seat[]): SeatView[] {
    return seats.map((s) => ({
      playerId: s.playerId,
      connected: s.peerId !== null,
    }))
  }

  /** A HostBridge backed by the games store for `gameId`. */
  function makeBridge(gameId: string): HostBridge {
    const store = useGameStore.getState
    let last: Game | undefined = store().games.find((g) => g.id === gameId)
    return {
      get: () => {
        const g = store().games.find((x) => x.id === gameId)
        if (g) last = g
        return last as Game
      },
      addPlayer: (name, color) =>
        store().addConnectedPlayer(gameId, name, color),
      removePlayer: (playerId) =>
        store().removeConnectedPlayer(gameId, playerId),
      recordScore: (playerId, value, flags) =>
        store().submitScore(gameId, playerId, value, flags),
    }
  }

  function attachHostController(gameId: string): void {
    const bridge = makeBridge(gameId)
    hostController = new HostController(bridge, {
      onSeatsChange: (seats) => set({ seats: seatViews(seats) }),
    })
    // Any change to the hosted game (a host edit, an applied guest score, a
    // round advance) is broadcast to every guest.
    let prev = bridge.get()
    unsubscribeGame = useGameStore.subscribe((state) => {
      const g = state.games.find((x) => x.id === gameId)
      if (g && g !== prev) {
        prev = g
        hostController?.broadcast()
      }
    })
  }

  /** (Re)open the host's relay socket for the current room, wiring peers and a
   *  reconnect-on-close. The HostController (and its seats) is created once in
   *  startHosting and survives across socket reconnects. */
  function connectHostRelay(): void {
    if (hostTerminated || !hostCreds) return
    const previous = hostTransport
    const transport = new RelayHostTransport(hostCreds.roomCode)
    hostTransport = transport
    // Close the old socket only after swapping, so its close callback (which
    // compares against the current transport) knows it isn't the live one.
    previous?.close()

    transport.onPeer((link) => hostController?.addPeer(link))
    transport.onError((error) => set({ error: error.message }))
    transport.onClose(() => {
      if (hostTerminated || transport !== hostTransport) return
      scheduleHostReconnect()
    })
    set({
      transportMode: 'relay',
      roomCode: transport.roomCode,
      hostReady: false,
    })

    transport.whenReady().then(
      () => {
        if (transport !== hostTransport) return
        hostReconnectAttempts = 0
        set({ hostReady: true, error: null })
      },
      (error) => {
        if (transport !== hostTransport) return
        set({ error: (error as Error).message })
        // onClose will follow the failed open and drive the retry.
      },
    )
  }

  function scheduleHostReconnect(): void {
    if (hostTerminated || !hostCreds) return
    if (hostReconnectAttempts >= MAX_RECONNECTS) {
      set({ error: 'Lost connection to the relay. Tap to try again.' })
      return
    }
    hostReconnectAttempts += 1
    const delay = Math.min(1000 * 2 ** (hostReconnectAttempts - 1), 8000)
    set({ hostReady: false })
    hostReconnectTimer = setTimeout(() => connectHostRelay(), delay)
  }

  function scheduleReconnect(): void {
    if (terminated || !guestCreds) return
    if (reconnectAttempts >= MAX_RECONNECTS) {
      set({ guestStatus: 'disconnected' })
      return
    }
    reconnectAttempts += 1
    const delay = Math.min(1000 * 2 ** (reconnectAttempts - 1), 8000)
    set({ guestStatus: 'reconnecting' })
    reconnectTimer = setTimeout(() => void connectGuestRelay(), delay)
  }

  async function connectGuestRelay(): Promise<void> {
    if (!guestCreds) return
    // Close any prior socket before opening a new one, so a reconnect never
    // leaves a zombie guest connection registered in the relay.
    guestTransport?.close()
    const { roomCode, name, color, token } = guestCreds
    const transport = new RelayGuestTransport(roomCode)
    guestTransport = transport
    let link: PeerLink
    try {
      link = await transport.connect()
    } catch {
      scheduleReconnect()
      return
    }
    guestController = new GuestController(
      link,
      { name, color, token },
      { setSnapshot: (g) => set({ replica: g }) },
      {
        onStatus: (status, reason) => handleGuestStatus(status, reason),
        onIdentity: (identity) => {
          if (guestCreds) guestCreds.token = identity.token
          saveJoin(roomCode, { token: identity.token, name, color })
          set({ identity })
        },
      },
    )
  }

  function handleGuestStatus(status: GuestStatus, reason?: RejectReason): void {
    switch (status) {
      case 'joining':
        set({ guestStatus: 'connecting' })
        break
      case 'joined':
        reconnectAttempts = 0
        set({ guestStatus: 'joined', error: null, answerBlob: null })
        break
      case 'rejected':
        terminated = true
        if (guestCreds) clearJoin(guestCreds.roomCode)
        set({ guestStatus: 'rejected', guestReason: reason ?? null })
        teardownGuest()
        break
      case 'kicked':
        terminated = true
        if (guestCreds) clearJoin(guestCreds.roomCode)
        set({ guestStatus: 'kicked' })
        teardownGuest()
        break
      case 'ended':
        terminated = true
        set({ guestStatus: 'ended' })
        teardownGuest()
        break
      case 'disconnected':
        if (!terminated) scheduleReconnect()
        break
    }
  }

  function teardownGuest(): void {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
    reconnectAttempts = 0
    guestController = null
    guestTransport?.close()
    guestTransport = null
    guestCreds = null
  }

  function teardownHost(): void {
    // Mark terminated first so the transport's close callback won't reconnect.
    hostTerminated = true
    if (hostReconnectTimer) clearTimeout(hostReconnectTimer)
    hostReconnectTimer = null
    hostReconnectAttempts = 0
    hostCreds = null
    unsubscribeGame?.()
    unsubscribeGame = null
    hostController?.close()
    hostController = null
    hostTransport?.close()
    hostTransport = null
    // Tear down any unaccepted QR offers so their RTCPeerConnections don't leak.
    for (const offer of pendingOffers.values()) offer.close()
    pendingOffers.clear()
  }

  return {
    role: 'idle',
    transportMode: null,
    roomCode: null,
    gameId: null,
    hostReady: false,
    hostPlayerId: null,
    seats: [],
    error: null,
    guestStatus: null,
    guestReason: null,
    identity: null,
    replica: null,
    answerBlob: null,

    // ---- Host -------------------------------------------------------------
    startHosting: async (gameId, { offline, hostPlayerId }) => {
      teardownHost()
      terminated = false
      attachHostController(gameId)
      set({
        role: 'hosting',
        gameId,
        hostPlayerId: hostPlayerId ?? null,
        error: null,
        seats: [],
      })

      if (offline) {
        set({ transportMode: 'qr', roomCode: null, hostReady: true })
        return
      }

      hostTerminated = false
      hostReconnectAttempts = 0
      hostCreds = { gameId, roomCode: createRoomCode() }
      connectHostRelay()
    },

    createOffer: async () => {
      const offer = await createQrOffer()
      pendingOffers.set(offer.id, offer)
      return { id: offer.id, blob: offer.blob }
    },

    acceptAnswer: async (offerId, answerBlob) => {
      const offer = pendingOffers.get(offerId)
      if (!offer)
        throw new Error('That invite has expired — show a new QR code.')
      const link = await offer.accept(answerBlob)
      pendingOffers.delete(offerId)
      hostController?.addPeer(link)
    },

    kickPlayer: (playerId) => hostController?.kick(playerId),

    stopHosting: () => {
      teardownHost()
      get().reset()
    },

    // ---- Guest ------------------------------------------------------------
    joinRelay: async ({ roomCode, name, color }) => {
      teardownGuest()
      terminated = false
      guestCreds = { roomCode, name, color, token: loadJoin(roomCode)?.token }
      set({
        role: 'guest',
        transportMode: 'relay',
        roomCode,
        guestStatus: 'connecting',
        guestReason: null,
        identity: null,
        replica: null,
        error: null,
      })
      await connectGuestRelay()
    },

    answerOffer: async (offerBlob, { name, color }) => {
      teardownGuest()
      terminated = false
      set({
        role: 'guest',
        transportMode: 'qr',
        roomCode: null,
        guestStatus: 'connecting',
        guestReason: null,
        identity: null,
        replica: null,
        answerBlob: null,
        error: null,
      })
      const { blob, link } = await answerQrOffer(offerBlob)
      set({ answerBlob: blob })
      link.then(
        (peer) => {
          guestController = new GuestController(
            peer,
            { name, color },
            { setSnapshot: (g) => set({ replica: g }) },
            {
              onStatus: (status, reason) => handleGuestStatus(status, reason),
              onIdentity: (identity) => set({ identity }),
            },
          )
        },
        () => set({ guestStatus: 'disconnected' }),
      )
      return { blob }
    },

    submitMyScore: (value, flags) => {
      const { replica } = get()
      if (guestController && replica) {
        guestController.submitScore(replica.currentRoundIndex, value, flags)
      }
    },

    leaveGuest: () => {
      guestController?.leave()
      teardownGuest()
      get().reset()
    },

    reset: () =>
      set({
        role: 'idle',
        transportMode: null,
        roomCode: null,
        gameId: null,
        hostReady: false,
        hostPlayerId: null,
        seats: [],
        error: null,
        guestStatus: null,
        guestReason: null,
        identity: null,
        replica: null,
        answerBlob: null,
      }),
  }
})
