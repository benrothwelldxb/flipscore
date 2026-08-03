// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  randomCode,
  randomId,
  randomToken,
  sha256Hex,
  timingSafeEqual,
} from './crypto'

describe('randomCode', () => {
  it('is always a zero-padded 6-digit numeric string', () => {
    for (let i = 0; i < 500; i++) {
      expect(randomCode()).toMatch(/^\d{6}$/)
    }
  })

  it('produces variety (not a constant)', () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomCode()))
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('randomToken', () => {
  it('is url-safe, long, and effectively unique', () => {
    const a = randomToken()
    const b = randomToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a.length).toBeGreaterThanOrEqual(40)
    expect(a).not.toBe(b)
  })
})

describe('randomId', () => {
  it('carries its prefix and a url-safe body', () => {
    expect(randomId('acct')).toMatch(/^acct_[A-Za-z0-9_-]+$/)
  })
})

describe('sha256Hex', () => {
  it('matches the known SHA-256 vector for "abc"', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('is deterministic and input-sensitive', async () => {
    expect(await sha256Hex('flip')).toBe(await sha256Hex('flip'))
    expect(await sha256Hex('flip')).not.toBe(await sha256Hex('flop'))
  })
})

describe('timingSafeEqual', () => {
  it('is true only for identical strings', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true)
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false)
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
  })
})
