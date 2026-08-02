import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startHeartbeat } from './relay-transport'

/** Minimal WebSocket-shaped stub that records sends and can emit events. */
class FakeSocket {
  readyState: 0 | 1 | 2 | 3 = 1
  sent: string[] = []
  private listeners: Record<string, ((e: unknown) => void)[]> = {}
  send(data: string): void {
    this.sent.push(data)
  }
  addEventListener(type: string, cb: (e: unknown) => void): void {
    ;(this.listeners[type] ??= []).push(cb)
  }
  removeEventListener(type: string, cb: (e: unknown) => void): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter((x) => x !== cb)
  }
  emit(type: string): void {
    for (const cb of this.listeners[type] ?? []) cb({})
  }
}

describe('relay heartbeat', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('sends periodic ping frames while the socket is open', () => {
    const sock = new FakeSocket()
    const stop = startHeartbeat(sock, () => {})

    vi.advanceTimersByTime(20_000)
    expect(sock.sent).toEqual([JSON.stringify({ type: 'ping' })])

    vi.advanceTimersByTime(20_000)
    expect(sock.sent).toHaveLength(2)

    stop()
    vi.advanceTimersByTime(60_000)
    expect(sock.sent).toHaveLength(2) // no more pings after stop
  })

  it('does not send while the socket is not open', () => {
    const sock = new FakeSocket()
    sock.readyState = 0 // CONNECTING
    startHeartbeat(sock, () => {})
    vi.advanceTimersByTime(20_000)
    expect(sock.sent).toHaveLength(0)
  })

  it('declares the socket dead when no frames arrive', () => {
    const sock = new FakeSocket()
    let dead = 0
    startHeartbeat(sock, () => (dead += 1))

    // Two healthy pings, then silence long enough to trip the watchdog.
    vi.advanceTimersByTime(40_000)
    expect(dead).toBe(0)
    vi.advanceTimersByTime(20_000) // 60s of silence > DEAD_MS
    expect(dead).toBe(1)
  })

  it('stays alive as long as frames keep arriving', () => {
    const sock = new FakeSocket()
    let dead = 0
    startHeartbeat(sock, () => (dead += 1))

    // A received frame every 20s (e.g. the relay's pong) keeps it live.
    for (let t = 0; t < 200_000; t += 20_000) {
      vi.advanceTimersByTime(20_000)
      sock.emit('message')
    }
    expect(dead).toBe(0)
  })
})
