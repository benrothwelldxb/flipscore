import { describe, expect, it } from 'vitest'

import {
  emptySelection,
  FLIP7_BONUS,
  flatValue,
  scoreFlip7,
  setRoundBonus,
  toggleBust,
  toggleModifier,
  toggleNumber,
  type Flip7Selection,
} from './flip7'

function sel(overrides: Partial<Flip7Selection> = {}): Flip7Selection {
  return { ...emptySelection(), ...overrides }
}

describe('flatValue', () => {
  it.each([
    ['+2', 2],
    ['+4', 4],
    ['+6', 6],
    ['+8', 8],
    ['+10', 10],
    ['x2', 0],
  ] as const)('%s → %i', (modifier, value) => {
    expect(flatValue(modifier)).toBe(value)
  })
})

describe('scoreFlip7 — number cards', () => {
  it('empty selection scores 0', () => {
    const result = scoreFlip7(sel())
    expect(result.total).toBe(0)
    expect(result.isFlip7).toBe(false)
    expect(result.busted).toBe(false)
  })

  it('sums a single number card', () => {
    expect(scoreFlip7(sel({ numbers: [9] })).total).toBe(9)
  })

  it('sums multiple unique number cards', () => {
    expect(scoreFlip7(sel({ numbers: [3, 5, 10] })).total).toBe(18)
  })

  it('counts a zero card as zero, not nothing', () => {
    const result = scoreFlip7(sel({ numbers: [0, 4] }))
    expect(result.total).toBe(4)
    expect(result.numberSum).toBe(4)
  })

  it('ignores duplicate number values but reports them', () => {
    const result = scoreFlip7(sel({ numbers: [5, 5, 3] }))
    expect(result.total).toBe(8) // 5 + 3, second 5 ignored
    expect(result.duplicateNumbers).toEqual([5])
  })
})

describe('scoreFlip7 — modifiers', () => {
  it('adds flat modifiers', () => {
    expect(scoreFlip7(sel({ numbers: [6], modifiers: ['+4'] })).total).toBe(10)
  })

  it('adds multiple flat modifiers', () => {
    const result = scoreFlip7(sel({ numbers: [6], modifiers: ['+4', '+10'] }))
    expect(result.total).toBe(20)
  })

  it('×2 doubles the number-card total only', () => {
    const result = scoreFlip7(sel({ numbers: [3, 5, 10], modifiers: ['x2'] }))
    expect(result.total).toBe(36) // 18 × 2
    expect(result.doubled).toBe(true)
  })

  it('×2 doubles numbers, then flat modifiers are added (not doubled)', () => {
    const result = scoreFlip7(
      sel({ numbers: [3, 5, 10], modifiers: ['x2', '+4'] }),
    )
    expect(result.total).toBe(40) // (18 × 2) + 4
  })

  it('×2 with no number cards scores 0 from doubling', () => {
    expect(scoreFlip7(sel({ modifiers: ['x2'] })).total).toBe(0)
  })
})

describe('scoreFlip7 — Flip 7 bonus', () => {
  it('awards +15 for 7 unique number cards', () => {
    const result = scoreFlip7(sel({ numbers: [1, 2, 3, 4, 5, 6, 7] }))
    expect(result.isFlip7).toBe(true)
    expect(result.total).toBe(28 + FLIP7_BONUS) // 28 + 15 = 43
  })

  it('does not award the bonus for only 6 unique cards', () => {
    const result = scoreFlip7(sel({ numbers: [1, 2, 3, 4, 5, 6] }))
    expect(result.isFlip7).toBe(false)
    expect(result.total).toBe(21)
  })

  it('does not count duplicates toward the Flip 7 count', () => {
    const result = scoreFlip7(sel({ numbers: [1, 1, 2, 3, 4, 5, 6] }))
    expect(result.isFlip7).toBe(false) // only 6 unique
    expect(result.total).toBe(21)
  })

  it('combines Flip 7 with ×2 and flat modifiers correctly', () => {
    const result = scoreFlip7(
      sel({ numbers: [0, 1, 2, 3, 4, 5, 6], modifiers: ['x2', '+10'] }),
    )
    // unique sum 21 → ×2 = 42, + 10 flat, + 15 flip7 = 67
    expect(result.total).toBe(67)
    expect(result.isFlip7).toBe(true)
  })
})

describe('scoreFlip7 — bust', () => {
  it('scores 0 when busted, ignoring everything else', () => {
    const result = scoreFlip7(
      sel({
        numbers: [1, 2, 3, 4, 5, 6, 7],
        modifiers: ['x2', '+10'],
        roundBonus: 20,
        busted: true,
      }),
    )
    expect(result.total).toBe(0)
    expect(result.busted).toBe(true)
    expect(result.isFlip7).toBe(false)
  })
})

