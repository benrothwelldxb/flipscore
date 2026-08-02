import { describe, expect, it } from 'vitest'

import { parseTokens } from './parse'

const tok = (text: string, confidence = 0.9) => ({ text, confidence })

describe('parseTokens', () => {
  it('recognises number cards within 0–12 and drops out-of-range', () => {
    const cards = parseTokens([
      tok('3'),
      tok('0'),
      tok('12'),
      tok('13'),
      tok('99'),
    ])
    expect(
      cards.filter((c) => c.kind === 'number').map((c) => c.value),
    ).toEqual([0, 3, 12])
  })

  it('recognises modifier cards including ×2 spellings', () => {
    const cards = parseTokens([tok('+2'), tok('+10'), tok('X2')])
    expect(
      cards.filter((c) => c.kind === 'modifier').map((c) => c.value),
    ).toEqual(['+2', '+10', 'x2'])
    expect(parseTokens([tok('×2')])[0]).toMatchObject({
      kind: 'modifier',
      value: 'x2',
    })
  })

  it('recognises Flip 7 and Bust text', () => {
    expect(parseTokens([tok('FLIP 7')])[0].kind).toBe('flip7')
    expect(parseTokens([tok('Flip7')])[0].kind).toBe('flip7')
    expect(parseTokens([tok('BUST')])[0].kind).toBe('bust')
    expect(parseTokens([tok('busted')])[0].kind).toBe('bust')
  })

  it('de-duplicates and keeps the highest confidence', () => {
    const cards = parseTokens([
      tok('5', 0.4),
      tok('5', 0.8),
      tok('+2', 0.3),
      tok('+2', 0.6),
    ])
    const five = cards.find((c) => c.kind === 'number')
    const mod = cards.find((c) => c.kind === 'modifier')
    expect(cards).toHaveLength(2)
    expect(five?.confidence).toBe(0.8)
    expect(mod?.confidence).toBe(0.6)
  })

  it('ignores unrecognisable junk', () => {
    expect(parseTokens([tok('%'), tok('hello'), tok('+3'), tok('')])).toEqual(
      [],
    )
  })

  it('returns cards in a stable order (numbers, modifiers, flip7, bust)', () => {
    const cards = parseTokens([
      tok('BUST'),
      tok('x2'),
      tok('5'),
      tok('1'),
      tok('+4'),
    ])
    expect(cards.map((c) => c.kind)).toEqual([
      'number',
      'number',
      'modifier',
      'modifier',
      'bust',
    ])
    expect(
      cards.filter((c) => c.kind === 'number').map((c) => c.value),
    ).toEqual([1, 5])
  })
})
