// Mint a VAPID keypair for Web Push (RFC 8292). Run once, then store the
// outputs as Worker config:
//
//   node scripts/generate-vapid.mjs
//
//   VAPID_PUBLIC_KEY   -> a public var (also handed to the browser)
//   VAPID_PRIVATE_KEY  -> a secret:  wrangler secret put VAPID_PRIVATE_KEY
//   VAPID_SUBJECT      -> a mailto: or https: contact, e.g. mailto:you@app.com
//
// The private key is emitted as a JWK string (what worker/webpush.ts imports);
// the public key is the raw P-256 point, base64url-encoded (what the browser's
// pushManager.subscribe expects as applicationServerKey).

import { webcrypto as crypto } from 'node:crypto'

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64url')
}

const pair = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
)

const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
const publicRaw = new Uint8Array(
  await crypto.subtle.exportKey('raw', pair.publicKey),
)

// Drop key_ops/ext so the stored JWK imports cleanly on the Worker side.
delete privateJwk.key_ops
delete privateJwk.ext

const publicKey = b64url(publicRaw)

console.log('# --- FlipScorer VAPID keys — store these securely ---\n')
console.log('# Public key (var VAPID_PUBLIC_KEY, safe to expose):')
console.log(publicKey, '\n')
console.log(
  '# Private key (secret VAPID_PRIVATE_KEY — keep this off the client):',
)
console.log(JSON.stringify(privateJwk), '\n')
console.log('# Set them with:')
console.log(`#   wrangler secret put VAPID_PRIVATE_KEY`)
console.log(`#   (paste the JSON above when prompted)`)
console.log(`# and add to wrangler.toml [vars]:`)
console.log(`#   VAPID_PUBLIC_KEY = "${publicKey}"`)
console.log(`#   VAPID_SUBJECT = "mailto:you@example.com"`)
