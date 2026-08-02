import { useState, type FormEvent, type ReactNode } from 'react'
import {
  Ban,
  Layers,
  Pencil,
  RotateCcw,
  Shield,
  Snowflake,
  Sparkles,
  Trash2,
  Undo2,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { RoundFlags } from '@/domain/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Game } from '@/domain/types'
import { validateScoreInput } from '@/domain/validation'
import { useToast } from '@/hooks/use-toast'
import { vibrate } from '@/lib/haptics'
import { playSound } from '@/lib/sound'
import { useCanUndo, useGameStore } from '@/stores/game-store'

import { PlayerAvatar } from './player-avatar'

const FLAG_BADGES: {
  key: keyof RoundFlags
  label: string
  icon: LucideIcon
  className: string
}[] = [
  { key: 'flip7', label: 'Flip 7', icon: Sparkles, className: 'text-primary' },
  { key: 'bust', label: 'Bust', icon: Ban, className: 'text-destructive' },
  {
    key: 'secondChance',
    label: 'Second Chance',
    icon: Shield,
    className: 'text-emerald-500',
  },
  {
    key: 'freeze',
    label: 'Freeze',
    icon: Snowflake,
    className: 'text-sky-500',
  },
  {
    key: 'flipThree',
    label: 'Flip Three',
    icon: Layers,
    className: 'text-amber-500',
  },
]

/** Small icons summarising how a round was scored (Flip 7 / bust / action cards). */
function FlagBadges({ flags }: { flags: RoundFlags }) {
  const active = FLAG_BADGES.filter((b) => flags[b.key])
  if (active.length === 0) return null
  return (
    <span className="flex items-center gap-1">
      {active.map(({ key, label, icon: Icon, className }) => (
        <Icon
          key={key}
          className={`size-3.5 ${className}`}
          aria-label={label}
        />
      ))}
    </span>
  )
}

interface EditTarget {
  roundIndex: number
  playerId: string
  name: string
  current?: number
}

interface RoundHistoryProps {
  game: Game
  trigger: ReactNode
}

export function RoundHistory({ game, trigger }: RoundHistoryProps) {
  const { toast } = useToast()
  const canUndo = useCanUndo(game.id)
  const store = useGameStore.getState

  const [edit, setEdit] = useState<EditTarget | null>(null)
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)

  function openEdit(target: EditTarget) {
    setEdit(target)
    setRaw(target.current != null ? String(target.current) : '')
    setError(null)
  }

  function saveEdit(event: FormEvent) {
    event.preventDefault()
    if (!edit) return
    const result = validateScoreInput(raw)
    if (!result.valid) {
      setError(result.error)
      return
    }
    store().editScore(game.id, edit.roundIndex, edit.playerId, result.value)
    vibrate(8)
    playSound('save')
    setEdit(null)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[88svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rounds</DialogTitle>
          <DialogDescription>
            Tap a score to edit, or replay and delete rounds.
          </DialogDescription>
        </DialogHeader>

        {canUndo && (
          <Button
            variant="outline"
            onClick={() => {
              store().undo(game.id)
              vibrate(10)
              playSound('undo')
              toast('Undone')
            }}
          >
            <Undo2 className="size-4" />
            Undo last change
          </Button>
        )}

        <ul className="flex flex-col gap-3">
          {game.rounds.map((round) => (
            <li key={round.id} className="bg-card rounded-xl border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">
                  Round {round.index + 1}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      store().replayRound(game.id, round.index)
                      vibrate(10)
                      toast(`Replaying round ${round.index + 1}`)
                    }}
                  >
                    <RotateCcw className="size-4" />
                    Replay
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    disabled={game.rounds.length <= 1}
                    aria-label={`Delete round ${round.index + 1}`}
                    title={
                      game.rounds.length <= 1
                        ? 'A game needs at least one round'
                        : undefined
                    }
                    onClick={() => {
                      const before = game
                      store().deleteRound(game.id, round.index)
                      vibrate([10, 20])
                      toast(`Round ${round.index + 1} deleted`, {
                        action: {
                          label: 'Undo',
                          onClick: () => store().replaceGame(before),
                        },
                      })
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <ul className="flex flex-col gap-1.5">
                {game.players.map((player) => {
                  const has = player.id in round.scores
                  return (
                    <li key={player.id} className="flex items-center gap-2">
                      <PlayerAvatar
                        name={player.name}
                        color={player.color}
                        avatar={player.avatar}
                        size={28}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {player.name}
                      </span>
                      {round.flags?.[player.id] && (
                        <FlagBadges flags={round.flags[player.id]} />
                      )}
                      <Button
                        variant="outline"
                        className="h-11 min-w-16 gap-1 tabular-nums"
                        aria-label={`Edit ${player.name}, round ${round.index + 1} score`}
                        onClick={() =>
                          openEdit({
                            roundIndex: round.index,
                            playerId: player.id,
                            name: player.name,
                            current: has ? round.scores[player.id] : undefined,
                          })
                        }
                      >
                        {has ? round.scores[player.id] : '—'}
                        <Pencil className="size-3 opacity-60" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      </DialogContent>

      <Dialog
        open={edit !== null}
        onOpenChange={(open) => {
          if (!open) setEdit(null)
        }}
      >
        <DialogContent
          showOverlay={false}
          className="top-[15%] translate-y-0 shadow-2xl"
        >
          <DialogHeader>
            <DialogTitle>
              {edit?.name} · Round {(edit?.roundIndex ?? 0) + 1}
            </DialogTitle>
            <DialogDescription>Set the score for this round.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="flex flex-col gap-3">
            <Input
              inputMode="numeric"
              pattern="-?[0-9]*"
              value={raw}
              autoFocus
              aria-label="Score"
              aria-invalid={error ? true : undefined}
              onChange={(event) => {
                setRaw(event.target.value)
                setError(null)
              }}
              className="h-14 text-center text-2xl font-bold"
            />
            {error && (
              <p role="alert" className="text-destructive text-center text-sm">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="h-12">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
