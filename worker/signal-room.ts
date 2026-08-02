import type { DurableObjectState, Env } from './worker.d'

/**
 * A signaling / relay room, one Durable Object per room code.
 *
 * The room is a dumb, host-authoritative message router: exactly one host and N
 * guests. It never inspects the application payload (`data`) — it only shuttles
 * opaque strings between the host and a specific guest — so all game rules stay
 * in the client. This is the online transport for Connected mode; the offline
 * path (WebRTC over QR) bypasses it entirely.
 */
interface RelayMessage {
  type: string
  peer?: string
  data?: string
}

function parse(raw: string): RelayMessage | null {
  try {
    const value = JSON.parse(raw)
    return value && typeof value.type === 'string'
      ? (value as RelayMessage)
      : null
  } catch {
    return null
  }
}

/** Hard cap on concurrent guest sockets per room (players + reconnect churn). */
const MAX_GUESTS = 24

export class SignalRoom {
  private host: WebSocket | null = null
  private readonly guests = new Map<string, WebSocket>()

  constructor(
    _state: DurableObjectState,
    private readonly env: Env,
  ) {
    void this.env
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }
    const role = new URL(request.url).searchParams.get('role')
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    server.accept()

    if (role === 'host') {
      if (this.host) {
        // A host already owns this room — refuse the takeover so a party that
        // knows the room code cannot supplant the authoritative host.
        this.send(server, { type: 'host-taken' })
        server.close(4001, 'host already present')
      } else {
        this.attachHost(server)
      }
    } else {
      this.attachGuest(server)
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  private send(ws: WebSocket, message: RelayMessage): void {
    try {
      ws.send(JSON.stringify(message))
    } catch {
      // A dead socket will surface via its close event; ignore here.
    }
  }

  private attachHost(ws: WebSocket): void {
    // A reconnecting host replaces the previous one and re-learns the roster.
    this.host = ws
    for (const peer of this.guests.keys()) {
      this.send(ws, { type: 'peer-join', peer })
    }

    ws.addEventListener('message', (event) => {
      const message = parse(event.data)
      if (!message) return
      // Keepalive: answer a ping so the socket never looks idle to the edge.
      if (message.type === 'ping') return this.send(ws, { type: 'pong' })
      if (message.type !== 'to' || !message.peer) return
      const guest = this.guests.get(message.peer)
      if (guest) this.send(guest, { type: 'from', data: message.data })
    })

    ws.addEventListener('close', () => {
      if (this.host !== ws) return
      this.host = null
      for (const guest of this.guests.values()) {
        this.send(guest, { type: 'host-gone' })
      }
    })
  }

  private attachGuest(ws: WebSocket): void {
    if (this.guests.size >= MAX_GUESTS) {
      this.send(ws, { type: 'room-full' })
      ws.close(4002, 'room full')
      return
    }
    const peer = crypto.randomUUID()
    this.guests.set(peer, ws)

    if (this.host) this.send(this.host, { type: 'peer-join', peer })
    else this.send(ws, { type: 'no-host' })

    ws.addEventListener('message', (event) => {
      const message = parse(event.data)
      if (!message) return
      // Keepalive: answer a ping so the socket never looks idle to the edge.
      if (message.type === 'ping') return this.send(ws, { type: 'pong' })
      if (message.type !== 'to') return
      if (this.host)
        this.send(this.host, { type: 'from', peer, data: message.data })
    })

    ws.addEventListener('close', () => {
      this.guests.delete(peer)
      if (this.host) this.send(this.host, { type: 'peer-leave', peer })
    })
  }
}
