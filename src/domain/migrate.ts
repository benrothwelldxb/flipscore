import type { Game } from './types'

/** Bring a persisted/imported game up to the current schema (fills sync fields). */
export function migrateGame(raw: unknown): Game {
  const g = raw as Game
  return {
    ...g,
    favorite: g.favorite ?? false,
    finishedAt:
      g.finishedAt ??
      (g.status === 'finished' ? (g.updatedAt ?? Date.now()) : null),
    rev: g.rev ?? 1,
    deletedAt: g.deletedAt ?? null,
  }
}
