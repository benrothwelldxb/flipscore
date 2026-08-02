import { z } from 'zod'

import { gameSchema, roundFlagsSchema } from '@/domain/schema'
import type { Game, RoundFlags } from '@/domain/types'

/**
 * Connected-mode wire protocol.
 *
 * Topology is a host-authoritative star: every guest holds a duplex link to the
 * host and nothing else. The host owns the one true {@link Game}; guests hold a
 * read-only replica and may only *request* their own score. All messages are
 * plain JSON so the same envelope works over a WebRTC data channel, a relayed
 * WebSocket, or an in-process mock link.
 *
 * The protocol is versioned. A peer that speaks a different major version is
 * rejected at join rather than fed data it may misread.
 */
export const PROTOCOL_VERSION = 1

// ---- Guest → Host ---------------------------------------------------------

const joinSchema = z.object({
  t: z.literal('join'),
  v: z.number(),
  /** Reconnect token from a previous accept, if any. */
  token: z.string().optional(),
  name: z.string(),
  /** Preferred colour key; the host may override on collision. */
  color: z.string().optional(),
})

const scoreSchema = z.object({
  t: z.literal('score'),
  v: z.number(),
  /** Round the guest believes is current; the host rejects stale rounds. */
  round: z.number(),
  value: z.number(),
  flags: roundFlagsSchema.optional(),
})

const leaveSchema = z.object({
  t: z.literal('leave'),
  v: z.number(),
})

const pingSchema = z.object({
  t: z.literal('ping'),
  v: z.number(),
  ts: z.number(),
})

export const guestMessageSchema = z.discriminatedUnion('t', [
  joinSchema,
  scoreSchema,
  leaveSchema,
  pingSchema,
])
export type GuestMessage = z.infer<typeof guestMessageSchema>

// ---- Host → Guest ---------------------------------------------------------

export type RejectReason =
  'full' | 'name-taken' | 'started' | 'not-found' | 'version'

const acceptedSchema = z.object({
  t: z.literal('accepted'),
  v: z.number(),
  /** The seat (player id) this guest now owns. */
  playerId: z.string(),
  /** Secret used to reclaim this seat after a disconnect. */
  token: z.string(),
  snapshot: gameSchema,
})

const rejectedSchema = z.object({
  t: z.literal('rejected'),
  v: z.number(),
  reason: z.enum(['full', 'name-taken', 'started', 'not-found', 'version']),
})

const syncSchema = z.object({
  t: z.literal('sync'),
  v: z.number(),
  snapshot: gameSchema,
})

const byeSchema = z.object({
  t: z.literal('bye'),
  v: z.number(),
  reason: z.enum(['host-closing', 'kicked']),
})

const pongSchema = z.object({
  t: z.literal('pong'),
  v: z.number(),
  ts: z.number(),
})

export const hostMessageSchema = z.discriminatedUnion('t', [
  acceptedSchema,
  rejectedSchema,
  syncSchema,
  byeSchema,
  pongSchema,
])
export type HostMessage = z.infer<typeof hostMessageSchema>

// ---- Encode / decode ------------------------------------------------------

export function encode(message: GuestMessage | HostMessage): string {
  return JSON.stringify(message)
}

/** Parse + validate a message from a guest. Returns null on anything invalid. */
export function decodeGuestMessage(raw: string): GuestMessage | null {
  return safeParse(raw, guestMessageSchema)
}

/** Parse + validate a message from the host. Returns null on anything invalid. */
export function decodeHostMessage(raw: string): HostMessage | null {
  return safeParse(raw, hostMessageSchema)
}

function safeParse<T>(raw: string, schema: z.ZodType<T>): T | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  const result = schema.safeParse(data)
  return result.success ? result.data : null
}

// ---- Message constructors -------------------------------------------------

export const msg = {
  join: (name: string, token?: string, color?: string): GuestMessage => ({
    t: 'join',
    v: PROTOCOL_VERSION,
    name,
    token,
    color,
  }),
  score: (round: number, value: number, flags?: RoundFlags): GuestMessage => ({
    t: 'score',
    v: PROTOCOL_VERSION,
    round,
    value,
    flags,
  }),
  leave: (): GuestMessage => ({ t: 'leave', v: PROTOCOL_VERSION }),
  ping: (ts: number): GuestMessage => ({ t: 'ping', v: PROTOCOL_VERSION, ts }),

  accepted: (playerId: string, token: string, snapshot: Game): HostMessage => ({
    t: 'accepted',
    v: PROTOCOL_VERSION,
    playerId,
    token,
    snapshot,
  }),
  rejected: (reason: RejectReason): HostMessage => ({
    t: 'rejected',
    v: PROTOCOL_VERSION,
    reason,
  }),
  sync: (snapshot: Game): HostMessage => ({
    t: 'sync',
    v: PROTOCOL_VERSION,
    snapshot,
  }),
  bye: (reason: 'host-closing' | 'kicked'): HostMessage => ({
    t: 'bye',
    v: PROTOCOL_VERSION,
    reason,
  }),
  pong: (ts: number): HostMessage => ({ t: 'pong', v: PROTOCOL_VERSION, ts }),
} as const

/** Two protocol versions are compatible when their major (integer) part matches. */
export function isCompatibleVersion(theirs: number): boolean {
  return Math.floor(theirs) === Math.floor(PROTOCOL_VERSION)
}