describe('scoreFlip7 — round bonus', () => {
  it('adds a positive round bonus', () => {
    expect(scoreFlip7(sel({ numbers: [5], roundBonus: 10 })).total).toBe(15)
  })

  it('supports a negative round bonus', () => {
    expect(scoreFlip7(sel({ numbers: [10], roundBonus: -5 })).total).toBe(5)
  })
})

describe('scoreFlip7 — breakdown invariant', () => {
  const scenarios: Flip7Selection[] = [
    sel(),
    sel({ numbers: [9] }),
    sel({ numbers: [3, 5, 10], modifiers: ['x2', '+4'] }),
    sel({ numbers: [1, 2, 3, 4, 5, 6, 7], modifiers: ['+10'] }),
    sel({ numbers: [2, 4], modifiers: ['+2', '+6'], roundBonus: 7 }),
    sel({ numbers: [1, 2, 3, 4, 5, 6, 7], busted: true }),
  ]

  it.each(scenarios)('breakdown sums to total (%#)', (selection) => {
    const result = scoreFlip7(selection)
    const sum = result.breakdown.reduce((acc, line) => acc + line.value, 0)
    expect(sum).toBe(result.total)
  })
})

describe('selection transforms', () => {
  it('toggleNumber adds then removes', () => {
    let s = toggleNumber(emptySelection(), 7)
    expect(s.numbers).toEqual([7])
    s = toggleNumber(s, 7)
    expect(s.numbers).toEqual([])
  })

  it('toggleModifier adds then removes', () => {
    let s = toggleModifier(emptySelection(), 'x2')
    expect(s.modifiers).toEqual(['x2'])
    s = toggleModifier(s, 'x2')
    expect(s.modifiers).toEqual([])
  })

  it('toggleBust flips the flag', () => {
    expect(toggleBust(emptySelection()).busted).toBe(true)
    expect(toggleBust(toggleBust(emptySelection())).busted).toBe(false)
  })

  it('setRoundBonus sets the value', () => {
    expect(setRoundBonus(emptySelection(), 25).roundBonus).toBe(25)
  })

  it('transforms never mutate the input', () => {
    const original = emptySelection()
    toggleNumber(original, 5)
    toggleModifier(original, '+2')
    toggleBust(original)
    setRoundBonus(original, 9)
    expect(original).toEqual(emptySelection())
  })
})

describe('scoreFlip7 — edge cases', () => {
  it('awards the bonus for 8+ unique numbers (≥7 rule)', () => {
    const result = scoreFlip7(sel({ numbers: [0, 1, 2, 3, 4, 5, 6, 7] }))
    expect(result.isFlip7).toBe(true)
    expect(result.total).toBe(28 + FLIP7_BONUS) // 0+…+7 = 28, +15 = 43
  })

  it('scores all 13 number cards', () => {
    const result = scoreFlip7(sel({ numbers: [...Array(13).keys()] }))
    expect(result.numberSum).toBe(78)
    expect(result.isFlip7).toBe(true)
    expect(result.total).toBe(78 + FLIP7_BONUS)
  })

  it('applies flat modifiers with no number cards', () => {
    expect(scoreFlip7(sel({ modifiers: ['+4'] })).total).toBe(4)
  })

  it('awards Flip 7 even when a duplicate is present, and reports it', () => {
    const result = scoreFlip7(sel({ numbers: [1, 1, 2, 3, 4, 5, 6, 7] }))
    expect(result.isFlip7).toBe(true) // 7 unique
    expect(result.total).toBe(28 + FLIP7_BONUS)
    expect(result.duplicateNumbers).toEqual([1])
  })

  it('still reports duplicates on a busted hand', () => {
    const result = scoreFlip7(sel({ numbers: [3, 3, 8], busted: true }))
    expect(result.total).toBe(0)
    expect(result.duplicateNumbers).toEqual([3])
  })

  it('doubles a zero-only hand then adds a flat modifier', () => {
    expect(
      scoreFlip7(sel({ numbers: [0], modifiers: ['x2', '+10'] })).total,
    ).toBe(10)
  })

  it('allows a net-negative total from a large negative round bonus', () => {
    expect(scoreFlip7(sel({ numbers: [5], roundBonus: -20 })).total).toBe(-15)
  })

  it('omits a round-bonus line when the bonus is zero', () => {
    const result = scoreFlip7(sel({ numbers: [5], roundBonus: 0 }))
    expect(result.breakdown.some((l) => l.label === 'Round bonus')).toBe(false)
  })

  it('the ×2 breakdown line equals the number sum', () => {
    const result = scoreFlip7(sel({ numbers: [4, 6], modifiers: ['x2'] }))
    const doubleLine = result.breakdown.find((l) => l.label === '×2 doubler')
    expect(doubleLine?.value).toBe(10)
  })
})
