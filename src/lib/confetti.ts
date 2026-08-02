import confetti from 'canvas-confetti'

const COLORS = [
  '#7c3aed',
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#3b82f6',
  '#ec4899',
]

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/** A celebratory confetti burst. Skipped when the user prefers reduced motion. */
export function celebrate(): void {
  if (prefersReducedMotion()) return
  const options = { colors: COLORS, disableForReducedMotion: true }
  void confetti({
    ...options,
    particleCount: 90,
    spread: 75,
    origin: { y: 0.6 },
  })
  window.setTimeout(
    () =>
      void confetti({
        ...options,
        particleCount: 60,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.7 },
      }),
    150,
  )
  window.setTimeout(
    () =>
      void confetti({
        ...options,
        particleCount: 60,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.7 },
      }),
    300,
  )
}
