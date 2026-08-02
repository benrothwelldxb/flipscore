import { beforeEach, describe, expect, it } from 'vitest'

import { useProfileStore } from './profile-store'

const get = () => useProfileStore.getState()
const profile = (name: string) => get().profiles[name.toLowerCase()] ?? {}

describe('profile store', () => {
  beforeEach(() => useProfileStore.setState({ profiles: {} }))

  it('stores selections keyed by normalised name', () => {
    get().setTitle('Ada', 'champion')
    get().setBackground('  ADA ', 'ember')
    expect(profile('ada')).toMatchObject({
      titleId: 'champion',
      backgroundId: 'ember',
    })
  })

  it('sets and clears the accent colour', () => {
    get().setAccent('Ada', '#ff0000')
    expect(profile('Ada').accentColor).toBe('#ff0000')
    get().setAccent('Ada', undefined)
    expect(profile('Ada').accentColor).toBeUndefined()
  })

  it('pins and unpins stickers', () => {
    get().togglePin('Ada', 'first-win')
    get().togglePin('Ada', 'five-wins')
    expect(profile('Ada').pinnedStickerIds).toEqual(['first-win', 'five-wins'])
    get().togglePin('Ada', 'first-win')
    expect(profile('Ada').pinnedStickerIds).toEqual(['five-wins'])
  })

  it('caps pins at four', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) get().togglePin('Ada', id)
    expect(profile('Ada').pinnedStickerIds).toEqual(['a', 'b', 'c', 'd'])
  })

  it('keeps different players separate', () => {
    get().setTitle('Ada', 'champion')
    get().setTitle('Bo', 'legend')
    expect(profile('Ada').titleId).toBe('champion')
    expect(profile('Bo').titleId).toBe('legend')
  })
})
