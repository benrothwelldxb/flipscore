/**
 * Palettes and part counts for the avatar engine. Pure data — no React — so the
 * generator and the renderer share one source of truth, and indices in an
 * {@link AvatarConfig} can be clamped against these bounds.
 */

/** Outline ink — a dark near-navy that reads on every skin/background tone. */
export const INK = '#20233a'

/** Inclusive skin tones (stylised, not photoreal). */
export const SKIN_TONES = [
  '#ffe0bd',
  '#f6cfa4',
  '#eab68c',
  '#d99a6c',
  '#c17f4f',
  '#9c6034',
  '#734327',
  '#4f2e1c',
] as const

/** Natural + a few playful hair colours. */
export const HAIR_COLOURS = [
  '#2b2b30',
  '#4b3621',
  '#8d5524',
  '#b06b34',
  '#d9a441',
  '#e6d5a8',
  '#9aa0a6',
  '#e05a47',
  '#7c3aed',
  '#2563eb',
  '#22c55e',
  '#ec4899',
] as const

/** Vivid shirt colours (shared vibe with the player palette). */
export const SHIRT_COLOURS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
] as const

/** Soft background tints — light enough to read behind dark-outlined features
 *  on both light and dark app themes. */
export const BACKGROUNDS = [
  '#fde68a',
  '#bbf7d0',
  '#bae6fd',
  '#ddd6fe',
  '#fbcfe8',
  '#fed7aa',
  '#a7f3d0',
  '#e2e8f0',
] as const

/** Number of variants per feature (index 0 of the optional ones means "none"). */
export const COUNTS = {
  skinTone: SKIN_TONES.length,
  faceShape: 4,
  hairStyle: 8, // 0 = bald
  hairColour: HAIR_COLOURS.length,
  eyes: 5,
  eyebrows: 3,
  mouth: 6,
  glasses: 4, // 0 = none
  facialHair: 4, // 0 = none
  accessory: 5, // 0 = none
  shirtColour: SHIRT_COLOURS.length,
  backgroundColour: BACKGROUNDS.length,
} as const

/** Clamp an index into [0, count). Guards untrusted synced configs. */
export function clampIndex(value: number, count: number): number {
  if (!Number.isFinite(value)) return 0
  const n = Math.floor(value)
  return ((n % count) + count) % count
}

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/**
 * Lighten (amount > 0) or darken (amount < 0) a hex colour, for cheap
 * deterministic shadows and highlights without extra config.
 */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = toRgb(hex)
  const t = amount < 0 ? 0 : 255
  const p = Math.abs(amount)
  return toHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p)
}
