import { create } from 'zustand'

import { normalizeName } from '@/domain/analysis'
import { computeIdentityStats } from '@/domain/social'
import { STICKERS } from '@/domain/stickers/catalog'
import { computeAchievementMetrics } from '@/domain/stickers/metrics'
import { AccountApiError } from '@/net/account-api'
import * as api from '@/net/social-api'
import type { FriendIdentity, MyIdentity } from '@/net/social-api'
import { useAccountStore } from '@/stores/account-store'
import { useGameStore } from '@/stores/game-store'
import { useIdentityStore } from '@/stores/identity-store'
import { useNightsStore } from '@/stores/nights-store'
import { useProfileStore } from '@/stores/profile-store'
import { useStickersStore } from '@/stores/stickers-store'

// Friends & leaderboards client state. The identity and friends live on the
// server; this store fetches them, publishes the account's stats snapshot for
// its claimed player name, and manages the friend graph. Not persisted — it's
// refetched whenever the Friends screen opens.

type SocialStatus = 'idle' | 'loading' | 'error'

interface SocialState {
  identity: MyIdentity | null
  friends: FriendIdentity[]
  status: SocialStatus
  error: string | null

  /** Load identity + friends, then publish fresh stats (best effort). */
  fetchAll: () => Promise<void>
  /**
   * Set who "you" are — the single place identity is chosen. Updates the local
   * identity (which drives the Sticker Book), rebuilds achievements for that
   * player, and — when signed in — publishes it to the friends leaderboard.
   * Works offline; the leaderboard part is skipped without an account.
   */
  claimName: (name: string) => Promise<void>
  /** Recompute and publish the claimed identity's stats snapshot. */
  publishStats: () => Promise<void>
  /** Add a friend by their code (throws AccountApiError on a bad code). */
  addFriend: (code: string) => Promise<void>
  /** Remove a friend (both directions). */
  removeFriend: (friendId: string) => Promise<void>
}

export const useSocialStore = create<SocialState>()((set, get) => ({
  identity: null,
  friends: [],
  status: 'idle',
  error: null,

  async fetchAll() {
    const token = useAccountStore.getState().token
    if (!token) {
      set({ identity: null, friends: [], status: 'idle', error: null })
      return
    }
    set({ status: 'loading', error: null })
    try {
      const [{ identity }, { friends }] = await Promise.all([
        api.getIdentity(token),
        api.getFriends(token),
      ])
      set({ identity, friends, status: 'idle' })
      // Keep the leaderboard name in step with the local "you" identity: an
      // explicit local choice wins over the server's default display name.
      const local = useIdentityStore.getState().name
      if (local && local !== identity.displayName) {
        const { identity: synced } = await api.saveIdentity(token, {
          displayName: local,
        })
        set({ identity: synced })
      }
      await get().publishStats()
    } catch (e) {
      set({
        status: 'error',
        error: e instanceof AccountApiError ? e.code : 'error',
      })
    }
  },

  async claimName(name) {
    const trimmed = name.trim()
    // Local identity is the source of truth — it drives the Sticker Book and
    // works offline. Set it and rebuild achievements for that player.
    useIdentityStore.getState().setName(trimmed)
    useStickersStore
      .getState()
      .rebuild(
        computeAchievementMetrics(useGameStore.getState().games, trimmed),
      )

    // If signed in, also publish the name + stats to the leaderboard.
    const token = useAccountStore.getState().token
    if (!token) return
    const { identity } = await api.saveIdentity(token, { displayName: trimmed })
    set({ identity })
    await get().publishStats()
  },

  async publishStats() {
    const token = useAccountStore.getState().token
    const identity = get().identity
    if (!token || !identity || !identity.displayName) return
    const stats = computeIdentityStats({
      games: useGameStore.getState().games,
      nights: useNightsStore.getState().nights,
      name: identity.displayName,
      unlockedStickerIds: Object.keys(useStickersStore.getState().unlocked),
      totalStickers: STICKERS.length,
      profile:
        useProfileStore.getState().profiles[
          normalizeName(identity.displayName)
        ] ?? {},
      now: Date.now(),
    })
    const { identity: updated } = await api.saveIdentity(token, { stats })
    set({ identity: updated })
  },

  async addFriend(code) {
    const token = useAccountStore.getState().token
    if (!token) throw new AccountApiError('unauthorized')
    const { friend } = await api.addFriend(token, code)
    set((s) => ({
      friends: [
        ...s.friends.filter((f) => f.accountId !== friend.accountId),
        friend,
      ],
    }))
  },

  async removeFriend(friendId) {
    const token = useAccountStore.getState().token
    if (!token) return
    await api.removeFriend(token, friendId)
    set((s) => ({
      friends: s.friends.filter((f) => f.accountId !== friendId),
    }))
  },
}))

export const useSocialIdentity = () => useSocialStore((s) => s.identity)
export const useFriends = () => useSocialStore((s) => s.friends)
export const useSocialStatus = () => useSocialStore((s) => s.status)
