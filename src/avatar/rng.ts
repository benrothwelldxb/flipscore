/**
 * A tiny deterministic PRNG seeded from a string (xmur3 hash → mulberry32).
 * The same seed always yields the same sequence, which is what makes avatar
 * generation reproducible across devices without transferring anything but the
 * seed. Framework-free and dependency-free.
 */
export type Rng = () => number

export function makeRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = (h ^ (h >>> 16)) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A random integer in [0, count). */
export function pick(rng: Rng, count: number): number {
  return Math.floor(rng() * count)
}

/** A random element of an array. */
export function pickItem<T>(rng: Rng, items: readonly T[]): T {
  return items[pick(rng, items.length)]
}

/**
 * Bias an optional feature (index 0 = "none") toward being absent, so avatars
 * aren't cluttered with glasses + beard + hat all at once. With probability
 * `noneChance` returns 0, otherwise a random present variant in [1, count).
 */
export function pickOptional(
  rng: Rng,
  count: number,
  noneChance = 0.5,
): number {
  if (rng() < noneChance) return 0
  return 1 + pick(rng, count - 1)
}
