import { describe, expect, it } from 'vitest'

import {
  computeCardRarity,
  computeLegacyCard,
  rarityScore,
  seasonForDate,
} from './legacy'
import type { UnlockContext } from './cosmetics'
import type { Game, GameNight, Player } from './types'

function ctx(over: Partial<UnlockContext>): UnlockContext {
  return {
    level: 1,
    gamesPlayed: 0,
    wins: 0,
    winPct: 0,
    highestRound: 0,
    busts: 0,
    stickerCount: 0,
    comebacks: 0,
    collectionComplete: false,
    ...over,
  }
}

function P(id: string, name: string, order: number): Player {
  return { id, name, color: 'red', order }
}
const ROSTER = [P('a', 'Ada', 0), P('b', 'Bo', 1)]

let seq = 0
function mkGame(
  rounds: Record<string, number>[],
  winnerId: string,
  finishedAt: number,
): Game {
  seq += 1
  return {
    id: `g${seq}`,
    name: '',
    players: ROSTER,
    rounds: rounds.map((scores, i) => ({
      id: `g${seq}-${i}`,
      index: i,
      scores,
    })),
    settings: { mode: 'host', targetScore: 200 },
    status: 'finished',
    currentRoundIndex: rounds.length - 1,
    winnerId,
    favorite: false,
    createdAt: 0,
    updatedAt: finishedAt,
    finishedAt,
    rev: 1,
    deletedAt: null,
    gameNightId: 'n1',
  }
}

describe('card rarity', () => {
  it('scores breadth of play', () => {
    expect(rarityScore(ctx({ gamesPlayed: 10, wins: 5, level: 3 }))).toBe(
      10 * 2 + 5 * 3 + 3 * 10,
    )
  })

  it('climbs tiers with the score', () => {
    expect(computeCardRarity(ctx({})).key).toBe('bronze')
    expect(computeCardRarity(ctx({ level: 14 })).key).toBe('bronze') // 140
    expect(computeCardRarity(ctx({ level: 15 })).key).toBe('silver') // 150
    expect(computeCardRarity(ctx({ level: 40 })).key).toBe('gold') // 400
    expect(
      computeCardRarity(ctx({ level: 99, gamesPlayed: 800, wins: 400 })).key,
    ).toBe('legend')
  })
})

describe('seasonForDate', () => {
  it('starts at season 1 and advances each season', () => {
    expect(seasonForDate(Date.UTC(2026, 0, 1))).toBe(1)
    expect(seasonForDate(Date.UTC(2026, 0, 1) + 91 * 86400000 + 1000)).toBe(2)
  })
})

describe('computeLegacyCard', () => {
  const games = [
    mkGame([{ a: 200, b: 40 }], 'a', 100), // Ada wins
    mkGame([{ a: 20, b: 200 }], 'b', 200), // Bo wins
    // Ada trails then wins → comeback.
    mkGame(
      [
        { a: 5, b: 90 },
        { a: 210, b: 10 },
      ],
      'a',
      300,
    ),
  ]
  const night: GameNight = {
    id: 'n1',
    name: 'Friday Night',
    date: 0,
    players: ROSTER,
    createdAt: 0,
    updatedAt: 0,
    finishedAt: 400,
    rev: 1,
    deletedAt: null,
  }
  const card = computeLegacyCard({
    games,
    nights: [night],
    name: 'Ada',
    unlockedStickerIds: ['first-win', 'five-wins'],
    totalStickers: 43,
    profile: {
      titleId: 'champion',
      pinnedStickerIds: ['first-win', 'legend', 'nonsense'],
    },
    now: Date.UTC(2026, 1, 1),
  })

  it('derives core identity and stats automatically', () => {
    expect(card.name).toBe('Ada')
    expect(card.stats.wins).toBe(2)
    expect(card.stats.gamesPlayed).toBe(3)
    expect(card.favouriteModeLabel).toBe('Host')
    expect(card.favouriteOpponent).toBe('Bo')
    expect(card.favouriteNight).toBe('Friday Night')
  })

  it('detects the best comeback magnitude', () => {
    // In game 3 Ada trailed 90–5 (deficit 85) before winning.
    expect(card.stats.bestComeback).toBe(85)
  })

  it('awards XP and a level from participation', () => {
    expect(card.xp.total).toBeGreaterThan(0)
    expect(card.level.level).toBeGreaterThanOrEqual(1)
  })

  it('equips a valid unlocked title', () => {
    expect(card.title.id).toBe('champion')
  })

  it('only pins unlocked, valid stickers (max four)', () => {
    // legend + nonsense are dropped; first-win stays.
    expect(card.pinnedStickers.map((s) => s.id)).toEqual(['first-win'])
    expect(card.favouriteSticker?.id).toBe('first-win')
  })

  it('builds recent form oldest → newest, capped at six', () => {
    expect(card.recentForm).toHaveLength(3)
    expect(card.recentForm.at(-1)?.won).toBe(true) // most recent game (win)
  })

  it('falls back to the default title for a locked selection', () => {
    const locked = computeLegacyCard({
      games,
      nights: [],
      name: 'Ada',
      unlockedStickerIds: [],
      totalStickers: 43,
      profile: { titleId: 'legend' }, // not unlocked
      now: 0,
    })
    expect(locked.title.id).toBe('rookie')
  })
})
