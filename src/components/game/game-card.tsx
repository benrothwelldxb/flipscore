import { ChevronRight, Trash2 } from 'lucide-react'

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
import { computeLeaderboard, hasAnyScore } from '@/domain/scoring'
import type { Game, GameMode, GameStatus } from '@/domain/types'

import { PlayerAvatar } from './player-avatar'

const MODE_LABEL: Record<GameMode, string> = {
  host: 'Host Scorekeeper',
  pass: 'Pass the Phone',
  connected: 'Connected',
}

const STATUS_LABEL: Record<GameStatus, string> = {
  setup: 'Not started',
  playing: 'In progress',
  finished: 'Finished',
}

interface GameCardProps {
  game: Game
  onOpen: () => void
  onDelete: () => void
}

function standingText(game: Game): string | null {
  if (game.status === 'finished') {
    const winner = game.players.find((p) => p.id === game.winnerId)
    return winner ? `Winner: ${winner.name}` : null
  }
  if (game.status === 'playing' && hasAnyScore(game)) {
    const leaders = computeLeaderboard(game).filter((e) => e.isLeader)
    if (leaders.length === 1) return `Leading: ${leaders[0].player.name}`
    if (leaders.length > 1) return 'Tied at the top'
  }
  return null
}

export function GameCard({ game, onOpen, onDelete }: GameCardProps) {
  const standing = standingText(game)

  return (
    <li className="bg-card flex items-center gap-1 rounded-xl border p-3">
      <button
        type="button"
        onClick={onOpen}
        className="focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-semibold">
            {game.name || MODE_LABEL[game.settings.mode]}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {STATUS_LABEL[game.status]} · {game.players.length} players ·{' '}
            {MODE_LABEL[game.settings.mode]}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {game.players.slice(0, 5).map((player) => (
                <PlayerAvatar
                  key={player.id}
                  name={player.name}
                  color={player.color}
                  className="size-6 ring-2 ring-card text-[10px]"
                />
              ))}
            </div>
            {standing && (
              <span className="text-muted-foreground truncate text-xs">
                {standing}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="text-muted-foreground size-5 shrink-0" />
      </button>

      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground shrink-0"
            aria-label={`Delete ${game.name || MODE_LABEL[game.settings.mode]}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this game?</DialogTitle>
            <DialogDescription>
              This permanently removes the game and its scores from this device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="destructive" onClick={onDelete}>
                Delete
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}
