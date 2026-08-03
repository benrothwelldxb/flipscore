import { describe, expect, it } from 'vitest'

import { urlBase64ToUint8Array, usePushStore } from './push-store'

describe('urlBase64ToUint8Array', () => {
  it('decodes a 65-byte P-256 public key (base64url, no padding)', () => {
    // A raw uncompressed EC point is 65 bytes and starts with 0x04.
    const raw = new Uint8Array(65)
    raw[0] = 0x04
    for (let i = 1; i < 65; i += 1) raw[i] = (i * 7) % 256
    const b64url = btoa(String.fromCharCode(...raw))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const out = urlBase64ToUint8Array(b64url)
    expect(out.length).toBe(65)
    expect(Array.from(out)).toEqual(Array.from(raw))
  })

  it('round-trips arbitrary byte lengths regardless of padding', () => {
    for (const len of [1, 2, 3, 16, 31, 32]) {
      const raw = new Uint8Array(len).map((_, i) => (i * 13 + 1) % 256)
      const b64url = btoa(String.fromCharCode(...raw))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
      expect(Array.from(urlBase64ToUint8Array(b64url))).toEqual(Array.from(raw))
    }
  })
})

describe('push-store without browser push support', () => {
  it('reports unsupported and refresh is a safe no-op in jsdom', async () => {
    // jsdom has no PushManager / serviceWorker, so support detection is false.
    expect(usePushStore.getState().supported).toBe(false)
    await usePushStore.getState().refresh()
    expect(usePushStore.getState().subscribed).toBe(false)
    expect(usePushStore.getState().permission).toBe('unsupported')
  })
})
