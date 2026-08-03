import type { Env } from './worker.d'

// A minimal Web Push sender implemented on the Web Crypto API (the npm
// `web-push` package is Node-only and won't run on Workers). Covers:
//   - VAPID (RFC 8292): an ES256 JWT proving who's sending, per push service.
//   - Message encryption (RFC 8291) with the `aes128gcm` content coding
//     (RFC 8188): ECDH to the subscription key, HKDF, AES-128-GCM.
//
// Only the two crypto pieces are unit-testable here (JWT signature + an
// encrypt→decrypt round-trip); actual delivery needs a real push service.

export interface PushSubscription {
  endpoint: string
  p256dh: string // base64url of the client's 65-byte P-256 public key
  auth: string // base64url of the 16-byte auth secret
}

// ---- base64url helpers ----------------------------------------------------

export function b64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const binary = atob(input.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

// ---- VAPID (RFC 8292) -----------------------------------------------------

/** The origin of a push endpoint, used as the JWT `aud`. */
function audienceOf(endpoint: string): string {
  const url = new URL(endpoint)
  return `${url.protocol}//${url.host}`
}

/**
 * Build the VAPID `Authorization` header value for one push service audience.
 * `privateJwk` is the server's ECDSA P-256 private key as a JWK.
 */
export async function vapidAuthHeader(
  audience: string,
  subject: string,
  publicKeyB64url: string,
  privateJwk: JsonWebKey,
  now: number,
): Promise<string> {
  const header = b64urlEncode(
    utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })),
  )
  const payload = b64urlEncode(
    utf8(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(now / 1000) + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  )
  const signingInput = `${header}.${payload}`

  const key = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      utf8(signingInput),
    ),
  )
  const jwt = `${signingInput}.${b64urlEncode(signature)}`
  return `vapid t=${jwt}, k=${publicKeyB64url}`
}

// ---- Message encryption (RFC 8291 / RFC 8188) -----------------------------

/** HKDF (extract + expand) via WebCrypto, returning `length` bytes. */
async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8,
  )
  return new Uint8Array(bits)
}

/**
 * Encrypt `payload` for a subscription, producing an `aes128gcm` body ready to
 * POST. `salt` and the ephemeral key are injectable for deterministic tests.
 */
export async function encryptPayload(
  sub: PushSubscription,
  payload: Uint8Array,
  opts?: { salt?: Uint8Array; ephemeral?: CryptoKeyPair },
): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.p256dh) // 65 bytes
  const authSecret = b64urlDecode(sub.auth) // 16 bytes
  const salt = opts?.salt ?? crypto.getRandomValues(new Uint8Array(16))

  const ephemeral =
    opts?.ephemeral ??
    (await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    ))
  const asPublic = new Uint8Array(
    await crypto.subtle.exportKey('raw', ephemeral.publicKey),
  ) // 65 bytes

  const uaPublicKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: uaPublicKey },
      ephemeral.privateKey,
      256,
    ),
  )

  // Combine with the auth secret (RFC 8291 §3.4), then derive CEK + nonce
  // with the message salt (RFC 8188).
  const keyInfo = concat(utf8('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(ecdhSecret, authSecret, keyInfo, 32)
  const cek = await hkdf(ikm, salt, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(ikm, salt, utf8('Content-Encoding: nonce\0'), 12)

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, [
    'encrypt',
  ])
  // Single record: payload followed by the 0x02 last-record delimiter.
  const plaintext = concat(payload, new Uint8Array([0x02]))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      aesKey,
      plaintext,
    ),
  )

  // aes128gcm header: salt(16) | record size(4) | idlen(1) | keyid(as_public).
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  const header = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic)
  return concat(header, ciphertext)
}

// ---- Sending --------------------------------------------------------------

export interface SendResult {
  ok: boolean
  status: number
  /** True when the subscription is gone (404/410) and should be pruned. */
  expired: boolean
}

/** True when VAPID keys are configured; push is a no-op otherwise. */
export function pushConfigured(env: Env): boolean {
  return Boolean(env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY)
}

/** Encrypt and POST a JSON payload to one subscription. */
export async function sendPush(
  env: Env,
  sub: PushSubscription,
  payload: unknown,
  now: number = Date.now(),
): Promise<SendResult> {
  const privateJwk = JSON.parse(env.VAPID_PRIVATE_KEY ?? '{}') as JsonWebKey
  const publicKey = env.VAPID_PUBLIC_KEY ?? ''
  const subject = env.VAPID_SUBJECT ?? 'mailto:admin@flipscorer.app'

  const body = await encryptPayload(sub, utf8(JSON.stringify(payload)))
  const auth = await vapidAuthHeader(
    audienceOf(sub.endpoint),
    subject,
    publicKey,
    privateJwk,
    now,
  )

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
    },
    body,
  })
  return {
    ok: res.ok,
    status: res.status,
    expired: res.status === 404 || res.status === 410,
  }
}
