// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  b64urlDecode,
  b64urlEncode,
  encryptPayload,
  vapidAuthHeader,
  type PushSubscription,
} from './webpush'

const NOW = 1_700_000_000_000

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, [
    'deriveBits',
  ])
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info },
      key,
      length * 8,
    ),
  )
}

describe('vapidAuthHeader', () => {
  it('produces a verifiable ES256 JWT with the expected claims', async () => {
    const pair = (await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair
    const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    const publicRaw = new Uint8Array(
      await crypto.subtle.exportKey('raw', pair.publicKey),
    )
    const publicB64 = b64urlEncode(publicRaw)

    const header = await vapidAuthHeader(
      'https://push.example.com',
      'mailto:hi@flipscorer.app',
      publicB64,
      privateJwk,
      NOW,
    )
    const match = /^vapid t=([^,]+), k=(.+)$/.exec(header)
    expect(match).not.toBeNull()
    const [, jwt, k] = match!
    expect(k).toBe(publicB64)

    const [h, p, sig] = jwt.split('.')
    // The signature verifies against the public key.
    const verifyKey = await crypto.subtle.importKey(
      'raw',
      publicRaw,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifyKey,
      b64urlDecode(sig),
      utf8(`${h}.${p}`),
    )
    expect(ok).toBe(true)

    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(p))) as {
      aud: string
      sub: string
      exp: number
    }
    expect(claims.aud).toBe('https://push.example.com')
    expect(claims.sub).toBe('mailto:hi@flipscorer.app')
    expect(claims.exp).toBe(Math.floor(NOW / 1000) + 12 * 60 * 60)
  })
})

describe('encryptPayload (aes128gcm round-trip)', () => {
  it('a subscription can decrypt what we encrypt', async () => {
    // Stand in for the browser: an ECDH keypair + a 16-byte auth secret.
    const ua = (await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    )) as CryptoKeyPair
    const uaPublic = new Uint8Array(
      await crypto.subtle.exportKey('raw', ua.publicKey),
    )
    const authSecret = crypto.getRandomValues(new Uint8Array(16))
    const sub: PushSubscription = {
      endpoint: 'https://push.example.com/x',
      p256dh: b64urlEncode(uaPublic),
      auth: b64urlEncode(authSecret),
    }

    const payload = utf8(JSON.stringify({ title: 'Hi', body: 'Flip 7!' }))
    const body = await encryptPayload(sub, payload)

    // Parse the aes128gcm header and reverse the derivation as the UA would.
    const salt = body.slice(0, 16)
    const idlen = body[20]
    const asPublic = body.slice(21, 21 + idlen)
    const ciphertext = body.slice(21 + idlen)

    const asKey = await crypto.subtle.importKey(
      'raw',
      asPublic,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    )
    const ecdhSecret = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'ECDH', public: asKey },
        ua.privateKey,
        256,
      ),
    )
    const keyInfo = concat(utf8('WebPush: info\0'), uaPublic, asPublic)
    const ikm = await hkdf(ecdhSecret, authSecret, keyInfo, 32)
    const cek = await hkdf(ikm, salt, utf8('Content-Encoding: aes128gcm\0'), 16)
    const nonce = await hkdf(ikm, salt, utf8('Content-Encoding: nonce\0'), 12)

    const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, [
      'decrypt',
    ])
    const plaintext = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonce },
        aesKey,
        ciphertext,
      ),
    )
    // Strip the trailing 0x02 last-record delimiter.
    expect(plaintext[plaintext.length - 1]).toBe(0x02)
    const decoded = new TextDecoder().decode(plaintext.slice(0, -1))
    expect(JSON.parse(decoded)).toEqual({ title: 'Hi', body: 'Flip 7!' })
  })
})
