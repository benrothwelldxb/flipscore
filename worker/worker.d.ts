// Minimal ambient shims for the Cloudflare Workers runtime globals this Worker
// uses. Kept local so the app's `tsc -b` (which only compiles ./src) never needs
// the full @cloudflare/workers-types package; wrangler bundles this directory
// with esbuild at deploy time.

export interface Env {
  SIGNAL_ROOM: DurableObjectNamespace
  ASSETS: { fetch(request: Request): Promise<Response> }
  /** Cloud Accounts database (see migrations/0001_auth.sql). */
  DB: D1Database
  /** Pepper mixed into one-time-code hashes. Set as a Worker secret. */
  AUTH_SECRET?: string
  /** Resend API key. When present, sign-in codes are emailed for real. */
  RESEND_API_KEY?: string
  /** Verified "From" address for sign-in emails, e.g. "FlipScorer <hi@…>". */
  EMAIL_FROM?: string
  /** VAPID keys for Web Push. When both are set, push is enabled. */
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  /** VAPID `sub` claim, e.g. "mailto:admin@flipscorer.app". */
  VAPID_SUBJECT?: string
}

// Minimal ambient shims for the Cloudflare D1 (SQLite) client surface this
// Worker actually calls. Enough to type the auth handler without pulling in the
// full @cloudflare/workers-types package.
export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>
  exec(query: string): Promise<D1ExecResult>
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName?: string): Promise<T | null>
  run<T = unknown>(): Promise<D1Result<T>>
  all<T = unknown>(): Promise<D1Result<T>>
}
export interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: unknown
}
export interface D1ExecResult {
  count: number
  duration: number
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

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
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
