import { motion } from 'framer-motion'
import { Crown, Target } from 'lucide-react'

import { computeLeaderboard } from '@/domain/scoring'
import type { Game } from '@/domain/types'
import { cn } from '@/lib/utils'

import { PlayerAvatar } from './player-avatar'

interface LeaderboardProps {
  game: Game
  className?: string
}

/** Live standings with animated reordering and current-leader highlighting. */
export function Leaderboard({ game, className }: LeaderboardProps) {
  const entries = computeLeaderboard(game)

  return (
    <ol className={cn('flex flex-col gap-2', className)}>
      {entries.map((entry) => (
        <motion.li
          key={entry.player.id}
          layout
          transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
          className={cn(
            'flex items-center gap-3 rounded-xl border p-3',
            entry.isLeader
              ? 'border-primary/50 bg-primary/5'
              : 'bg-card border-border',
          )}
        >
          <span className="text-muted-foreground w-6 shrink-0 text-center text-sm font-semibold tabular-nums">
            {entry.rank}
          </span>
          <PlayerAvatar name={entry.player.name} color={entry.player.color} />
          <span className="min-w-0 flex-1 truncate font-medium">
            {entry.player.name}
          </span>
          {entry.reachedTarget && (
            <>
              <Target
                className="size-4 shrink-0 text-emerald-500"
                aria-hidden
              />
              <span className="sr-only">Reached target.</span>
            </>
          )}
          {entry.isLeader && (
            <>
              <Crown className="size-4 shrink-0 text-amber-500" aria-hidden />
              <span className="sr-only">Leading.</span>
            </>
          )}
          <span className="w-12 shrink-0 text-right text-lg font-bold tabular-nums">
            {entry.total}
          </span>
        </motion.li>
      ))}
    </ol>
  )
}
