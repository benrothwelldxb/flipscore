/**
 * Short, human-friendly room codes. Used to name the signaling room (so a guest
 * can join by typing it if a camera fails) and shown under the QR code.
 *
 * The alphabet drops visually ambiguous characters (0/O, 1/I/L) so a code read
 * off a screen is unambiguous.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

function randomInt(max: number): number {
  const cryptoObj = globalThis.crypto
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const buf = new Uint32Array(1)
    // Reject the tail of the range that would bias the modulo.
    const limit = Math.floor(0xffffffff / max) * max
    for (;;) {
      cryptoObj.getRandomValues(buf)
      if (buf[0] < limit) return buf[0] % max
    }
  }
  return Math.floor(Math.random() * max)
}

export function createRoomCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)]
  }
  return code
}

/** Normalise user-typed input (case, stray spaces) to a comparable code. */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '')
}

export function isValidRoomCode(input: string): boolean {
  const code = normalizeRoomCode(input)
  return (
    code.length === CODE_LENGTH &&
    [...code].every((ch) => ALPHABET.includes(ch))
  )
}
