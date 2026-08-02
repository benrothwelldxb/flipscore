import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Play, UserPlus } from 'lucide-react'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DEFAULT_TARGET_SCORE, PLAYER_LIMITS, type Game } from '@/domain/types'
import { useGameStore } from '@/stores/game-store'

import { ConnectedSetupPanel } from './connected/connected-setup-panel'
import { ModeSelector } from './mode-selector'
import { PlayerEditor } from './player-editor'
import { SavedPlayersRow } from './saved-players-row'

interface SetupScreenProps {
  game: Game
}

export function SetupScreen({ game }: SetupScreenProps) {
  const navigate = useNavigate()
  const [targetInput, setTargetInput] = useState(
    String(game.settings.targetScore),
  )

  const store = useGameStore.getState

  const connected = game.settings.mode === 'connected'
  const namesValid = game.players.every((p) => p.name.trim().length > 0)
  const canStart = game.players.length >= PLAYER_LIMITS.min && namesValid
  const atMax = game.players.length >= PLAYER_LIMITS.max

  function commitTarget(raw: string) {
    const parsed = parseInt(raw, 10)
    const value =
      Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TARGET_SCORE
    setTargetInput(String(value))
    store().updateSettings(game.id, { targetScore: value })
  }

  function handleDiscard() {
    store().deleteGame(game.id)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Discard game">
              <ArrowLeft className="size-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Discard this game?</DialogTitle>
              <DialogDescription>
                This setup hasn&apos;t started yet. Leaving will discard it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Keep editing</Button>
              </DialogClose>
              <Button variant="destructive" onClick={handleDiscard}>
                Discard
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <h1 className="text-xl font-bold">New game</h1>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm leading-none font-medium">Mode</h2>
        <ModeSelector
          value={game.settings.mode}
          onChange={(mode) => store().updateSettings(game.id, { mode })}
        />
      </section>

      {!connected && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm leading-none font-medium">
              Players ({game.players.length})
            </h2>
            <span className="text-muted-foreground text-xs">
              {PLAYER_LIMITS.min}–{PLAYER_LIMITS.max}
            </span>
          </div>
          <PlayerEditor
            players={game.players}
            onRename={(id, name) => store().updatePlayer(game.id, id, { name })}
            onAvatarChange={(id, avatar) =>
              store().updatePlayer(game.id, id, { avatar })
            }
            onRemove={(id) => store().removePlayer(game.id, id)}
            onReorder={(ids) => store().reorderPlayers(game.id, ids)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => store().addPlayer(game.id)}
            disabled={atMax}
          >
            <UserPlus className="size-4" />
            {atMax ? 'Maximum players reached' : 'Add player'}
          </Button>
          <SavedPlayersRow
            gameId={game.id}
            currentNames={game.players.map((p) => p.name)}
            disabled={atMax}
          />
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="target-score">Target score</Label>
          <Input
            id="target-score"
            inputMode="numeric"
            pattern="[0-9]*"
            value={targetInput}
            onChange={(event) => setTargetInput(event.target.value)}
            onBlur={(event) => commitTarget(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="game-name">Name (optional)</Label>
          <Input
            id="game-name"
            value={game.name}
            placeholder="Game night"
            maxLength={40}
            onChange={(event) =>
              store().renameGame(game.id, event.target.value)
            }
          />
        </div>
      </section>

      {connected ? (
        <ConnectedSetupPanel game={game} />
      ) : (
        <div className="bg-background/80 sticky bottom-0 -mx-4 border-t px-4 pt-3 pb-safe backdrop-blur">
          <Button
            size="lg"
            className="h-14 w-full text-base"
            disabled={!canStart}
            onClick={() => store().startGame(game.id)}
          >
            <Play className="size-5" />
            Start game
          </Button>
          {!canStart && (
            <p className="text-muted-foreground mt-2 text-center text-xs">
              Every player needs a name to start.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
