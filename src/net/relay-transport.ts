import type {
  GuestTransport,
  HostTransport,
  LinkState,
  PeerLink,
} from './transport'

/**
 * The online transport: a thin client over the Durable Object relay
 * (`worker/signal-room.ts`). The host opens one WebSocket and receives a
 * {@link PeerLink} per guest the relay announces; a guest opens one WebSocket
 * and gets a single link to the host. The relay never sees game rules — it
 * shuttles opaque application strings — so the exact same host/guest controllers
 * run over it as over the offline WebRTC path.
 */
function relayUrl(code: string, role: 'host' | 'guest'): string {
  const secure = location.protocol === 'https:'
  const scheme = secure ? 'wss' : 'ws'
  return `${scheme}://${location.host}/rtc/${code}?role=${role}`
}

interface RelayFrame {
  type: string
  peer?: string
  data?: string
}

/** A PeerLink whose bytes travel as `{type:'to', …}` frames over the socket. */
class RelayLink implements PeerLink {
  readonly id: string
  state: LinkState = 'open'
  private readonly sendFrame: (data: string) => void
  private readonly messageCbs: ((data: string) => void)[] = []
  private readonly openCbs: (() => void)[] = []
  private readonly closeCbs: (() => void)[] = []

  constructor(id: string, sendFrame: (data: string) => void) {
    this.id = id
    this.sendFrame = sendFrame
  }

  send(data: string): void {
    if (this.state === 'open') this.sendFrame(data)
  }

  /** Deliver an inbound application payload to subscribers. */
  deliver(data: string): void {
    if (this.state !== 'open') return
    for (const cb of this.messageCbs) cb(data)
  }

  close(): void {
    if (this.state === 'closed') return
    this.state = 'closed'
    for (const cb of this.closeCbs) cb()
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

function parseFrame(raw: unknown): RelayFrame | null {
  if (typeof raw !== 'string') return null
  try {
    const value = JSON.parse(raw)
    return value && typeof value.type === 'string'
      ? (value as RelayFrame)
      : null
  } catch {
    return null
  }
}

export class RelayHostTransport implements HostTransport {
  readonly roomCode: string
  private readonly socket: WebSocket
  private readonly links = new Map<string, RelayLink>()
  private readonly peerCbs: ((link: PeerLink) => void)[] = []
  private readonly errorCbs: ((error: Error) => void)[] = []
  private readonly ready: Promise<void>

  constructor(roomCode: string) {
    this.roomCode = roomCode
    this.socket = new WebSocket(relayUrl(roomCode, 'host'))
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', () => resolve())
      this.socket.addEventListener('error', () =>
        reject(new Error('Could not reach the relay.')),
      )
    })
    this.socket.addEventListener('message', (event) =>
      this.onFrame(event.data as string),
    )
    this.socket.addEventListener('error', () =>
      this.emitError(new Error('Relay connection error.')),
    )
    this.socket.addEventListener('close', () => {
      for (const link of this.links.values()) link.close()
      this.links.clear()
    })
  }

  whenReady(): Promise<void> {
    return this.ready
  }

  onPeer(cb: (link: PeerLink) => void): void {
    this.peerCbs.push(cb)
  }
  onError(cb: (error: Error) => void): void {
    this.errorCbs.push(cb)
  }

  private emitError(error: Error): void {
    for (const cb of this.errorCbs) cb(error)
  }

  private onFrame(raw: string): void {
    const frame = parseFrame(raw)
    if (!frame) return
    switch (frame.type) {
      case 'peer-join': {
        if (!frame.peer || this.links.has(frame.peer)) return
        const peer = frame.peer
        const link = new RelayLink(peer, (data) =>
          this.socket.send(JSON.stringify({ type: 'to', peer, data })),
        )
        this.links.set(peer, link)
        for (const cb of this.peerCbs) cb(link)
        break
      }
      case 'peer-leave': {
        if (!frame.peer) return
        this.links.get(frame.peer)?.close()
        this.links.delete(frame.peer)
        break
      }
      case 'from': {
        if (frame.peer && typeof frame.data === 'string') {
          this.links.get(frame.peer)?.deliver(frame.data)
        }
        break
      }
    }
  }

  close(): void {
    for (const link of this.links.values()) link.close()
    this.links.clear()
    try {
      this.socket.close()
    } catch {
      // Already closing.
    }
  }
}

export class RelayGuestTransport implements GuestTransport {
  private readonly roomCode: string
  private readonly socket: WebSocket
  private link: RelayLink | null = null

  constructor(roomCode: string) {
    this.roomCode = roomCode
    this.socket = new WebSocket(relayUrl(roomCode, 'guest'))
  }

  connect(): Promise<PeerLink> {
    return new Promise((resolve, reject) => {
      let settled = false
      const link = new RelayLink(this.roomCode, (data) =>
        this.socket.send(JSON.stringify({ type: 'to', data })),
      )

      this.socket.addEventListener('open', () => {
        this.link = link
        settled = true
        resolve(link)
      })
      this.socket.addEventListener('error', () => {
        if (!settled) reject(new Error('Could not reach the host.'))
      })
      this.socket.addEventListener('close', () => link.close())
      this.socket.addEventListener('message', (event) => {
        const frame = parseFrame(event.data as string)
        if (!frame) return
        if (frame.type === 'from' && typeof frame.data === 'string') {
          link.deliver(frame.data)
        } else if (
          frame.type === 'host-gone' ||
          frame.type === 'no-host' ||
          frame.type === 'room-full'
        ) {
          // The host is not (or no longer) present, or the room is full: drop
          // the link AND the socket so a stale guest connection can't linger in
          // the relay while the guest retries on a fresh socket.
          link.close()
          this.close()
        }
      })
    })
  }

  close(): void {
    this.link?.close()
    try {
      this.socket.close()
    } catch {
      // Already closing.
    }
  }
}
