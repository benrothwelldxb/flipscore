// Thin client for the Cloud Accounts API served by the Worker at /api/*.
// Same-origin relative URLs, exactly like the Connected-mode relay — so this
// works in production and under `wrangler dev` with no configuration.

import type { SyncItem } from '@/domain/sync'

export interface AccountUser {
  id: string
  email: string
}

export interface RequestCodeResult {
  mode: 'console' | 'resend'
  /** Present only in dev (console email): the code, echoed for convenience. */
  devCode?: string
}

export interface VerifyResult {
  token: string
  user: AccountUser
}

const BASE = '/api/auth'

/** An API error carrying the machine-readable code the Worker returned. */
export class AccountApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.name = 'AccountApiError'
    this.code = code
  }
}

/** Core fetch wrapper: JSON in/out, Bearer auth, and typed error codes.
 *  Exported as `apiRequest` for sibling clients (e.g. the social API). */
export async function apiRequest<T>(
  url: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = init
  let res: Response
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        ...(rest.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    })
  } catch {
    throw new AccountApiError('network')
  }

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // Non-JSON body — fall through to a status-based error below.
  }

  if (!res.ok) {
    const code =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `http_${res.status}`
    throw new AccountApiError(code)
  }
  return data as T
}

/** Call an /api/auth/* endpoint. */
function call<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  return apiRequest<T>(`${BASE}${path}`, init)
}

export function requestCode(email: string): Promise<RequestCodeResult> {
  return call<RequestCodeResult>('/request-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function verifyCode(email: string, code: string): Promise<VerifyResult> {
  return call<VerifyResult>('/verify-code', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
}

export async function fetchMe(token: string): Promise<AccountUser> {
  const { user } = await call<{ user: AccountUser }>('/me', { token })
  return user
}

export async function signOut(token: string): Promise<void> {
  await call<{ ok: true }>('/sign-out', { method: 'POST', token })
}

export interface SyncResponse {
  cursor: number
  changes: SyncItem[]
}

/** Push local changes and pull everything since `cursor` in one round-trip. */
export function syncLibrary(
  token: string,
  cursor: number,
  changes: SyncItem[],
): Promise<SyncResponse> {
  return apiRequest<SyncResponse>('/api/sync', {
    method: 'POST',
    token,
    body: JSON.stringify({ since: cursor, changes }),
  })
}
