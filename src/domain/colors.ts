export interface PlayerColor {
  key: string
  label: string
  hex: string
}

/** A vivid, distinguishable palette — enough distinct hues for 12 players. */
export const PLAYER_COLORS: readonly PlayerColor[] = [
  { key: 'red', label: 'Red', hex: '#ef4444' },
  { key: 'orange', label: 'Orange', hex: '#f97316' },
  { key: 'amber', label: 'Amber', hex: '#f59e0b' },
  { key: 'lime', label: 'Lime', hex: '#84cc16' },
  { key: 'green', label: 'Green', hex: '#22c55e' },
  { key: 'teal', label: 'Teal', hex: '#14b8a6' },
  { key: 'blue', label: 'Blue', hex: '#3b82f6' },
  { key: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { key: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { key: 'pink', label: 'Pink', hex: '#ec4899' },
  { key: 'rose', label: 'Rose', hex: '#f43f5e' },
  { key: 'slate', label: 'Slate', hex: '#64748b' },
] as const

const FALLBACK = PLAYER_COLORS[0]

export function colorByKey(key: string): PlayerColor {
  return PLAYER_COLORS.find((c) => c.key === key) ?? FALLBACK
}

/** The nth palette colour, wrapping around for large player counts. */
export function colorForIndex(index: number): PlayerColor {
  return PLAYER_COLORS[index % PLAYER_COLORS.length]
}

/**
 * Pick black or white text for legibility on a given background hex — whichever
 * yields the higher WCAG contrast ratio. Most of the vivid player palette needs
 * dark text to clear AA for small labels (e.g. avatar initials).
 */
export function readableTextColor(hex: string): '#000000' | '#ffffff' {
  const normalized = hex.replace('#', '')
  const r = parseInt(normalized.slice(0, 2), 16) / 255
  const g = parseInt(normalized.slice(2, 4), 16) / 255
  const b = parseInt(normalized.slice(4, 6), 16) / 255
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  const contrastWithBlack = (luminance + 0.05) / 0.05
  const contrastWithWhite = 1.05 / (luminance + 0.05)
  return contrastWithBlack >= contrastWithWhite ? '#000000' : '#ffffff'
}

/** Up to two initials from a display name. */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
