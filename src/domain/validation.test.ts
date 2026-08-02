import { describe, expect, it } from 'vitest'

import { gameSetupSchema, validateScoreInput } from './validation'

describe('validateScoreInput', () => {
  it.each([
    ['', 'Enter a score'],
    ['-', 'Enter a score'],
    ['abc', 'Whole numbers only'],
    ['1.5', 'Whole numbers only'],
    ['12x', 'Whole numbers only'],
  ])('rejects %o', (input, error) => {
    const result = validateScoreInput(input)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toBe(error)
  })

  it('accepts positive integers', () => {
    expect(validateScoreInput('25')).toEqual({ valid: true, value: 25 })
  })

  it('accepts negative integers', () => {
    expect(validateScoreInput('-7')).toEqual({ valid: true, value: -7 })
  })

  it('trims surrounding whitespace', () => {
    expect(validateScoreInput('  10 ')).toEqual({ valid: true, value: 10 })
  })

  it('rejects out-of-range values', () => {
    expect(validateScoreInput('9999999').valid).toBe(false)
  })
})

describe('gameSetupSchema', () => {
  it('accepts a valid setup', () => {
    const result = gameSetupSchema.safeParse({
      name: 'Rummy night',
      targetScore: 200,
      players: [{ name: 'A' }, { name: 'B' }],
    })
    expect(result.success).toBe(true)
  })

  it('requires at least two players', () => {
    const result = gameSetupSchema.safeParse({
      targetScore: 200,
      players: [{ name: 'A' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects blank player names', () => {
    const result = gameSetupSchema.safeParse({
      targetScore: 200,
      players: [{ name: 'A' }, { name: '   ' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-positive target', () => {
    const result = gameSetupSchema.safeParse({
      targetScore: 0,
      players: [{ name: 'A' }, { name: 'B' }],
    })
    expect(result.success).toBe(false)
  })
})
