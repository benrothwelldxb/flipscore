import { describe, expect, it } from 'vitest'

import { createGame } from '@/domain/game'

import {
  decodeGuestMessage,
  decodeHostMessage,
  encode,
  isCompatibleVersion,
  msg,
  PROTOCOL_VERSION,
} from './protocol'

describe('protocol encode / decode', () => {
  it('round-trips a guest join', () => {
    const decoded = decodeGuestMessage(encode(msg.join('Ann', 'tok', 'blue')))
    expect(decoded).toEqual({
      t: 'join',
      v: PROTOCOL_VERSION,
      name: 'Ann',
      token: 'tok',
      color: 'blue',
    })
  })

  it('round-trips a guest score with flags', () => {
    const decoded = decodeGuestMessage(
      encode(msg.score(2, 43, { flip7: true })),
    )
    expect(decoded).toMatchObject({ t: 'score', round: 2, value: 43 })
  })

  it('round-trips a host accepted with a full snapshot', () => {
    const game = createGame('connected', 1)
    const decoded = decodeHostMessage(encode(msg.accepted('p1', 'tok', game)))
    expect(decoded?.t).toBe('accepted')
    if (decoded?.t === 'accepted') {
      expect(decoded.playerId).toBe('p1')
      expect(decoded.snapshot.id).toBe(game.id)
    }
  })

  it('rejects malformed JSON', () => {
    expect(decodeGuestMessage('{not json')).toBeNull()
  })

  it('rejects a well-formed message of the wrong shape', () => {
    expect(decodeGuestMessage(JSON.stringify({ t: 'score', v: 1 }))).toBeNull()
  })

  it('does not accept a host message on the guest decoder', () => {
    expect(decodeGuestMessage(encode(msg.pong(1)))).toBeNull()
  })

  it('treats the same major version as compatible', () => {
    expect(isCompatibleVersion(PROTOCOL_VERSION)).toBe(true)
    expect(isCompatibleVersion(PROTOCOL_VERSION + 1)).toBe(false)
  })
})
