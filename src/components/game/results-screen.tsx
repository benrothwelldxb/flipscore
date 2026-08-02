import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { Home, RotateCcw, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  colorByKey,
  initialsFromName,
  readableTextColor,
} from '@/domain/colors'
import type { Game } from '@/domain/types'
import { vibrate } from '@/lib/haptics'
import { useGameStore } from '@/stores/game-store'

import { Leaderboard } from './leaderboard'

interface ResultsScreenProps {
  game: Game
}

export function ResultsScreen({ game }: ResultsScreenProps) {
  const navigate = useNavigate()
  const store = useGameStore.getState
  const winner = game.players.find((p) => p.id === game.winnerId) ?? null

  useEffect(() => {
    vibrate([20, 40, 20, 40, 70])
  }, [])

  function playAgain() {
    const newId = store().rematch(game.id)
    if (newId) navigate(`/game/${newId}`, { replace: true })
  }

  const winnerColor = winner ? colorByKey(winner.color) : null

  return (
    <div className="flex flex-col gap-6 py-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.4, duration: 0.6 }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <Trophy className="size-10 text-amber-500" aria-hidden />
        {winner && winnerColor ? (
          <>
            <span
              className="inline-flex size-24 items-center justify-center rounded-full text-4xl font-bold shadow-lg"
              style={{
                backgroundColor: winnerColor.hex,
                color: readableTextColor(winnerColor.hex),
              }}
              aria-hidden
            >
              {initialsFromName(winner.name)}
            </span>
            <div>
              <p className="text-muted-foreground text-sm tracking-wide uppercase">
                Winner
              </p>
              <h1 className="text-3xl font-bold">{winner.name} wins!</h1>
            </div>
          </>
        ) : (
          <h1 className="text-2xl font-bold">Game over</h1>
        )}
      </motion.div>

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-semibold">
          Final standings
        </h2>
        <Leaderboard game={game} />
      </section>

      <div className="flex flex-col gap-2 pb-safe">
        <Button size="lg" className="h-14 w-full text-base" onClick={playAgain}>
          <RotateCcw className="size-5" />
          Play again
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate('/')}
        >
          <Home className="size-4" />
          Home
        </Button>
      </div>
    </div>
  )
}
