import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Clock, Copy, Trophy, UserPlus, Users, X } from 'lucide-react'

import { EmptyState, LoadingState } from '@/components/common/screen-state'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  headToHeadForFriend,
  parseIdentityStats,
  playerNameOptions,
  rankLeaderboard,
  type FriendH2H,
  type LeaderboardEntry,
} from '@/domain/social'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { AccountApiError } from '@/net/account-api'
import { useIsSignedIn } from '@/stores/account-store'
import { useAllGames } from '@/stores/game-store'
import { useMyName } from '@/stores/identity-store'
import {
  useFriends,
  useIncomingRequests,
  useOutgoingRequests,
  useSocialIdentity,
  useSocialStatus,
  useSocialStore,
} from '@/stores/social-store'

function addFriendError(error: unknown): string {
  const code = error instanceof AccountApiError ? error.code : ''
  switch (code) {
    case 'invalid_code':
      return 'That code looks incomplete.'
    case 'unknown_code':
      return 'No one has that code. Double-check it.'
    case 'self_code':
      return "That's your own code!"
    case 'network':
      return 'You appear to be offline.'
    default:
      return 'Could not add that friend. Try again.'
  }
}

export function FriendsPage() {
  const signedIn = useIsSignedIn()

  useEffect(() => {
    if (signedIn) void useSocialStore.getState().fetchAll()
  }, [signedIn])

  if (!signedIn) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Friends" />
        <EmptyState
          icon={<Users className="size-10" />}
          title="Sign in to play with friends"
          description="Open Settings to sign in with your email, then add friends by code and compare stats on a shared leaderboard."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Friends" />
      <FriendsContent />
    </div>
  )
}

function FriendsContent() {
  const identity = useSocialIdentity()
  const friends = useFriends()
  const status = useSocialStatus()
  const myName = useMyName()
  const games = useAllGames()

  // Head-to-head per friend (using their real name, empty → none), computed
  // once per data change rather than inside every leaderboard row's render.
  const h2h = useMemo(() => {
    const map = new Map<string, FriendH2H | null>()
    for (const f of friends) {
      map.set(f.accountId, headToHeadForFriend(myName, f.displayName, games))
    }
    return map
  }, [friends, myName, games])

  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    const entries: LeaderboardEntry[] = []
    if (identity?.displayName) {
      entries.push({
        accountId: identity.accountId,
        displayName: identity.displayName,
        isSelf: true,
        stats: parseIdentityStats(identity.stats),
      })
    }
    for (const f of friends) {
      entries.push({
        accountId: f.accountId,
        displayName: f.displayName || 'Player',
        isSelf: false,
        stats: parseIdentityStats(f.stats),
      })
    }
    return rankLeaderboard(entries)
  }, [identity, friends])

  if (status === 'loading' && !identity)
    return <LoadingState label="Loading…" />

  return (
    <>
      <IdentityCard />
      <Requests />
      <AddFriend />
      <Leaderboard entries={leaderboard} h2h={h2h} />
    </>
  )
}

