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

const WS_OPEN = 1

/** How often to send a keepalive ping. Comfortably under the ~100s edge idle
 *  timeout, so a quiet lobby or a long gap between scores never drops. */
const PING_MS = 20_000
/** Force a reconnect if no frame (not even a pong) arrives for this long — this
 *  is what catches a half-open socket that TCP hasn't noticed is dead yet
 *  (common after a phone sleeps or changes network). */
const DEAD_MS = 55_000
const PING_FRAME = JSON.stringify({ type: 'ping' })

/**
 * Keeps one socket alive and detects when it has silently died. Sends a ping on
 * an interval and, on that same tick, declares the socket dead if nothing has
 * been received recently — calling `onDead` so the owner can reconnect. Any
 * inbound frame (the relay's pong, or real traffic) counts as liveness.
 */
export function startHeartbeat(
  socket: Pick<
    WebSocket,
    'send' | 'readyState' | 'addEventListener' | 'removeEventListener'
  >,
  onDead: () => void,
): () => void {
  let lastRx = Date.now()
  const touch = () => {
    lastRx = Date.now()
  }
  socket.addEventListener('message', touch as EventListener)

  const timer = setInterval(() => {
    if (Date.now() - lastRx > DEAD_MS) {
      stop()
      onDead()
      return
    }
    if (socket.readyState === WS_OPEN) {
      try {
        socket.send(PING_FRAME)
      } catch {
        // The next tick's liveness check (or the socket's own close) handles it.
      }
    }
  }, PING_MS)

  function stop(): void {
    clearInterval(timer)
    socket.removeEventListener('message', touch as EventListener)
  }
  return stop
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
  private readonly closeCbs: (() => void)[] = []
  private readonly ready: Promise<void>
  private readonly stopHeartbeat: () => void

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
      this.stopHeartbeat()
      for (const link of this.links.values()) link.close()
      this.links.clear()
      for (const cb of this.closeCbs) cb()
    })
    // Keep the host↔relay socket warm even with an empty lobby, and reconnect
    // it (via onClose) the moment it goes quiet.
    this.stopHeartbeat = startHeartbeat(this.socket, () => this.socket.close())
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
  /** Fired when the underlying socket closes (for reconnect orchestration). */
  onClose(cb: () => void): void {
    this.closeCbs.push(cb)
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
    this.stopHeartbeat()
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
  private readonly stopHeartbeat: () => void

  constructor(roomCode: string) {
    this.roomCode = roomCode
    this.socket = new WebSocket(relayUrl(roomCode, 'guest'))
    // Keep the guest↔relay socket warm; if it silently dies, close it so the
    // net-store's guest reconnect loop takes over.
    this.stopHeartbeat = startHeartbeat(this.socket, () => this.socket.close())
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
    this.stopHeartbeat()
    this.link?.close()
    try {
      this.socket.close()
    } catch {
      // Already closing.
    }
  }
}
