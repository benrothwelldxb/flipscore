import { z } from 'zod'

import { migrateGame } from './migrate'
import { gameSchema } from './schema'
import { GAMES_SCHEMA_VERSION, type Game } from './types'

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
