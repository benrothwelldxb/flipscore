import { z } from 'zod'

/**
 * Zod schemas mirroring the domain model. Kept in one place so both the backup
 * import/export and the Connected-mode network protocol validate game data the
 * same way — untrusted input (an uploaded file or a message from a peer) is
 * never trusted without passing through these.
 */

export const avatarConfigSchema = z.object({
  skinTone: z.number(),
  faceShape: z.number(),
  hairStyle: z.number(),
  hairColour: z.string(),
  eyes: z.number(),
  eyebrows: z.number(),
  mouth: z.number(),
  glasses: z.number(),
  facialHair: z.number(),
  accessory: z.number(),
  shirtColour: z.string(),
  backgroundColour: z.string(),
})

export const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  order: z.number(),
  avatar: avatarConfigSchema.optional(),
})

export const roundFlagsSchema = z.object({
  flip7: z.boolean().optional(),
  bust: z.boolean().optional(),
})

export const roundSchema = z.object({
  id: z.string(),
  index: z.number(),
  scores: z.record(z.string(), z.number()),
  flags: z.record(z.string(), roundFlagsSchema).optional(),
})

// All fields are listed so real values survive a round-trip; the sync fields
// are optional and filled by migrateGame when missing (older saves / peers).
export const gameSchema = z.object({
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
  gameNightId: z.string().nullable().optional(),
})

export const gameNightSchema = z.object({
  id: z.string(),
  name: z.string(),
  venue: z.string().optional(),
  date: z.number(),
  notes: z.string().optional(),
  players: z.array(playerSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
  finishedAt: z.number().nullable(),
  rev: z.number(),
  deletedAt: z.number().nullable(),
})
