import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { Plus, Spade } from 'lucide-react'

import { Wordmark } from '@/components/brand/wordmark'
import { EmptyState, LoadingState } from '@/components/common/screen-state'
import { GameCard } from '@/components/game/game-card'
import { Button } from '@/components/ui/button'
import { useGames, useGameStore, useHasHydrated } from '@/stores/game-store'

export function HomePage() {
  const navigate = useNavigate()
  const hydrated = useHasHydrated()
  const games = useGames()

  if (!hydrated) return <LoadingState />

  function newGame() {
    const id = useGameStore.getState().createGame('host')
    navigate(`/game/${id}`)
  }

  const sorted = [...games].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="flex flex-col gap-6 py-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.3 }}
        className="flex flex-col items-center gap-3 pt-2 text-center"
      >
        <h1 className="sr-only">FlipScorer</h1>
        <div className="w-full max-w-[17rem] rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
          <Wordmark alt="" />
        </div>
        <p className="text-muted-foreground text-sm">
          Keep score for game night.
        </p>
      </motion.div>

      <Button size="lg" className="h-14 w-full text-base" onClick={newGame}>
        <Plus className="size-5" />
        New game
      </Button>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Spade className="size-10" />}
          title="No games yet"
          description="Start a new game to keep score. Everything is saved on this device — no account needed."
        />
      ) : (
        <section className="space-y-2">
          <h2 className="text-muted-foreground text-sm font-semibold">
            Your games
          </h2>
          <ul className="flex flex-col gap-2">
            {sorted.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onOpen={() => navigate(`/game/${game.id}`)}
                onDelete={() => useGameStore.getState().deleteGame(game.id)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
