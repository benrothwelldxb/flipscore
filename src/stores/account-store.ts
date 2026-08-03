import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  AccountApiError,
  fetchMe,
  requestCode,
  signOut,
  verifyCode,
  type AccountUser,
} from '@/net/account-api'

// Cloud Accounts client state. Phase A is identity only: sign in with a
// passwordless email code and stay signed in across sessions. The persisted
// token is the seam that Phase B (library sync) will authenticate against.

interface AccountState {
  /** The signed-in identity, or null when signed out. */
  user: AccountUser | null
  /** Bearer token for the API, or null when signed out. */
  token: string | null
  /** Email awaiting code entry (the "code sent" step), or null. */
  pendingEmail: string | null
  /** Dev-only: the code echoed back by the console email adapter. */
  devCode: string | null

  /** Send a sign-in code to an email and move to the code-entry step. */
  requestCode: (email: string) => Promise<void>
  /** Verify the code for the pending email; on success, sign in. */
  verifyCode: (code: string) => Promise<void>
  /** Abandon the code-entry step and go back to the email step. */
  cancelPending: () => void
  /** Sign out locally (and revoke the session server-side, best effort). */
  signOut: () => Promise<void>
  /** Revalidate the stored token; clears it if the session is gone. */
  refresh: () => Promise<void>
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      pendingEmail: null,
      devCode: null,

      async requestCode(email) {
        const result = await requestCode(email)
        set({ pendingEmail: email, devCode: result.devCode ?? null })
      },

      async verifyCode(code) {
        const email = get().pendingEmail
        if (!email) throw new AccountApiError('no_pending_email')
        const { token, user } = await verifyCode(email, code)
        set({ user, token, pendingEmail: null, devCode: null })
      },

      cancelPending() {
        set({ pendingEmail: null, devCode: null })
      },

      async signOut() {
        const { token } = get()
        // Turn off push while we still hold the token, so this device stops
        // receiving the previous account's notifications (matters on a shared
        // device). Dynamic import avoids a static store import cycle; no-ops
        // where push is unsupported. Best effort — never blocks sign-out.
        try {
          const { usePushStore } = await import('@/stores/push-store')
          await usePushStore.getState().disable()
        } catch {
          // ignore — sign-out proceeds regardless
        }
        set({ user: null, token: null, pendingEmail: null, devCode: null })
        if (token) {
          // Best effort — local state is already cleared regardless.
          await signOut(token).catch(() => {})
        }
      },

      async refresh() {
        const { token } = get()
        if (!token) return
        try {
          const user = await fetchMe(token)
          set({ user })
        } catch (error) {
          // Only a real "session gone" clears the token; network blips don't.
          if (
            error instanceof AccountApiError &&
            error.code === 'unauthorized'
          ) {
            set({ user: null, token: null })
          }
        }
      },
    }),
    {
      name: 'flipscore-account',
      version: 1,
      // Persist identity only; transient sign-in steps never touch storage.
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
)

export const useAccountUser = () => useAccountStore((s) => s.user)
export const useIsSignedIn = () => useAccountStore((s) => s.token !== null)
