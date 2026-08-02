import { beforeEach, describe, expect, it } from 'vitest'

import { advanceRound, createGame, recordScore, startGame } from '@/domain/game'
import { computeTotals } from '@/domain/scoring'
import { createId } from '@/lib/id'
import type { Game, Player, RoundFlags } from '@/domain/types'

import { GuestController, type GuestStatus } from './guest-controller'
import { HostController, type HostBridge } from './host-controller'
import { createMockPair, flush } from './mock-link'

/** A minimal in-memory authoritative host game backed by the pure transforms. */
function makeHost() {
  let game: Game = { ...createGame('connected', 1), players: [], rounds: [] }
  const bridge: HostBridge = {
    get: () => game,
    addPlayer: (name, color) => {
      const p: Player = {
        id: createId(),
        name,
        color,
        order: game.players.length,
      }
      game = { ...game, players: [...game.players, p] }
      return p.id
    },
    removePlayer: (playerId) => {
      game = {
        ...game,
        players: game.players
          .filter((p) => p.id !== playerId)
          .map((p, i) => ({ ...p, order: i })),
      }
    },
    recordScore: (playerId, value, flags) => {
      game = recordScore(game, playerId, value, flags)
    },
  }
  const controller = new HostController(bridge)
  return {
    controller,
    get: () => game,
    start() {
      game = startGame(game)
      controller.broadcast()
    },
    advance() {
      game = advanceRound(game)
      controller.broadcast()
    },
  }
}

/** Connect a guest to the host and return a handle to observe / drive it. */
function connectGuest(
  host: ReturnType<typeof makeHost>,
  profile: { name: string; color?: string; token?: string },
) {
  const pair = createMockPair(createId())
  host.controller.addPeer(pair.hostSide)
  let snapshot: Game | null = null
  let status: GuestStatus | null = null
  let token: string | undefined = profile.token
  const guest = new GuestController(
    pair.guestSide,
    profile,
    { setSnapshot: (g) => (snapshot = g) },
    {
      onStatus: (s) => (status = s),
      onIdentity: (id) => (token = id.token),
    },
  )
  pair.connect()
  return {
    guest,
    pair,
    snapshot: () => snapshot,
    status: () => status,
    token: () => token,
    playerId: () => guest.getIdentity()?.playerId,
  }
}

