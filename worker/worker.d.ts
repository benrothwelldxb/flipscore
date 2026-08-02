// Minimal ambient shims for the Cloudflare Workers runtime globals this Worker
// uses. Kept local so the app's `tsc -b` (which only compiles ./src) never needs
// the full @cloudflare/workers-types package; wrangler bundles this directory
// with esbuild at deploy time.

export interface Env {
  SIGNAL_ROOM: DurableObjectNamespace
  ASSETS: { fetch(request: Request): Promise<Response> }
}

export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId
  get(id: DurableObjectId): DurableObjectStub
}
export interface DurableObjectId {
  toString(): string
}
export interface DurableObjectStub {
  fetch(request: Request): Promise<Response>
}
export interface DurableObjectState {
  readonly id: DurableObjectId
}

declare global {
  class WebSocketPair {
    0: WebSocket
    1: WebSocket
  }
  interface WebSocket {
    accept(): void
    send(data: string): void
    close(code?: number, reason?: string): void
    addEventListener(
      type: 'message',
      listener: (event: { data: string }) => void,
    ): void
    addEventListener(type: 'close', listener: () => void): void
    addEventListener(type: 'error', listener: () => void): void
  }
  interface ResponseInit {
    webSocket?: WebSocket
  }
}
