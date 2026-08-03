import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { Home, ListOrdered, RotateCcw, Trophy } from 'lucide-react'

import { StickerEarnedBanner } from '@/components/stickers/sticker-earned-banner'
import { Button } from '@/components/ui/button'
import { computeAchievementMetrics } from '@/domain/stickers/metrics'
import type { Sticker } from '@/domain/stickers/types'
import type { Game } from '@/domain/types'
import { celebrate } from '@/lib/confetti'
import { vibrate } from '@/lib/haptics'
import { playSound } from '@/lib/sound'
import { resolveIdentityName } from '@/domain/social'
import { toast } from '@/hooks/use-toast'
import { useGameStore } from '@/stores/game-store'
import { useIdentityStore } from '@/stores/identity-store'
import { useStickersStore } from '@/stores/stickers-store'

import { Leaderboard } from './leaderboard'
import { PlayerAvatar } from './player-avatar'
import { RoundHistory } from './round-history'

interface ResultsScreenProps {
  game: Game
}

export function ResultsScreen({ game }: ResultsScreenProps) {
  const navigate = useNavigate()
  const store = useGameStore.getState
  const reduce = useReducedMotion()
  const winner = game.players.find((p) => p.id === game.winnerId) ?? null

  const [earned, setEarned] = useState<Sticker[]>([])

  const celebrated = useRef(false)
  useEffect(() => {
    if (celebrated.current) return
    celebrated.current = true
    vibrate([20, 40, 20, 40, 70])
    celebrate()
    playSound('win')

    // Finishing a game is the moment to award stickers. Reconcile *your* record
    // against the whole (now-updated) history and surface anything freshly earned.
    const allGames = useGameStore.getState().games
    const me = resolveIdentityName(useIdentityStore.getState().name, allGames)
    const metrics = computeAchievementMetrics(allGames, me)
    const newly = useStickersStore.getState().reconcile(metrics)
    if (newly.length > 0) {
      // Capturing the one-time reconcile result to drive the reveal is exactly
      // what this mount effect is for.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEarned(newly)
      toast.success(
        newly.length === 1
          ? `Sticker unlocked: ${newly[0].name}`
          : `${newly.length} new stickers unlocked!`,
      )
    }
  }, [])

  function playAgain() {
    const newId = store().rematch(game.id)
    if (newId) navigate(`/game/${newId}`, { replace: true })
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.9 }}
        animate={reduce ? {} : { opacity: 1, scale: 1 }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: 'spring', bounce: 0.4, duration: 0.6 }
        }
        className="flex flex-col items-center gap-3 text-center"
      >
        <Trophy className="size-10 text-amber-500" aria-hidden />
        {winner ? (
          <>
            <PlayerAvatar
              name={winner.name}
              color={winner.color}
              avatar={winner.avatar}
              size={112}
              winner
              crown
              blink
              className="drop-shadow-lg"
            />
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

      <StickerEarnedBanner stickers={earned} />

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
        <RoundHistory
          game={game}
          trigger={
            <Button variant="outline" className="w-full">
              <ListOrdered className="size-4" />
              View &amp; edit rounds
            </Button>
          }
        />
        <Button
          variant="ghost"
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
