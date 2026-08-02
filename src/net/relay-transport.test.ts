import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PeerLink } from './transport'

/**
 * Exercises the relay client transports against a fake WebSocket whose routing
 * mirrors the Durable Object in `worker/signal-room.ts`. This proves the
 * client↔relay framing contract end-to-end without a live socket, and doubles as
 * an executable spec for the relay protocol the Worker must implement.
 */

type Listener = (event: { data?: string }) => void

class FakeHub {
  host: FakeWebSocket | null = null
  guests = new Map<string, FakeWebSocket>()
  private counter = 0

  join(ws: FakeWebSocket, role: string): void {
    if (role === 'host') {
      this.host = ws
      for (const peer of this.guests.keys()) {
        ws.deliver({ type: 'peer-join', peer })
      }
    } else {
      const peer = `guest-${(this.counter += 1)}`
      ws.peerId = peer
      this.guests.set(peer, ws)
      if (this.host) this.host.deliver({ type: 'peer-join', peer })
      else ws.deliver({ type: 'no-host' })
    }
  }

  fromClient(
    ws: FakeWebSocket,
    message: { type: string; peer?: string; data?: string },
  ): void {
    if (ws === this.host) {
      if (message.type === 'to' && message.peer) {
        this.guests
          .get(message.peer)
          ?.deliver({ type: 'from', data: message.data })
      }
    } else if (message.type === 'to') {
      this.host?.deliver({ type: 'from', peer: ws.peerId, data: message.data })
    }
  }

  leave(ws: FakeWebSocket): void {
    if (ws === this.host) {
      this.host = null
      for (const guest of this.guests.values())
        guest.deliver({ type: 'host-gone' })
    } else if (ws.peerId) {
      this.guests.delete(ws.peerId)
      this.host?.deliver({ type: 'peer-leave', peer: ws.peerId })
    }
  }
}

const hubs = new Map<string, FakeHub>()

class FakeWebSocket {
  peerId: string | undefined
  private listeners: Record<string, Listener[]> = {}
  private hub: FakeHub
  private role: string

  constructor(url: string) {
    const parsed = new URL(url)
    const code = parsed.pathname.split('/').pop() ?? ''
    this.role = parsed.searchParams.get('role') ?? 'guest'
    this.hub = hubs.get(code) ?? new FakeHub()
    hubs.set(code, this.hub)
    queueMicrotask(() => {
      this.emit('open', {})
      this.hub.join(this, this.role)
    })
  }

  readyState = 1

  addEventListener(type: string, cb: Listener): void {
    ;(this.listeners[type] ??= []).push(cb)
  }

  removeEventListener(type: string, cb: Listener): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter((x) => x !== cb)
  }

  send(raw: string): void {
    this.hub.fromClient(this, JSON.parse(raw))
  }

  close(): void {
    this.hub.leave(this)
    this.emit('close', {})
  }

  /** Relay → this client. */
  deliver(message: unknown): void {
    queueMicrotask(() =>
      this.emit('message', { data: JSON.stringify(message) }),
    )
  }

  private emit(type: string, event: { data?: string }): void {
    for (const cb of this.listeners[type] ?? []) cb(event)
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

let RelayHostTransport: typeof import('./relay-transport').RelayHostTransport
let RelayGuestTransport: typeof import('./relay-transport').RelayGuestTransport

beforeEach(async () => {
  hubs.clear()
  vi.stubGlobal('WebSocket', FakeWebSocket)
  const mod = await import('./relay-transport')
  RelayHostTransport = mod.RelayHostTransport
  RelayGuestTransport = mod.RelayGuestTransport
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('relay transport (client ↔ fake relay)', () => {
  it('surfaces a guest to the host and passes messages both ways', async () => {
    const host = new RelayHostTransport('ROOMAB')
    const peers: PeerLink[] = []
    host.onPeer((link) => peers.push(link))
    await host.whenReady()

    const guest = new RelayGuestTransport('ROOMAB')
    const guestLink = await guest.connect()
    await flush()

    expect(peers).toHaveLength(1)

    const fromGuest: string[] = []
    peers[0].onMessage((d) => fromGuest.push(d))
    const fromHost: string[] = []
    guestLink.onMessage((d) => fromHost.push(d))

    guestLink.send('hello-host')
    peers[0].send('hello-guest')
    await flush()

    expect(fromGuest).toEqual(['hello-host'])
    expect(fromHost).toEqual(['hello-guest'])

    host.close()
    guest.close()
  })

  it('closes the host-side link when a guest disconnects', async () => {
    const host = new RelayHostTransport('ROOMCD')
    const peers: PeerLink[] = []
    host.onPeer((link) => peers.push(link))
    await host.whenReady()

    const guest = new RelayGuestTransport('ROOMCD')
    await guest.connect()
    await flush()

    let closed = false
    peers[0].onClose(() => (closed = true))
    guest.close()
    await flush()

    expect(closed).toBe(true)
  })

  it('drops the guest link when the host goes away', async () => {
    const host = new RelayHostTransport('ROOMEF')
    await host.whenReady()
    const guest = new RelayGuestTransport('ROOMEF')
    const link = await guest.connect()
    await flush()

    let closed = false
    link.onClose(() => (closed = true))
    host.close()
    await flush()

    expect(closed).toBe(true)
  })
})
