import { describe, expect, it } from 'vitest'

import { scoreFlip7 } from '@/domain/flip7'

import { detectionsToSelection } from './to-selection'
import type { DetectedCard } from './types'

const num = (value: number): DetectedCard => ({
  kind: 'number',
  value,
  confidence: 1,
})
const mod = (value: string): DetectedCard => ({
  kind: 'modifier',
  value,
  confidence: 1,
})

describe('detectionsToSelection', () => {
  it('maps number + modifier detections into a scored selection', () => {
    const selection = detectionsToSelection([num(3), num(5), mod('x2')])
    expect(scoreFlip7(selection).total).toBe((3 + 5) * 2)
  })

  it('derives the Flip 7 bonus from seven unique numbers', () => {
    const selection = detectionsToSelection([1, 2, 3, 4, 5, 6, 7].map(num))
    const result = scoreFlip7(selection)
    expect(result.isFlip7).toBe(true)
    expect(result.total).toBe(28 + 15)
  })

  it('applies a bust detection', () => {
    const selection = detectionsToSelection([
      num(9),
      { kind: 'bust', confidence: 1 },
    ])
    expect(selection.busted).toBe(true)
    expect(scoreFlip7(selection).total).toBe(0)
  })

  it('ignores an informational flip7 detection for the selection itself', () => {
    const selection = detectionsToSelection([
      num(4),
      { kind: 'flip7', confidence: 1 },
    ])
    expect(selection.numbers).toEqual([4])
  })
})
