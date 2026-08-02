import { describe, expect, it } from 'vitest'

import { avatarConfigSchema } from '@/domain/schema'
import type { AvatarConfig } from '@/domain/types'

import { generateAvatar, normalizeAvatar, randomAvatar } from './generate'
import { COUNTS } from './palette'

const HEX = /^#[0-9a-fA-F]{6}$/

function assertValid(config: AvatarConfig) {
  expect(config.skinTone).toBeGreaterThanOrEqual(0)
  expect(config.skinTone).toBeLessThan(COUNTS.skinTone)
  expect(config.faceShape).toBeLessThan(COUNTS.faceShape)
  expect(config.hairStyle).toBeLessThan(COUNTS.hairStyle)
  expect(config.eyes).toBeLessThan(COUNTS.eyes)
  expect(config.eyebrows).toBeLessThan(COUNTS.eyebrows)
  expect(config.mouth).toBeLessThan(COUNTS.mouth)
  expect(config.glasses).toBeLessThan(COUNTS.glasses)
  expect(config.facialHair).toBeLessThan(COUNTS.facialHair)
  expect(config.accessory).toBeLessThan(COUNTS.accessory)
  expect(config.hairColour).toMatch(HEX)
  expect(config.shirtColour).toMatch(HEX)
  expect(config.backgroundColour).toMatch(HEX)
}

describe('generateAvatar — determinism', () => {
  it('produces the same avatar for the same seed', () => {
    expect(generateAvatar('Ben')).toEqual(generateAvatar('Ben'))
    expect(generateAvatar('Billy Regan')).toEqual(generateAvatar('Billy Regan'))
  })

  it('produces valid, in-range configs', () => {
    for (const seed of ['a', 'Ben', 'Billy', 'Player 1', '🎲', '']) {
      assertValid(generateAvatar(seed))
    }
  })

  it('produces noticeably different avatars for different seeds', () => {
    const seeds = Array.from({ length: 60 }, (_, i) => `seed-${i}`)
    const unique = new Set(seeds.map((s) => JSON.stringify(generateAvatar(s))))
    // Independent features across 60 seeds should be almost entirely distinct.
    expect(unique.size).toBeGreaterThan(55)
  })
})

describe('randomAvatar', () => {
  it('generates valid configs that differ between calls', () => {
    const a = randomAvatar()
    const b = randomAvatar()
    assertValid(a)
    assertValid(b)
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b))
  })
})

describe('serialisation', () => {
  it('round-trips through JSON unchanged', () => {
    const config = generateAvatar('Ada')
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })

  it('validates against the shared avatar schema', () => {
    const result = avatarConfigSchema.safeParse(generateAvatar('Grace'))
    expect(result.success).toBe(true)
  })
})

describe('normalizeAvatar — guards untrusted input', () => {
  it('wraps out-of-range indices into range and fixes bad colours', () => {
    const normalised = normalizeAvatar({
      skinTone: 999,
      faceShape: -3,
      hairStyle: 100,
      hairColour: 'not-a-colour',
      eyes: 4.7,
      eyebrows: -1,
      mouth: 50,
      glasses: 9,
      facialHair: 8,
      accessory: 12,
      shirtColour: '#zzzzzz',
      backgroundColour: '#123456',
    })
    assertValid(normalised)
    expect(normalised.backgroundColour).toBe('#123456')
  })

  it('fills a completely empty object with valid defaults', () => {
    assertValid(normalizeAvatar({}))
  })
})

describe('performance', () => {
  it('generates thousands of avatars quickly', () => {
    const start = performance.now()
    for (let i = 0; i < 5000; i += 1) generateAvatar(`p-${i}`)
    const elapsed = performance.now() - start
    // Pure integer maths — comfortably well under this generous ceiling.
    expect(elapsed).toBeLessThan(500)
  })
})