describe('connected session (host ↔ guests over a mock link)', () => {
  let host: ReturnType<typeof makeHost>

  beforeEach(() => {
    host = makeHost()
  })

  it('admits a guest, assigns a seat, and shares the snapshot', async () => {
    const ann = connectGuest(host, { name: 'Ann' })
    await flush()
    await flush()

    expect(ann.status()).toBe('joined')
    expect(ann.playerId()).toBeTruthy()
    expect(ann.snapshot()?.players.map((p) => p.name)).toEqual(['Ann'])
    expect(host.get().players).toHaveLength(1)
  })

  it('broadcasts a growing roster to earlier guests', async () => {
    const ann = connectGuest(host, { name: 'Ann' })
    await flush()
    await flush()
    const bo = connectGuest(host, { name: 'Bo' })
    await flush()
    await flush()

    expect(ann.snapshot()?.players.map((p) => p.name)).toEqual(['Ann', 'Bo'])
    expect(bo.snapshot()?.players.map((p) => p.name)).toEqual(['Ann', 'Bo'])
  })

  it('rejects a duplicate name', async () => {
    connectGuest(host, { name: 'Ann' })
    await flush()
    await flush()
    const dupe = connectGuest(host, { name: 'Ann' })
    await flush()
    await flush()

    expect(dupe.status()).toBe('rejected')
    expect(host.get().players).toHaveLength(1)
    // The rejected peer's link is torn down, not left receiving broadcasts.
    expect(dupe.pair.hostSide.state).toBe('closed')
  })

  it('never broadcasts game state to a peer that has not joined', async () => {
    // A raw link that connects but never sends a join (a lurker).
    const lurker = createMockPair(createId())
    const received: string[] = []
    lurker.guestSide.onMessage((d) => received.push(d))
    host.controller.addPeer(lurker.hostSide)
    lurker.connect()
    await flush()

    // A real guest joins and the host starts + scores, generating broadcasts.
    const ann = connectGuest(host, { name: 'Ann' })
    connectGuest(host, { name: 'Bo' })
    await flush()
    await flush()
    host.start()
    await flush()
    ann.guest.submitScore(0, 10)
    await flush()
    await flush()

    // The lurker never held a seat, so it saw no game state at all.
    expect(received).toEqual([])
  })

  it('records a guest score and fans the update out to everyone', async () => {
    const ann = connectGuest(host, { name: 'Ann' })
    const bo = connectGuest(host, { name: 'Bo' })
    await flush()
    await flush()
    host.start()
    await flush()

    const annId = ann.playerId()!
    ann.guest.submitScore(0, 15)
    await flush()
    await flush()

    expect(computeTotals(host.get())[annId]).toBe(15)
    expect(bo.snapshot()?.rounds[0].scores[annId]).toBe(15)
  })

  it('carries Flip 7 / bust flags through to the host', async () => {
    const ann = connectGuest(host, { name: 'Ann' })
    connectGuest(host, { name: 'Bo' })
    await flush()
    await flush()
    host.start()
    await flush()

    const flags: RoundFlags = { flip7: true }
    ann.guest.submitScore(0, 43, flags)
    await flush()
    await flush()

    const annId = ann.playerId()!
    expect(host.get().rounds[0].flags?.[annId]).toEqual({ flip7: true })
  })

  it('ignores a stale-round score and re-syncs that guest', async () => {
    const ann = connectGuest(host, { name: 'Ann' })
    connectGuest(host, { name: 'Bo' })
    await flush()
    await flush()
    host.start()
    host.advance() // now on round index 1
    await flush()

    ann.guest.submitScore(0, 99) // stale round 0
    await flush()
    await flush()

    const annId = ann.playerId()!
    expect(computeTotals(host.get())[annId]).toBe(0)
    // The guest was corrected back to the real current round.
    expect(ann.snapshot()?.currentRoundIndex).toBe(1)
  })

  it('lets a dropped guest reconnect with its token and keep its seat', async () => {
    const ann = connectGuest(host, { name: 'Ann' })
    connectGuest(host, { name: 'Bo' })
    await flush()
    await flush()
    host.start()
    await flush()
    const annId = ann.playerId()!
    const token = ann.token()
    ann.guest.submitScore(0, 20)
    await flush()
    await flush()

    // Simulate a drop.
    ann.pair.hostSide.close()
    await flush()
    expect(
      host.controller.getSeats().find((s) => s.playerId === annId)?.peerId,
    ).toBeNull()

    // Reconnect with the saved token.
    const back = connectGuest(host, { name: 'Ann', token })
    await flush()
    await flush()

    expect(back.status()).toBe('joined')
    expect(back.playerId()).toBe(annId)
    expect(back.snapshot()?.rounds[0].scores[annId]).toBe(20)
    expect(host.get().players.filter((p) => p.id === annId)).toHaveLength(1)
  })

  it('frees a lobby seat when a guest leaves before the game starts', async () => {
    const ann = connectGuest(host, { name: 'Ann' })
    const bo = connectGuest(host, { name: 'Bo' })
    await flush()
    await flush()
    expect(host.get().players).toHaveLength(2)

    ann.guest.leave()
    await flush()
    await flush()

    expect(host.get().players.map((p) => p.name)).toEqual(['Bo'])
    expect(bo.snapshot()?.players.map((p) => p.name)).toEqual(['Bo'])
  })

  it('tells guests when the host closes the session', async () => {
    const ann = connectGuest(host, { name: 'Ann' })
    await flush()
    await flush()

    host.controller.close()
    await flush()
    await flush()

    expect(ann.status()).toBe('ended')
  })

  it('kicks a guest from the lobby', async () => {
    const ann = connectGuest(host, { name: 'Ann' })
    await flush()
    await flush()
    const annId = ann.playerId()!

    host.controller.kick(annId)
    await flush()
    await flush()

    expect(ann.status()).toBe('kicked')
    expect(host.controller.getSeats()).toHaveLength(0)
  })

  it('rejects a fresh join once the game is under way', async () => {
    connectGuest(host, { name: 'Ann' })
    connectGuest(host, { name: 'Bo' })
    await flush()
    await flush()
    host.start()
    await flush()

    const late = connectGuest(host, { name: 'Cy' })
    await flush()
    await flush()

    expect(late.status()).toBe('rejected')
  })
})
