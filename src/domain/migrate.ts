import { generateAvatar, normalizeAvatar } from '@/domain/avatar/generate'

import type { Game } from './types'

/** Bring a persisted/imported game up to the current schema (fills sync fields). */
export function migrateGame(raw: unknown): Game {
  const g = raw as Game
  return {
    ...g,
    players: (g.players ?? []).map((p) => ({
      ...p,
      // Normalise a stored/imported avatar so state is always valid regardless
      // of the consumer; generate one for older records that lack it.
      avatar: p.avatar
        ? normalizeAvatar(p.avatar)
        : generateAvatar(p.id || p.name),
    })),
    favorite: g.favorite ?? false,
    finishedAt:
      g.finishedAt ??
      (g.status === 'finished' ? (g.updatedAt ?? Date.now()) : null),
    rev: g.rev ?? 1,
    deletedAt: g.deletedAt ?? null,
  }
}
