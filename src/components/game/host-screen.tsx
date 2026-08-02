import { useState } from 'react'
import { ChevronRight, Flag, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { isRoundComplete } from '@/domain/scoring'
import type { Game } from '@/domain/types'
import { useGameStore } from '@/stores/game-store'

import { Leaderboard } from './leaderboard'
import { PlayerAvatar } from './player-avatar'
import { ScoreEntry } from './score-entry'

interface HostScreenProps {
  game: Game
}

export function HostScreen({ game }: HostScreenProps) {
  const [entryPlayerId, setEntryPlayerId] = useState<string | null>(null)
  const store = useGameStore.getState

  const round = game.rounds[game.currentRoundIndex]
  const roundNumber = game.currentRoundIndex + 1
  const complete = isRoundComplete(round, game.players)
  const entryPlayer = game.players.find((p) => p.id === entryPlayerId) ?? null

  function handleSubmit(value: number) {
    if (!entryPlayerId) return
    store().submitScore(game.id, entryPlayerId, value)
    setEntryPlayerId(null)
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Round {roundNumber}</h1>
          <p className="text-muted-foreground text-sm">
            First to {game.settings.targetScore} wins
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Flag className="size-4" />
              End
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>End the game now?</DialogTitle>
              <DialogDescription>
                We&apos;ll tally the current scores and crown the leader.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Keep playing</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="destructive"
                  onClick={() => store().endGame(game.id)}
                >
                  End game
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-semibold">
          This round
        </h2>
        <ul className="flex flex-col gap-2">
          {game.players.map((player) => {
            const entered = player.id in round.scores
            return (
              <li
                key={player.id}
                className="bg-card flex items-center gap-3 rounded-xl border p-3"
              >
                <PlayerAvatar name={player.name} color={player.color} />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {player.name}
                </span>
                {entered ? (
                  <Button
                    variant="ghost"
                    className="gap-1.5 tabular-nums"
                    onClick={() => setEntryPlayerId(player.id)}
                    aria-label={`Edit ${player.name}'s score, currently ${round.scores[player.id]}`}
                  >
                    {round.scores[player.id]}
                    <Pencil className="size-3.5 opacity-60" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => setEntryPlayerId(player.id)}
                    aria-label={`Enter score for ${player.name}`}
                  >
                    Enter
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-semibold">
          Standings
        </h2>
        <Leaderboard game={game} />
      </section>

      <div className="bg-background/80 fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-safe backdrop-blur">
        <div className="mx-auto flex max-w-md">
          <Button
            size="lg"
            className="h-14 w-full text-base"
            disabled={!complete}
            onClick={() => store().nextRound(game.id)}
          >
            {complete ? 'Next round' : 'Enter every score to continue'}
            {complete && <ChevronRight className="size-5" />}
          </Button>
        </div>
      </div>

      <Dialog
        open={entryPlayer !== null}
        onOpenChange={(open) => {
          if (!open) setEntryPlayerId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {entryPlayer?.name} · Round {roundNumber}
            </DialogTitle>
            <DialogDescription>
              Enter this round&apos;s score.
            </DialogDescription>
          </DialogHeader>
          {entryPlayer && (
            <ScoreEntry
              key={entryPlayer.id}
              onSubmit={handleSubmit}
              submitLabel="Save score"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
