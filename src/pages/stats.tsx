import { useMemo } from 'react'
import { Link } from 'react-router'
import { Ban, ChartColumn, Flame, Sparkles, TrendingUp } from 'lucide-react'

import { EmptyState, LoadingState } from '@/components/common/screen-state'
import { PageHeader } from '@/components/layout/page-header'
import {
  BarRow,
  RecordCard,
  StatTile,
  WinRing,
} from '@/components/stats/charts'
import { colorByKey } from '@/domain/colors'
import { computeStats } from '@/domain/stats'
import { useAllGames, useHasHydrated } from '@/stores/game-store'

export function StatsPage() {
  const hydrated = useHasHydrated()
  const games = useAllGames()
  const stats = useMemo(() => computeStats(games), [games])

  if (!hydrated) return <LoadingState />

  if (stats.totalGames === 0) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <PageHeader title="Stats" />
        <EmptyState
          icon={<ChartColumn className="size-10" />}
          title="No stats yet"
          description="Finish a game and your player statistics will appear here — automatically."
        />
      </div>
    )
  }

  const { players, records } = stats
  const leader = players[0]
  const maxWins = Math.max(...players.map((p) => p.gamesWon), 1)

  return (
    <div className="flex flex-col gap-6 py-4 pb-safe">
      <PageHeader title="Stats" />

      <div className="grid grid-cols-3 gap-2">
        <StatTile value={stats.totalGames} label="Games" />
        <StatTile value={players.length} label="Players" />
        <StatTile
          value={leader ? `${Math.round(leader.winPct * 100)}%` : '—'}
          label="Top win rate"
          sub={leader?.name}
        />
      </div>

      {(records.highestRound ||
        records.longestStreak ||
        records.mostFlip7 ||
        records.mostBusts) && (
        <section className="space-y-2">
          <h2 className="text-muted-foreground text-sm font-semibold">
            Records
          </h2>
          <div className="grid gap-2">
            {records.highestRound && (
              <RecordCard
                icon={<TrendingUp className="size-5" />}
                label="Highest round"
                name={records.highestRound.name}
                value={records.highestRound.value}
              />
            )}
            {records.longestStreak && (
              <RecordCard
                icon={<Flame className="size-5" />}
                label="Longest win streak"
                name={records.longestStreak.name}
                value={records.longestStreak.value}
              />
            )}
            {records.mostFlip7 && (
              <RecordCard
                icon={<Sparkles className="size-5" />}
                label="Most Flip 7 bonuses"
                name={records.mostFlip7.name}
                value={records.mostFlip7.value}
              />
            )}
            {records.mostBusts && (
              <RecordCard
                icon={<Ban className="size-5" />}
                label="Most busts"
                name={records.mostBusts.name}
                value={records.mostBusts.value}
              />
            )}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-semibold">Wins</h2>
        <div className="bg-card space-y-2 rounded-xl border p-3">
          {players.map((player) => (
            <BarRow
              key={player.name}
              label={player.name}
              value={player.gamesWon}
              max={maxWins}
              color={colorByKey(player.color).hex}
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-semibold">Players</h2>
        <div className="flex flex-col gap-2">
          {players.map((player) => (
            <Link
              key={player.name}
              to={`/player/${encodeURIComponent(player.name)}`}
              className="bg-card hover:bg-accent/40 focus-visible:ring-ring/50 flex items-center gap-3 rounded-xl border p-3 outline-none transition focus-visible:ring-2"
            >
              <WinRing
                pct={player.winPct}
                color={colorByKey(player.color).hex}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{player.name}</p>
                <p className="text-muted-foreground text-xs">
                  {player.gamesWon}/{player.gamesPlayed} wins · avg{' '}
                  {player.averageScore}
                </p>
                <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  <span>High {player.highestRound ?? '—'}</span>
                  <span>Low {player.lowestRound ?? '—'}</span>
                  <span>Avg finish {player.averageFinish ?? '—'}</span>
                  <span>Streak {player.longestWinStreak}</span>
                  {player.flip7Count > 0 && (
                    <span>Flip 7 ×{player.flip7Count}</span>
                  )}
                  {player.bustCount > 0 && (
                    <span>Busts ×{player.bustCount}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
