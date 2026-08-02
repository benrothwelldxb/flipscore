import {
  emptySelection,
  MODIFIERS,
  toggleBust,
  toggleModifier,
  toggleNumber,
  type Flip7Selection,
  type Modifier,
} from '@/domain/flip7'

import type { DetectedCard } from './types'

function isModifier(value: unknown): value is Modifier {
  return (
    typeof value === 'string' &&
    (MODIFIERS as readonly string[]).includes(value)
  )
}

/**
 * Turn detected cards into a Flip 7 selection the Card Builder can then present
 * for correction and score. Detections are already de-duplicated, so each toggle
 * adds exactly once. The `flip7` detection is informational — the Flip 7 bonus
 * is derived from having seven unique numbers by the scoring engine itself.
 */
export function detectionsToSelection(cards: DetectedCard[]): Flip7Selection {
  let selection = emptySelection()
  for (const card of cards) {
    if (card.kind === 'number' && typeof card.value === 'number') {
      selection = toggleNumber(selection, card.value)
    } else if (card.kind === 'modifier' && isModifier(card.value)) {
      selection = toggleModifier(selection, card.value)
    } else if (card.kind === 'bust' && !selection.busted) {
      selection = toggleBust(selection)
    }
  }
  return selection
}
