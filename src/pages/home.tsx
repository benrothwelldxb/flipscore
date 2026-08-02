import { Link, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { Archive, ChartColumn, Plus, Spade, Wifi } from 'lucide-react'

import { Wordmark } from '@/components/brand/wordmark'
import { EmptyState, LoadingState } from '@/components/common/screen-state'
import { GameCard } from '@/components/game/game-card'
import { Button } from '@/components/ui/button'
import {
  useActiveGames,
  useGameStore,
  useHasHydrated,
} from '@/stores/game-store'

export function HomePage() {
  const navigate = useNavigate()
  const hydrated = useHasHydrated()
  const games = useActiveGames()

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
        <Wordmark alt="" className="w-full max-w-[18rem] drop-shadow-sm" />
        <p className="text-muted-foreground text-sm">
          Keep score for game night.
        </p>
      </motion.div>

      <Button size="lg" className="h-14 w-full text-base" onClick={newGame}>
        <Plus className="size-5" />
        New game
      </Button>

      <Button asChild variant="outline" className="h-11 w-full">
        <Link to="/join">
          <Wifi className="size-4" />
          Join a game
        </Link>
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="h-11">
          <Link to="/archive">
            <Archive className="size-4" />
            Archive
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link to="/stats">
            <ChartColumn className="size-4" />
            Stats
          </Link>
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Spade className="size-10" />}
          title="No games in progress"
          description="Start a new game to keep score. Finished games move to your archive."
        />
      ) : (
        <section className="space-y-2">
          <h2 className="text-muted-foreground text-sm font-semibold">
            In progress
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
