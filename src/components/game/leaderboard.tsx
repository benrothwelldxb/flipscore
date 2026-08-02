import { motion } from 'framer-motion'
import { Target } from 'lucide-react'

import { CountUp } from '@/components/common/count-up'
import { computeLeaderboard } from '@/domain/scoring'
import type { Game } from '@/domain/types'
import { cn } from '@/lib/utils'

import { PlayerAvatar } from './player-avatar'

interface LeaderboardProps {
  game: Game
  className?: string
}

function rankClass(rank: number): string {
  if (rank === 1) return 'bg-amber-400 text-amber-950'
  if (rank === 2) return 'bg-slate-300 text-slate-800'
  if (rank === 3) return 'bg-orange-400 text-orange-950'
  return 'bg-muted text-muted-foreground'
}

/** Live standings with animated reordering, medals, and count-up totals. */
export function Leaderboard({ game, className }: LeaderboardProps) {
  const entries = computeLeaderboard(game)
  const round = game.rounds[game.currentRoundIndex]

  return (
    <ol className={cn('flex flex-col gap-2', className)}>
      {entries.map((entry, index) => (
        <motion.li
          key={entry.player.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            layout: { type: 'spring', bounce: 0.2, duration: 0.5 },
            delay: index * 0.04,
          }}
          className={cn(
            'flex items-center gap-3 rounded-xl border p-3',
            entry.isLeader
              ? 'border-primary/50 bg-primary/5'
              : 'bg-card border-border',
          )}
        >
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
              rankClass(entry.rank),
            )}
            aria-hidden
          >
            {entry.rank}
          </span>
          <PlayerAvatar
            name={entry.player.name}
            color={entry.player.color}
            avatar={entry.player.avatar}
            crown={entry.isLeader}
            winner={
              game.status === 'finished' && entry.player.id === game.winnerId
            }
            expression={
              game.status === 'playing' && round?.flags?.[entry.player.id]?.bust
                ? 'bust'
                : 'default'
            }
          />
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
          {entry.isLeader && <span className="sr-only">Leading.</span>}
          <span className="w-12 shrink-0 text-right text-lg font-bold tabular-nums">
            <CountUp value={entry.total} />
            <span className="sr-only">{entry.total} points</span>
          </span>
        </motion.li>
      ))}
    </ol>
  )
}
