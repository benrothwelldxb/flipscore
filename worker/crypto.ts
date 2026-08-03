// Small cryptographic helpers for Cloud Accounts, using the Web Crypto API that
// is a global in both the Workers runtime and Node/vitest. Kept dependency-free
// and pure so they can be unit-tested directly.

/** A cryptographically-random, zero-padded 6-digit sign-in code (000000–999999). */
export function randomCode(): string {
  const range = 1_000_000
  // Reject the tail of the 32-bit space that would bias the modulo.
  const limit = Math.floor(0xffff_ffff / range) * range
  const buf = new Uint32Array(1)
  let n: number
  do {
    crypto.getRandomValues(buf)
    n = buf[0]
  } while (n >= limit)
  return String(n % range).padStart(6, '0')
}

/** Base64url encode raw bytes (no padding), for opaque tokens/ids. */
function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A URL-safe, 256-bit random token — used as the raw bearer session token. */
export function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64url(bytes)
}

/** A short opaque id with a human-readable prefix, e.g. `acct_a1b2c3…`. */
export function randomId(prefix: string): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return `${prefix}_${base64url(bytes)}`
}

/** Lowercase hex SHA-256 of a string. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Constant-time string comparison, to keep hash checks free of timing signal.
 * Both inputs are hex digests of equal length in practice.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
