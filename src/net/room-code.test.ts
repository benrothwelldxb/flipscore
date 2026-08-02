import { describe, expect, it } from 'vitest'

import { createRoomCode, isValidRoomCode, normalizeRoomCode } from './room-code'

describe('room codes', () => {
  it('creates a 6-character code from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = createRoomCode()
      expect(code).toHaveLength(6)
      expect(isValidRoomCode(code)).toBe(true)
      // No visually ambiguous characters.
      expect(code).not.toMatch(/[01OIL]/)
    }
  })

  it('normalises case and whitespace', () => {
    expect(normalizeRoomCode('  ab cd ef ')).toBe('ABCDEF')
  })

  it('rejects wrong length or illegal characters', () => {
    expect(isValidRoomCode('ABCDE')).toBe(false)
    expect(isValidRoomCode('ABCDE0')).toBe(false)
    expect(isValidRoomCode('ABCDEF')).toBe(true)
  })
})
