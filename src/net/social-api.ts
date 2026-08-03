// Client for the friends & leaderboards API (/api/social/*). Shares the account
// API's fetch wrapper (Bearer auth + typed AccountApiError codes).

import { apiRequest } from '@/net/account-api'

export interface MyIdentity {
  accountId: string
  friendCode: string
  displayName: string
  stats: unknown
}

export interface FriendIdentity {
  accountId: string
  displayName: string
  stats: unknown
}

export function getIdentity(token: string): Promise<{ identity: MyIdentity }> {
  return apiRequest('/api/social/identity', { token })
}

export function saveIdentity(
  token: string,
  patch: { displayName?: string; stats?: unknown },
): Promise<{ identity: MyIdentity }> {
  return apiRequest('/api/social/identity', {
    method: 'POST',
    token,
    body: JSON.stringify(patch),
  })
}

export function getFriends(
  token: string,
): Promise<{ friends: FriendIdentity[] }> {
  return apiRequest('/api/social/friends', { token })
}

export function addFriend(
  token: string,
  code: string,
): Promise<{ friend: FriendIdentity }> {
  return apiRequest('/api/social/friends/add', {
    method: 'POST',
    token,
    body: JSON.stringify({ code }),
  })
}

export function removeFriend(
  token: string,
  friendId: string,
): Promise<{ ok: true }> {
  return apiRequest('/api/social/friends/remove', {
    method: 'POST',
    token,
    body: JSON.stringify({ friendId }),
  })
}
