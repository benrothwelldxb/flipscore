import { describe, expect, it } from 'vitest'

import {
  itemWins,
  mergeRecordLWW,
  mergeRevved,
  mergeStickerUnion,
  type SyncItem,
} from './sync'

interface Doc {
  id: string
  rev: number
  updatedAt: number
  deletedAt: number | null
  name?: string
}

function item(
  id: string,
  rev: number,
  updatedAt: number,
  data: unknown,
  deletedAt: number | null = null,
): SyncItem {
  return { collection: 'games', id, rev, updatedAt, deletedAt, data }
}

describe('itemWins', () => {
  it('prefers higher rev, then later updatedAt, and never on a tie', () => {
    expect(itemWins({ rev: 2, updatedAt: 1 }, { rev: 1, updatedAt: 999 })).toBe(
      true,
    )
    expect(itemWins({ rev: 1, updatedAt: 5 }, { rev: 1, updatedAt: 4 })).toBe(
      true,
    )
    expect(itemWins({ rev: 1, updatedAt: 4 }, { rev: 1, updatedAt: 4 })).toBe(
      false,
    )
    expect(itemWins({ rev: 1, updatedAt: 1 }, { rev: 2, updatedAt: 1 })).toBe(
      false,
    )
  })
})

describe('mergeRevved', () => {
  it('adds new records and reports change', () => {
    const local: Doc[] = []
    const { records, changed } = mergeRevved(local, [
      item('a', 1, 100, { id: 'a', rev: 1, updatedAt: 100, deletedAt: null }),
    ])
    expect(changed).toBe(true)
    expect(records.map((r) => r.id)).toEqual(['a'])
  })

  it('overwrites only when the incoming item wins', () => {
    const local: Doc[] = [
      { id: 'a', rev: 2, updatedAt: 200, deletedAt: null, name: 'local' },
    ]
    const stale = mergeRevved(local, [
      item('a', 1, 999, { id: 'a', rev: 1, updatedAt: 999, name: 'stale' }),
    ])
    expect(stale.changed).toBe(false)
    expect(stale.records).toBe(local) // same reference, no write
    expect(stale.records[0].name).toBe('local')

    const newer = mergeRevved(local, [
      item('a', 3, 1, { id: 'a', rev: 3, updatedAt: 1, name: 'newer' }),
    ])
    expect(newer.changed).toBe(true)
    expect(newer.records[0].name).toBe('newer')
  })

  it('carries tombstones through so deletes propagate', () => {
    const local: Doc[] = [{ id: 'a', rev: 1, updatedAt: 100, deletedAt: null }]
    const { records } = mergeRevved(local, [
      item(
        'a',
        2,
        200,
        { id: 'a', rev: 2, updatedAt: 200, deletedAt: 200 },
        200,
      ),
    ])
    expect(records[0].deletedAt).toBe(200)
  })
})

describe('mergeRecordLWW', () => {
  it('keeps the entry with the latest updatedAt', () => {
    const local = { ada: { titleId: 'x', updatedAt: 100 } }
    const older = mergeRecordLWW(local, [
      {
        collection: 'profiles',
        id: 'ada',
        rev: 1,
        updatedAt: 50,
        deletedAt: null,
        data: { titleId: 'y', updatedAt: 50 },
      },
    ])
    expect(older.changed).toBe(false)
    expect(older.record.ada.titleId).toBe('x')

    const newer = mergeRecordLWW(local, [
      {
        collection: 'profiles',
        id: 'ada',
        rev: 1,
        updatedAt: 200,
        deletedAt: null,
        data: { titleId: 'z', updatedAt: 200 },
      },
    ])
    expect(newer.changed).toBe(true)
    expect(newer.record.ada.titleId).toBe('z')
  })

  it('adds a key that is only on the remote', () => {
    const { record, changed } = mergeRecordLWW({}, [
      {
        collection: 'profiles',
        id: 'bo',
        rev: 1,
        updatedAt: 10,
        deletedAt: null,
        data: { updatedAt: 10 },
      },
    ])
    expect(changed).toBe(true)
    expect(Object.keys(record)).toEqual(['bo'])
  })
})

describe('mergeStickerUnion', () => {
  it('unions unlocks and keeps the earliest unlock time', () => {
    const local = { flip7: { id: 'flip7', unlockedAt: 500 } }
    const { record, changed } = mergeStickerUnion(local, [
      {
        collection: 'stickers',
        id: 'flip7',
        rev: 1,
        updatedAt: 300,
        deletedAt: null,
        data: { id: 'flip7', unlockedAt: 300 },
      },
      {
        collection: 'stickers',
        id: 'bust',
        rev: 1,
        updatedAt: 700,
        deletedAt: null,
        data: { id: 'bust', unlockedAt: 700 },
      },
    ])
    expect(changed).toBe(true)
    expect(record.flip7.unlockedAt).toBe(300) // earlier wins
    expect(record.bust.unlockedAt).toBe(700)
  })

  it('is a no-op when nothing new or earlier arrives', () => {
    const local = { flip7: { id: 'flip7', unlockedAt: 100 } }
    const { record, changed } = mergeStickerUnion(local, [
      {
        collection: 'stickers',
        id: 'flip7',
        rev: 1,
        updatedAt: 900,
        deletedAt: null,
        data: { id: 'flip7', unlockedAt: 900 },
      },
    ])
    expect(changed).toBe(false)
    expect(record).toBe(local)
  })
})
