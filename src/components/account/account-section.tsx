import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CloudCheck, LogOut, Mail, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AccountApiError } from '@/net/account-api'
import { cn } from '@/lib/utils'
import { useAccountStore } from '@/stores/account-store'
import {
  useLastSyncedAt,
  useSyncStatus,
  useSyncStore,
} from '@/stores/sync-store'

/** Compact "Xm ago" style relative time. */
function relativeTime(ts: number): string {
  const seconds = Math.round((Date.now() - ts) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** Map an API error code to a friendly, human sentence. */
function messageFor(error: unknown): string {
  const code = error instanceof AccountApiError ? error.code : ''
  switch (code) {
    case 'invalid_email':
      return 'Enter a valid email address.'
    case 'invalid_code':
      return "That code isn't right — check it and try again."
    case 'code_expired':
      return 'That code has expired. Send a new one.'
    case 'too_many_attempts':
      return 'Too many attempts. Send a new code to try again.'
    case 'email_failed':
      return "Couldn't send the email just now. Try again in a moment."
    case 'network':
      return 'You appear to be offline. Check your connection.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

export function AccountSection() {
  const { user, token, pendingEmail, devCode } = useAccountStore()
  const requestCode = useAccountStore((s) => s.requestCode)
  const verifyCode = useAccountStore((s) => s.verifyCode)
  const cancelPending = useAccountStore((s) => s.cancelPending)
  const signOut = useAccountStore((s) => s.signOut)
  const refresh = useAccountStore((s) => s.refresh)

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)

  // Revalidate a stored session once, so a revoked/expired token is cleared.
  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When we enter (or leave) the code-entry step, seed the input from the dev
  // code. Adjusting state during render — the recommended alternative to a
  // setState-in-effect — keeps this in sync without an extra render pass.
  const [prevPending, setPrevPending] = useState<string | null>(pendingEmail)
  if (pendingEmail !== prevPending) {
    setPrevPending(pendingEmail)
    setCode(pendingEmail ? (devCode ?? '') : '')
  }

  // Focus the code field once it appears (a DOM side-effect, not state).
  useEffect(() => {
    if (pendingEmail) codeInputRef.current?.focus()
  }, [pendingEmail])

  async function onSendCode(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await requestCode(email.trim())
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  async function onVerify(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await verifyCode(code.trim())
      setEmail('')
      setCode('')
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  // Signed in.
  if (user && token) {
    return <SignedIn email={user.email} onSignOut={() => void signOut()} />
  }

  // Code-entry step.
  if (pendingEmail) {
    return (
      <div className="border-t pt-4">
        <Label
          htmlFor="account-code"
          className="mb-1 flex flex-col items-start"
        >
          Enter your code
          <span className="text-muted-foreground text-xs font-normal">
            We sent a 6-digit code to {pendingEmail}.
          </span>
        </Label>
        <form onSubmit={onVerify} className="flex flex-col gap-2">
          <Input
            id="account-code"
            ref={codeInputRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              setError(null)
            }}
            className="text-center text-xl tracking-[0.3em] tabular-nums"
          />
          {devCode && (
            <p className="text-muted-foreground text-center text-xs">
              Dev mode: your code is{' '}
              <span className="font-semibold tabular-nums">{devCode}</span>
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || code.length !== 6}>
            {busy ? 'Verifying…' : 'Verify & sign in'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              cancelPending()
              setCode('')
              setError(null)
            }}
          >
            Use a different email
          </Button>
        </form>
      </div>
    )
  }

  // Email-entry step (signed out).
  return (
    <div className="border-t pt-4">
      <Label
        htmlFor="account-email"
        className="mb-1 flex flex-col items-start gap-0.5"
      >
        <span className="flex items-center gap-1.5">
          <Mail className="size-4" aria-hidden />
          Account
        </span>
        <span className="text-muted-foreground text-xs font-normal">
          Sign in with your email to sync across devices — no password needed.
        </span>
      </Label>
      <form onSubmit={onSendCode} className="flex flex-col gap-2">
        <Input
          id="account-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setEmail(e.target.value)
            setError(null)
          }}
        />
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || email.trim().length === 0}>
          {busy ? 'Sending…' : 'Send sign-in code'}
        </Button>
      </form>
    </div>
  )
}

/** The signed-in view: identity, live sync status, and a manual sync. */
function SignedIn({
  email,
  onSignOut,
}: {
  email: string
  onSignOut: () => void
}) {
  const status = useSyncStatus()
  const lastSyncedAt = useLastSyncedAt()
  const syncNow = useSyncStore((s) => s.syncNow)

  const statusText =
    status === 'syncing'
      ? 'Syncing…'
      : status === 'error'
        ? 'Sync failed — tap Sync to retry'
        : lastSyncedAt
          ? `Synced ${relativeTime(lastSyncedAt)}`
          : 'Ready to sync'

  return (
    <div className="border-t pt-4">
      <Label className="mb-1 flex items-center gap-1.5">
        <CloudCheck className="size-4" aria-hidden />
        Account
      </Label>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{email}</p>
          <p
            className={cn(
              'text-xs',
              status === 'error' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {statusText}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void syncNow()}
            disabled={status === 'syncing'}
          >
            <RefreshCw
              className={cn('size-4', status === 'syncing' && 'animate-spin')}
            />
            Sync
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSignOut}
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
