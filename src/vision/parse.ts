import { MODIFIERS, NUMBER_CARDS, type Modifier } from '@/domain/flip7'

import type { DetectedCard } from './types'

/** A single recognised text fragment with the recognizer's confidence (0–1). */
export interface OcrToken {
  text: string
  confidence: number
}

const NUMBER_SET = new Set<number>(NUMBER_CARDS)
const MODIFIER_SET = new Set<string>(MODIFIERS)

/**
 * Pure mapping from recognised text fragments to Flip 7 card detections.
 *
 * This is the deterministic heart of Camera Scoring — every recogniser (OCR
 * today, a trained model tomorrow) ultimately produces text/label fragments,
 * and this turns them into cards. It is exhaustively unit-tested so the fuzzy,
 * untestable part (the model) is the only thing that can vary.
 *
 * Detections are de-duplicated (a Flip 7 hand holds each number and modifier at
 * most once) keeping the highest confidence, and returned in a stable order.
 */
export function parseTokens(tokens: OcrToken[]): DetectedCard[] {
  const numbers = new Map<number, number>()
  const modifiers = new Map<string, number>()
  let flip7: number | null = null
  let bust: number | null = null

  for (const { text, confidence } of tokens) {
    if (!text.trim()) continue
    const upper = text.toUpperCase()
    const compact = upper.replace(/\s+/g, '')

    if (/BUST(ED)?/.test(compact)) {
      bust = Math.max(bust ?? 0, confidence)
      continue
    }
    if (/FLIP7|FLIP7X?/.test(compact) || /FLIP\s*7/.test(upper)) {
      flip7 = Math.max(flip7 ?? 0, confidence)
      continue
    }

    const plus = compact.match(/^\+(\d{1,2})$/)
    if (plus && MODIFIER_SET.has(`+${plus[1]}`)) {
      const mod = `+${plus[1]}`
      modifiers.set(mod, Math.max(modifiers.get(mod) ?? 0, confidence))
      continue
    }
    // ×2 / x2 / X2 / *2
    if (/^[X×*]2$/.test(compact)) {
      modifiers.set('x2', Math.max(modifiers.get('x2') ?? 0, confidence))
      continue
    }

    const num = compact.match(/^(\d{1,2})$/)
    if (num) {
      const value = parseInt(num[1], 10)
      if (NUMBER_SET.has(value)) {
        numbers.set(value, Math.max(numbers.get(value) ?? 0, confidence))
      }
    }
  }

  const cards: DetectedCard[] = []
  for (const [value, confidence] of [...numbers.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    cards.push({ kind: 'number', value, confidence })
  }
  // Emit modifiers in the canonical deck order.
  for (const mod of MODIFIERS as readonly Modifier[]) {
    const confidence = modifiers.get(mod)
    if (confidence != null)
      cards.push({ kind: 'modifier', value: mod, confidence })
  }
  if (flip7 != null) cards.push({ kind: 'flip7', confidence: flip7 })
  if (bust != null) cards.push({ kind: 'bust', confidence: bust })
  return cards
}
