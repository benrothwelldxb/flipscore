import { z } from 'zod'

import { DEFAULT_TARGET_SCORE, PLAYER_LIMITS } from './types'

export const playerNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(20, 'Keep names under 20 characters')

export const targetScoreSchema = z
  .number({ message: 'Enter a target score' })
  .int('Whole numbers only')
  .min(1, 'Target must be at least 1')
  .max(100000, 'That target is too high')

/** Scores may be negative (some card games subtract), but must be whole. */
export const scoreSchema = z
  .number({ message: 'Enter a score' })
  .int('Whole numbers only')
  .min(-100000, 'That score is too low')
  .max(100000, 'That score is too high')

export type ScoreValidation =
  { valid: true; value: number } | { valid: false; error: string }

/** Validate raw manual input (from a text field) into a score. */
export function validateScoreInput(raw: string): ScoreValidation {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '-') {
    return { valid: false, error: 'Enter a score' }
  }
  if (!/^-?\d+$/.test(trimmed)) {
    return { valid: false, error: 'Whole numbers only' }
  }
  const parsed = Number(trimmed)
  const result = scoreSchema.safeParse(parsed)
  if (!result.success) {
    return { valid: false, error: result.error.issues[0].message }
  }
  return { valid: true, value: result.data }
}

export const gameSetupSchema = z.object({
  name: z.string().trim().max(40, 'Keep the name short').optional(),
  targetScore: targetScoreSchema,
  players: z
    .array(z.object({ name: playerNameSchema }))
    .min(PLAYER_LIMITS.min, `Add at least ${PLAYER_LIMITS.min} players`)
    .max(PLAYER_LIMITS.max, `Up to ${PLAYER_LIMITS.max} players`),
})

export const DEFAULTS = { targetScore: DEFAULT_TARGET_SCORE } as const
