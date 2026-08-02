import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Flag, ListOrdered, PartyPopper, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Game, Player, RoundFlags } from '@/domain/types'
import { useToast } from '@/hooks/use-toast'
import { vibrate } from '@/lib/haptics'
import { playSound } from '@/lib/sound'
import { useCanUndo, useGameStore } from '@/stores/game-store'

import { Leaderboard } from './leaderboard'
import { PlayerAvatar } from './player-avatar'
import { RoundHistory } from './round-history'
import { ScoreEntryPanel } from './score-entry-panel'

type Phase = 'scoring' | 'handoff' | 'roundEnd'

interface PassScreenProps {
  game: Game
}

function BigAvatar({ player, size = 96 }: { player: Player; size?: number }) {
  return (
    <PlayerAvatar
      name={player.name}
      color={player.color}
      avatar={player.avatar}
      size={size}
      blink
    />
  )
}

export function PassThePhoneScreen({ game }: PassScreenProps) {
  const [phase, setPhase] = useState<Phase>('scoring')
  const store = useGameStore.getState
  const canUndo = useCanUndo(game.id)
  const { toast } = useToast()

  const round = game.rounds[game.currentRoundIndex]
  const roundNumber = game.currentRoundIndex + 1
  const scoredCount = game.players.filter((p) => p.id in round.scores).length

  const currentPlayer: Player | undefined = game.players[scoredCount]
  const roundComplete = scoredCount >= game.players.length

  function handleSubmit(value: number, flags?: RoundFlags) {
    if (!currentPlayer) return
    store().submitScore(game.id, currentPlayer.id, value, flags)
    vibrate([10, 30, 10])
    playSound('save')
    // If that entry finished the game, the parent swaps to the results screen.
    if (scoredCount + 1 >= game.players.length) {
      setPhase('roundEnd')
    } else {
      setPhase('handoff')
    }
  }

  function startNextRound() {
    store().nextRound(game.id)
    setPhase('scoring')
  }

  function handleUndo() {
    store().undo(game.id)
    vibrate(10)
    playSound('undo')
    setPhase('scoring')
    toast('Undone')
  }

  // Derive the shown phase from game state so external edits (replay / delete /
  // undo from the Rounds dialog) can never leave us on a stale screen.
  const effectivePhase: Phase = roundComplete
    ? 'roundEnd'
    : phase === 'roundEnd'
      ? 'scoring'
      : phase

  const handoffRef = useRef<HTMLButtonElement>(null)

  // Move focus to the handoff prompt so screen-reader / keyboard users aren't
  // stranded on <body> when the phase changes.
  useEffect(() => {
    if (effectivePhase === 'handoff') handoffRef.current?.focus()
  }, [effectivePhase])

  const liveMessage =
    effectivePhase === 'handoff' && currentPlayer
      ? `Pass the phone to ${currentPlayer.name}.`
      : effectivePhase === 'roundEnd'
        ? `Round ${roundNumber} complete.`
        : effectivePhase === 'scoring' && currentPlayer
          ? `${currentPlayer.name}, your turn to score.`
          : ''

  return (
    <div className="flex min-h-[70svh] flex-col">
      <p role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </p>
      <AnimatePresence mode="wait">
        {effectivePhase === 'scoring' && currentPlayer && (
          <motion.div
            key={`score-${currentPlayer.id}-${roundNumber}`}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            className="flex flex-1 flex-col gap-4"
          >
            {/* Compact identity strip keeps the score entry in the viewport. */}
            <div className="flex items-center gap-3">
              <BigAvatar player={currentPlayer} size={44} />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg leading-tight font-bold">
                  {currentPlayer.name}
                </h1>
                <p className="text-muted-foreground text-xs">
                  Round {roundNumber} · Player {scoredCount + 1} of{' '}
                  {game.players.length}
                </p>
              </div>
              {canUndo && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={handleUndo}
                  aria-label="Undo last score"
                >
                  <Undo2 className="size-4" />
                  Undo
                </Button>
              )}
            </div>
            <ScoreEntryPanel
              onSubmit={handleSubmit}
              submitLabel="Save & pass"
              rules={game.settings.rules}
            />
          </motion.div>
        )}

        {effectivePhase === 'handoff' && currentPlayer && (
          <motion.button
            key="handoff"
            ref={handoffRef}
            type="button"
            onClick={() => {
              vibrate(8)
              playSound('tap')
              setPhase('scoring')
            }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
            className="focus-visible:ring-ring/50 flex flex-1 cursor-pointer flex-col items-center justify-center gap-6 rounded-2xl text-center outline-none focus-visible:ring-4"
            aria-label={`Pass the phone to ${currentPlayer.name}, then tap to continue`}
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{
                repeat: Infinity,
                duration: 1.6,
                ease: 'easeInOut',
              }}
            >
              <BigAvatar player={currentPlayer} size={120} />
            </motion.div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm tracking-wide uppercase">
                Pass the phone to
              </p>
              <p className="text-3xl font-bold">{currentPlayer.name}</p>
            </div>
            <span className="text-primary inline-flex items-center gap-2 font-medium">
              Tap when ready <ArrowRight className="size-5" />
            </span>
          </motion.button>
        )}

        {effectivePhase === 'roundEnd' && (
          <motion.div
            key="roundEnd"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
            className="flex flex-1 flex-col gap-5"
          >
            <div className="flex flex-col items-center gap-2 pt-2 text-center">
              <PartyPopper className="text-primary size-8" aria-hidden />
              <h1 className="text-2xl font-bold">Round {roundNumber} done</h1>
              <p className="text-muted-foreground text-sm">
                Here&apos;s where things stand.
              </p>
            </div>
            <Leaderboard game={game} />
            <div className="mt-auto flex flex-col gap-2 pt-2 pb-safe">
              <Button
                size="lg"
                className="h-14 w-full text-base"
                onClick={startNextRound}
              >
                Start round {roundNumber + 1}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <RoundHistory
                  game={game}
                  trigger={
                    <Button variant="outline" className="w-full">
                      <ListOrdered className="size-4" />
                      Rounds
                    </Button>
                  }
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => store().endGame(game.id)}
                >
                  <Flag className="size-4" />
                  Finish
                </Button>
              </div>
              {canUndo && (
                <Button variant="ghost" className="w-full" onClick={handleUndo}>
                  <Undo2 className="size-4" />
                  Undo last score
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
