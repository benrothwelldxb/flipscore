import type { AvatarConfig } from '@/domain/types'

import {
  BACKGROUNDS,
  clampIndex,
  COUNTS,
  HAIR_COLOURS,
  SHIRT_COLOURS,
} from './palette'
import { makeRng, pick, pickItem, pickOptional } from './rng'

const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * Deterministically build an avatar from a seed string. The same seed always
 * produces exactly the same config; different seeds vary across many
 * independent features, so they look noticeably different. The pick order is
 * fixed — never reorder these lines, or existing seeds would change.
 */
export function generateAvatar(seed: string): AvatarConfig {
  const rng = makeRng(seed)
  return {
    skinTone: pick(rng, COUNTS.skinTone),
    faceShape: pick(rng, COUNTS.faceShape),
    hairStyle: pick(rng, COUNTS.hairStyle),
    hairColour: pickItem(rng, HAIR_COLOURS),
    eyes: pick(rng, COUNTS.eyes),
    eyebrows: pick(rng, COUNTS.eyebrows),
    mouth: pick(rng, COUNTS.mouth),
    glasses: pickOptional(rng, COUNTS.glasses, 0.55),
    facialHair: pickOptional(rng, COUNTS.facialHair, 0.6),
    accessory: pickOptional(rng, COUNTS.accessory, 0.6),
    shirtColour: pickItem(rng, SHIRT_COLOURS),
    backgroundColour: pickItem(rng, BACKGROUNDS),
  }
}

/** A fresh random avatar (for Shuffle). Not reproducible across runs, by design. */
export function randomAvatar(): AvatarConfig {
  const seed =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.floor(Math.random() * 1e9)}`
  return generateAvatar(seed)
}

const colour = (value: unknown, fallback: string): string =>
  typeof value === 'string' && HEX.test(value) ? value : fallback

/**
 * Clamp/validate a (possibly untrusted) config from sync or import so a bad
 * index or colour can never break rendering. Indices wrap into range; invalid
 * colours fall back to a palette default.
 */
export function normalizeAvatar(raw: Partial<AvatarConfig>): AvatarConfig {
  return {
    skinTone: clampIndex(raw.skinTone ?? 0, COUNTS.skinTone),
    faceShape: clampIndex(raw.faceShape ?? 0, COUNTS.faceShape),
    hairStyle: clampIndex(raw.hairStyle ?? 0, COUNTS.hairStyle),
    hairColour: colour(raw.hairColour, HAIR_COLOURS[0]),
    eyes: clampIndex(raw.eyes ?? 0, COUNTS.eyes),
    eyebrows: clampIndex(raw.eyebrows ?? 0, COUNTS.eyebrows),
    mouth: clampIndex(raw.mouth ?? 0, COUNTS.mouth),
    glasses: clampIndex(raw.glasses ?? 0, COUNTS.glasses),
    facialHair: clampIndex(raw.facialHair ?? 0, COUNTS.facialHair),
    accessory: clampIndex(raw.accessory ?? 0, COUNTS.accessory),
    shirtColour: colour(raw.shirtColour, SHIRT_COLOURS[0]),
    backgroundColour: colour(raw.backgroundColour, BACKGROUNDS[0]),
  }
}
