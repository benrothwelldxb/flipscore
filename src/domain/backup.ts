import { z } from 'zod'

import { migrateGame } from './migrate'
import { GAMES_SCHEMA_VERSION, type Game } from './types'

const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  order: z.number(),
})

const roundSchema = z.object({
  id: z.string(),
  index: z.number(),
  scores: z.record(z.string(), z.number()),
  flags: z
    .record(
      z.string(),
      z.object({ flip7: z.boolean().optional(), bust: z.boolean().optional() }),
    )
    .optional(),
})

// All fields are listed so real values survive import; the sync fields are
// optional and filled by migrateGame when missing.
const gameSchema = z.object({
  id: z.string(),
  name: z.string(),
  players: z.array(playerSchema).min(1),
  rounds: z.array(roundSchema),
  settings: z.object({
    mode: z.enum(['host', 'pass', 'connected']),
    targetScore: z.number(),
  }),
  status: z.enum(['setup', 'playing', 'finished']),
  currentRoundIndex: z.number(),
  winnerId: z.string().nullable(),
  favorite: z.boolean().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
  finishedAt: z.number().nullable().optional(),
  rev: z.number().optional(),
  deletedAt: z.number().nullable().optional(),
})

const envelopeSchema = z.object({ games: z.array(gameSchema) })

/** Parse and validate an import file into normalized games, or null. */
export function parseImport(json: string): Game[] | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  const result = envelopeSchema.safeParse(data)
  if (!result.success) return null
  return result.data.games.map((g) => migrateGame(g))
}

/** Serialize games into a portable, versioned backup payload. */
export function exportPayload(games: Game[]): string {
  return JSON.stringify(
    {
      app: 'flipscorer',
      schemaVersion: GAMES_SCHEMA_VERSION,
      exportedAt: Date.now(),
      games,
    },
    null,
    2,
  )
}
