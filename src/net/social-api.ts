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

/** A person on the other end of a pending friend request. */
export interface FriendRequestPeer {
  accountId: string
  displayName: string
}

export type AddFriendResult =
  | { status: 'pending'; to: FriendRequestPeer }
  | { status: 'accepted'; friend: FriendIdentity }
  | { status: 'friends'; friend: FriendIdentity }

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

/** Send a friend request by code (auto-accepts if they already asked you). */
export function addFriend(
  token: string,
  code: string,
): Promise<AddFriendResult> {
  return apiRequest('/api/social/friends/add', {
    method: 'POST',
    token,
    body: JSON.stringify({ code }),
  })
}

export function getRequests(
  token: string,
): Promise<{ incoming: FriendRequestPeer[]; outgoing: FriendRequestPeer[] }> {
  return apiRequest('/api/social/friends/requests', { token })
}

/** Accept or reject an incoming request from `fromAccountId`. */
export function respondRequest(
  token: string,
  fromAccountId: string,
  action: 'accept' | 'reject',
): Promise<{ friend?: FriendIdentity; ok?: true }> {
  return apiRequest('/api/social/friends/respond', {
    method: 'POST',
    token,
    body: JSON.stringify({ fromAccountId, action }),
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
