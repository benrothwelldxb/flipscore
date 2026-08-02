import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, LogOut, PartyPopper, Trophy, WifiOff } from 'lucide-react'

import { EmptyState, LoadingState } from '@/components/common/screen-state'
import { Leaderboard } from '@/components/game/leaderboard'
import { PlayerAvatar } from '@/components/game/player-avatar'
import { ScoreEntryPanel } from '@/components/game/score-entry-panel'
import { QrCode } from '@/components/net/qr-code'
import { Button } from '@/components/ui/button'
import { computeLeaderboard } from '@/domain/scoring'
import type { RejectReason } from '@/net/protocol'
import { useNetStore } from '@/stores/net-store'

const REJECT_COPY: Record<
  RejectReason,
  { title: string; description: string }
> = {
  full: {
    title: 'Game is full',
    description: 'This game already has the maximum number of players.',
  },
  'name-taken': {
    title: 'Name taken',
    description: 'Someone already joined with that name. Try another.',
  },
  started: {
    title: 'Game already started',
    description: 'The host has already started this game.',
  },
  'not-found': {
    title: 'Game not found',
    description: 'Double-check the code with the host.',
  },
  version: {
    title: 'Update needed',
    description: 'You and the host are on different app versions.',
  },
}

/** Everything a joined guest sees: lobby wait, live scoring, or the final board. */
export function ConnectedGuestScreen() {
  const navigate = useNavigate()
  const status = useNetStore((s) => s.guestStatus)
  const reason = useNetStore((s) => s.guestReason)
  const identity = useNetStore((s) => s.identity)
  const replica = useNetStore((s) => s.replica)
  const answerBlob = useNetStore((s) => s.answerBlob)
  const submitMyScore = useNetStore((s) => s.submitMyScore)
  const leaveGuest = useNetStore((s) => s.leaveGuest)

  function goHome() {
    leaveGuest()
    navigate('/', { replace: true })
  }

  if (status === 'rejected') {
    const copy = REJECT_COPY[reason ?? 'not-found']
    return (
      <EmptyState
        icon={<WifiOff className="size-10" />}
        title={copy.title}
        description={copy.description}
        action={<Button onClick={goHome}>Back to home</Button>}
      />
    )
  }

  if (status === 'kicked') {
    return (
      <EmptyState
        icon={<LogOut className="size-10" />}
        title="Removed from the game"
        description="The host removed you from this game."
        action={<Button onClick={goHome}>Back to home</Button>}
      />
    )
  }

  if (status === 'disconnected') {
    return (
      <EmptyState
        icon={<WifiOff className="size-10" />}
        title="Lost connection"
        description="We couldn’t reach the host. They may have closed the game or moved out of range."
        action={<Button onClick={goHome}>Back to home</Button>}
      />
    )
  }

  // Offline handshake: show our reply code for the host to scan back.
  if (status === 'connecting' && !replica && answerBlob) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div>
          <h1 className="text-xl font-bold">Almost there</h1>
          <p className="text-muted-foreground mt-1 text-sm text-balance">
            Show this reply code to the host so they can scan it.
          </p>
        </div>
        <QrCode value={answerBlob} label="Your reply code" />
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          Waiting for the host to connect…
        </p>
        <Button variant="ghost" size="sm" onClick={goHome}>
          Cancel
        </Button>
      </div>
    )
  }

  if (status === 'connecting' || (!replica && status !== 'ended')) {
    return <LoadingState label="Connecting to the game…" />
  }

  if (status === 'reconnecting') {
    return <LoadingState label="Reconnecting…" />
  }

  // Host ended the session: show the final board if we have one.
  if (status === 'ended' && (!replica || replica.status !== 'finished')) {
    return (
      <EmptyState
        icon={<WifiOff className="size-10" />}
        title="Host ended the game"
        description="The host closed the session."
        action={<Button onClick={goHome}>Back to home</Button>}
      />
    )
  }

  if (!replica) return <LoadingState label="Connecting to the game…" />

  const myId = identity?.playerId
  const myPlayer = replica.players.find((p) => p.id === myId)
  const gameTitle = replica.name?.trim() || 'Flip 7'

  const header = (
    <header className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold">{gameTitle}</h1>
        {myPlayer && (
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            You’re
            <PlayerAvatar
              name={myPlayer.name}
              color={myPlayer.color}
              avatar={myPlayer.avatar}
              size={22}
            />
            <span className="font-medium">{myPlayer.name}</span>
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Leave game"
        onClick={goHome}
      >
        <LogOut className="size-4" />
        Leave
      </Button>
    </header>
  )

  // ---- Lobby (waiting for the host to start) ------------------------------
  if (replica.status === 'setup') {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Check className="size-8 text-emerald-500" aria-hidden />
          <p className="font-medium">You’re in!</p>
          <p className="text-muted-foreground text-sm">
            Waiting for the host to start the game.
          </p>
        </div>
        <section className="space-y-2">
          <h2 className="text-muted-foreground text-sm font-semibold">
            Players ({replica.players.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {replica.players.map((player) => (
              <li
                key={player.id}
                className="bg-card flex items-center gap-3 rounded-xl border p-3"
              >
                <PlayerAvatar
                  name={player.name}
                  color={player.color}
                  avatar={player.avatar}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {player.name}
                  {player.id === myId && (
                    <span className="text-muted-foreground ml-1 text-xs font-normal">
                      (you)
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  // ---- Finished -----------------------------------------------------------
  if (replica.status === 'finished') {
    const board = computeLeaderboard(replica)
    const winner = replica.winnerId
      ? replica.players.find((p) => p.id === replica.winnerId)
      : null
    const iWon = winner?.id === myId
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          {iWon ? (
            <PartyPopper className="text-primary size-10" aria-hidden />
          ) : (
            <Trophy className="size-10 text-amber-500" aria-hidden />
          )}
          <h2 className="text-2xl font-bold">
            {winner ? `${winner.name} wins!` : 'Game over'}
          </h2>
          {iWon && <p className="text-primary font-medium">That’s you 🎉</p>}
        </div>
        <Leaderboard game={replica} />
        <Button variant="outline" className="w-full" onClick={goHome}>
          Back to home
        </Button>
        <span className="sr-only">{board.length} players ranked.</span>
      </div>
    )
  }

  // ---- Playing ------------------------------------------------------------
  return <GuestPlaying header={header} submitMyScore={submitMyScore} />
}

function GuestPlaying({
  header,
  submitMyScore,
}: {
  header: React.ReactNode
  submitMyScore: (
    value: number,
    flags?: { flip7?: boolean; bust?: boolean },
  ) => void
}) {
  const replica = useNetStore((s) => s.replica)
  const identity = useNetStore((s) => s.identity)
  // The round we've optimistically submitted for; comparing against the current
  // round means "sending" clears itself the moment the host opens a new round —
  // no effect needed.
  const [pendingRound, setPendingRound] = useState<number | null>(null)

  const myId = identity?.playerId
  const roundIndex = replica?.currentRoundIndex ?? 0
  const round = replica?.rounds[roundIndex]
  const myScore = myId && round ? round.scores[myId] : undefined
  const hasScored = myScore !== undefined

  if (!replica) return <LoadingState label="Connecting…" />

  const roundNumber = roundIndex + 1
  const waiting = hasScored || pendingRound === roundIndex

  return (
    <div className="flex flex-col gap-5">
      {header}

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-semibold">
          Standings
        </h2>
        <Leaderboard game={replica} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Round {roundNumber}</h2>
          {waiting && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="size-4" aria-hidden />
              {hasScored ? `Scored ${myScore}` : 'Sent'}
            </span>
          )}
        </div>

        {waiting ? (
          <div className="text-muted-foreground bg-muted/40 rounded-xl border p-4 text-center text-sm">
            Waiting for the other players and the host to move on.
          </div>
        ) : (
          <ScoreEntryPanel
            onSubmit={(value, flags) => {
              setPendingRound(roundIndex)
              submitMyScore(value, flags)
            }}
            submitLabel="Submit score"
            rules={replica.settings.rules}
          />
        )}
      </section>
    </div>
  )
}
