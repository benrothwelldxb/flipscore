import type { LinkState, PeerLink } from './transport'

/**
 * An in-process {@link PeerLink} pair whose two ends are wired to each other.
 * Delivery is deferred to a microtask so it mimics the async nature of a real
 * channel (a `send` never synchronously re-enters the sender). Used by the
 * session tests to exercise the full host↔guest protocol deterministically,
 * and as the substrate the real transports slot in behind.
 */
class MockLink implements PeerLink {
  readonly id: string
  state: LinkState = 'connecting'
  peer: MockLink | null = null
  private messageCbs: ((data: string) => void)[] = []
  private openCbs: (() => void)[] = []
  private closeCbs: (() => void)[] = []

  constructor(id: string) {
    this.id = id
  }

  send(data: string): void {
    if (this.state !== 'open') return
    const peer = this.peer
    if (!peer) return
    queueMicrotask(() => {
      if (peer.state !== 'open') return
      for (const cb of peer.messageCbs) cb(data)
    })
  }

  open(): void {
    if (this.state !== 'connecting') return
    this.state = 'open'
    for (const cb of this.openCbs) cb()
  }

  close(): void {
    if (this.state === 'closed') return
    this.state = 'closed'
    for (const cb of this.closeCbs) cb()
    const peer = this.peer
    if (peer && peer.state !== 'closed') queueMicrotask(() => peer.close())
  }

  onMessage(cb: (data: string) => void): void {
    this.messageCbs.push(cb)
  }
  onOpen(cb: () => void): void {
    this.openCbs.push(cb)
    if (this.state === 'open') cb()
  }
  onClose(cb: () => void): void {
    this.closeCbs.push(cb)
    if (this.state === 'closed') cb()
  }
}

export interface MockPair {
  hostSide: PeerLink
  guestSide: PeerLink
  /** Move both ends to `open` and fire their open handlers. */
  connect(): void
}

/** Create a connected pair of links sharing an id (the peer/connection id). */
export function createMockPair(id: string): MockPair {
  const hostSide = new MockLink(id)
  const guestSide = new MockLink(id)
  hostSide.peer = guestSide
  guestSide.peer = hostSide
  return {
    hostSide,
    guestSide,
    connect() {
      hostSide.open()
      guestSide.open()
    },
  }
}

/** Flush pending microtask deliveries (await this in tests after sends). */
export function flush(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve))
}