function Requests() {
  const incoming = useIncomingRequests()
  const outgoing = useOutgoingRequests()
  const accept = useSocialStore((s) => s.acceptRequest)
  const reject = useSocialStore((s) => s.rejectRequest)
  const { toast } = useToast()

  async function onAccept(id: string) {
    try {
      await accept(id)
      toast('Friend added')
    } catch {
      toast('Could not accept — try again')
    }
  }

  async function onReject(id: string) {
    try {
      await reject(id)
    } catch {
      toast('Could not reject — try again')
    }
  }

  if (incoming.length === 0 && outgoing.length === 0) return null

  return (
    <section className="space-y-2">
      {incoming.length > 0 && (
        <>
          <h2 className="text-sm font-semibold">Friend requests</h2>
          <ul className="flex flex-col gap-1.5">
            {incoming.map((r) => (
              <li
                key={r.accountId}
                className="bg-card flex items-center gap-2 rounded-xl border p-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {r.displayName || 'Player'}
                </span>
                <Button size="sm" onClick={() => void onAccept(r.accountId)}>
                  <Check className="size-4" />
                  Accept
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Reject ${r.displayName || 'request'}`}
                  onClick={() => void onReject(r.accountId)}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      {outgoing.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {outgoing.map((r) => (
            <li
              key={r.accountId}
              className="text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed p-3 text-sm"
            >
              <Clock className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                Request sent to {r.displayName || 'a player'}
              </span>
              <span className="text-xs">Pending</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function IdentityCard() {
  const identity = useSocialIdentity()
  const claimName = useSocialStore((s) => s.claimName)
  const games = useAllGames()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const options = useMemo(() => playerNameOptions(games), [games])
  const claimed = identity?.displayName ?? ''

  async function copyCode() {
    if (!identity) return
    try {
      await navigator.clipboard.writeText(identity.friendCode)
      toast('Friend code copied')
    } catch {
      toast('Could not copy')
    }
  }

  async function claim(name: string) {
    if (name === claimed) return
    setBusy(true)
    try {
      await claimName(name)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-card space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">Your friend code</p>
          <p className="font-mono text-2xl font-bold tracking-[0.2em]">
            {identity?.friendCode ?? '········'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void copyCode()}>
          <Copy className="size-4" />
          Copy
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Share this code so friends can add you.
      </p>

      <div className="border-t pt-3">
        <p className="mb-2 text-sm font-medium">
          You appear on the board as{' '}
          <span className="text-primary">{claimed || 'nobody yet'}</span>
        </p>
        {options.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Play a game to pick which player is you.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {options.map((name) => {
              const active = name === claimed
              return (
                <button
                  key={name}
                  type="button"
                  disabled={busy}
                  onClick={() => void claim(name)}
                  aria-pressed={active}
                  className={cn(
                    'focus-visible:ring-ring/50 rounded-full border px-3 py-1 text-sm outline-none transition focus-visible:ring-2 disabled:opacity-50',
                    active
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {active && <Check className="mr-1 inline size-3.5" />}
                  {name}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function AddFriend() {
  const addFriend = useSocialStore((s) => s.addFriend)
  const { toast } = useToast()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const status = await addFriend(code)
      setCode('')
      toast(status === 'pending' ? 'Request sent' : 'Friend added')
    } catch (err) {
      setError(addFriendError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-card space-y-2 rounded-xl border p-4"
    >
      <label htmlFor="friend-code" className="text-sm font-medium">
        Add a friend
      </label>
      <p className="text-muted-foreground -mt-1 text-xs">
        Enter their code to send a request — they’ll need to accept.
      </p>
      <div className="flex gap-2">
        <Input
          id="friend-code"
          value={code}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="Enter their code"
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setError(null)
          }}
          className="font-mono tracking-widest uppercase"
        />
        <Button type="submit" disabled={busy || code.trim().length === 0}>
          <UserPlus className="size-4" />
          Send
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </form>
  )
}

function Leaderboard({
  entries,
  h2h,
}: {
  entries: LeaderboardEntry[]
  h2h: Map<string, FriendH2H | null>
}) {
  const removeFriend = useSocialStore((s) => s.removeFriend)

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Trophy className="size-10" />}
        title="No one on the board yet"
        description="Claim your player name above, then add a friend by code to start a leaderboard."
      />
    )
  }

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <Trophy className="size-4" />
        Leaderboard
      </h2>
      <ul className="flex flex-col gap-1.5">
        {entries.map((entry, index) => (
          <li
            key={entry.accountId}
            className={cn(
              'flex items-center gap-3 rounded-xl border p-3',
              entry.isSelf ? 'border-primary/40 bg-primary/5' : 'bg-card',
            )}
          >
            <span className="text-muted-foreground w-5 text-center text-sm font-bold tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                {entry.displayName}
                {entry.isSelf && (
                  <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[11px] font-semibold">
                    You
                  </span>
                )}
              </p>
              <p className="text-muted-foreground text-xs tabular-nums">
                {entry.stats.gamesWon}W · {entry.stats.gamesPlayed} played ·{' '}
                {Math.round(entry.stats.winPct * 100)}% · Lv {entry.stats.level}
              </p>
              {!entry.isSelf &&
                (() => {
                  const rec = h2h.get(entry.accountId)
                  return rec ? (
                    <p className="text-muted-foreground text-xs">
                      vs you {rec.mine}–{rec.theirs}{' '}
                      <span className="opacity-70">(your games)</span>
                    </p>
                  ) : null
                })()}
            </div>
            {!entry.isSelf && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${entry.displayName}`}
                onClick={() => void removeFriend(entry.accountId)}
              >
                <X className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
