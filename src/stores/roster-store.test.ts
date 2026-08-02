import { beforeEach, describe, expect, it } from 'vitest'

import { useRosterStore } from './roster-store'

describe('roster store', () => {
  beforeEach(() => useRosterStore.getState().clear())

  it('remembers named players, dedupes by name, and skips placeholders', () => {
    useRosterStore.getState().rememberMany([
      { name: 'Ada', color: 'red' },
      { name: 'Player 1', color: 'blue' }, // seeded placeholder — skipped
      { name: '   ', color: 'green' }, // blank — skipped
    ])
    expect(useRosterStore.getState().players.map((p) => p.name)).toEqual([
      'Ada',
    ])
  })

  it('updates the colour when a name is remembered again', () => {
    useRosterStore.getState().rememberMany([{ name: 'Ada', color: 'red' }])
    useRosterStore.getState().rememberMany([{ name: 'ada', color: 'green' }])
    const players = useRosterStore.getState().players
    expect(players).toHaveLength(1)
    expect(players[0]).toMatchObject({ name: 'ada', color: 'green' })
  })

  it('forgets a player by id', () => {
    useRosterStore.getState().rememberMany([{ name: 'Bo', color: 'teal' }])
    const id = useRosterStore.getState().players[0].id
    useRosterStore.getState().forget(id)
    expect(useRosterStore.getState().players).toEqual([])
  })
})
