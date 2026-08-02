import { useMemo } from 'react'
import { useParams } from 'react-router'
import { Check, Lock, Swords, TrendingUp } from 'lucide-react'

import { EmptyState, LoadingState } from '@/components/common/screen-state'
import { PlayerAvatar } from '@/components/game/player-avatar'
import { PageHeader } from '@/components/layout/page-header'
import { StatTile, WinRing } from '@/components/stats/charts'
import {
  FinishTimeline,
  FormGuide,
  VersusBar,
} from '@/components/stats/history-charts'
import { normalizeName } from '@/domain/analysis'
import { colorByKey } from '@/domain/colors'
import { computePlayerHistory } from '@/domain/history'
import type { AvatarConfig } from '@/domain/types'
import { cn } from '@/lib/utils'
import { useAllGames, useHasHydrated } from '@/stores/game-store'

export function PlayerPage() {
  const { name: raw } = useParams()
  const name = raw ? decodeURIComponent(raw) : ''
  const hydrated = useHasHydrated()
  const games = useAllGames()

  const history = useMemo(
    () => computePlayerHistory(games, name),
    [games, name],
  )

  const avatar = useMemo<AvatarConfig | undefined>(() => {
    const key = normalizeName(name)
    for (let i = games.length - 1; i >= 0; i--) {
      const p = games[i].players.find((pl) => normalizeName(pl.name) === key)
      if (p?.avatar) return p.avatar
    }
    return undefined
  }, [games, name])

  if (!hydrated) return <LoadingState />

  if (history.games === 0) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <PageHeader title={name || 'Player'} />
        <EmptyState
          title="No games yet"
          description={`${name || 'This player'} hasn't finished any games. Play a game to build their history.`}
        />
      </div>
    )
  }

  const { bests } = history

  return (
    <div className="flex flex-col gap-6 py-4 pb-safe">
      <PageHeader title={history.name} />

      <section className="bg-card flex items-center gap-4 rounded-2xl border p-4">
        <PlayerAvatar
          name={history.name}
          color={history.color}
          avatar={avatar}
          size={64}
          blink
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{history.name}</p>
          <p className="text-muted-foreground text-sm">
            {history.wins}/{history.games} wins
          </p>
          {history.recentForm.length > 0 && (
            <FormGuide
              className="mt-1.5"
              results={[...history.recentForm]
                .reverse()
                .map((t) => ({ won: t.won, rank: t.rank }))}
            />
          )}
        </div>
        <WinRing
          pct={history.winPct}
          color={colorByKey(history.color).hex}
          size={64}
          stroke={8}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-semibold">
          Personal bests
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <StatTile value={bests.highestRound} label="Best round" />
          <StatTile value={bests.highestGameTotal} label="Best total" />
          <StatTile
            value={bests.bestFinish != null ? `#${bests.bestFinish}` : '—'}
            label="Best finish"
          />
          <StatTile value={bests.longestWinStreak} label="Win streak" />
          <StatTile value={bests.mostFlip7InGame} label="Flip 7 (game)" />
          <StatTile value={bests.largestWinMargin} label="Big win by" />
        </div>
      </section>

      {history.timeline.length >= 2 && (
        <section className="space-y-2">
          <h2 className="text-muted-foreground flex items-center gap-1.5 text-sm font-semibold">
            <TrendingUp className="size-4" aria-hidden />
            Finish timeline
          </h2>
          <div className="bg-card rounded-xl border p-3">
            <FinishTimeline
              data={history.timeline.map((t) => ({
                rank: t.rank,
                playerCount: t.playerCount,
                won: t.won,
              }))}
            />
            <p className="text-muted-foreground mt-1 text-center text-[11px]">
              Finishing position across {history.timeline.length} games — higher
              is better
            </p>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-semibold">
          Milestones
        </h2>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {history.milestones.map((m) => (
            <div
              key={m.label}
              className={cn(
                'flex items-center gap-2 rounded-lg border p-2.5 text-sm',
                m.reached ? 'bg-card' : 'bg-muted/40 text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full',
                  m.reached
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {m.reached ? (
                  <Check className="size-3.5" />
                ) : (
                  <Lock className="size-3" />
                )}
              </span>
              <span className="flex-1">{m.label}</span>
              {!m.reached && m.target != null && (
                <span className="text-xs tabular-nums">
                  {m.current ?? 0}/{m.target}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {history.rivalries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-muted-foreground flex items-center gap-1.5 text-sm font-semibold">
            <Swords className="size-4" aria-hidden />
            Rivalries
          </h2>
          <div className="flex flex-col gap-2">
            {history.rivalries.map((r) => {
              const h = r.headToHead
              return (
                <div key={r.name} className="bg-card rounded-xl border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <PlayerAvatar name={r.name} color={r.color} size={28} />
                    <p className="flex-1 truncate text-sm font-semibold">
                      {history.name}{' '}
                      <span className="text-muted-foreground font-normal">
                        vs
                      </span>{' '}
                      {r.name}
                    </p>
                    <span className="text-muted-foreground text-xs">
                      {h.games} {h.games === 1 ? 'game' : 'games'}
                    </span>
                  </div>
                  <VersusBar
                    leftLabel="W"
                    left={h.aWins}
                    right={h.bWins}
                    rightLabel="W"
                    leftColor={colorByKey(history.color).hex}
                    rightColor={colorByKey(r.color).hex}
                  />
                  <div className="text-muted-foreground mt-2 flex justify-between text-[11px]">
                    <span>
                      Avg finish{' '}
                      {h.aAvgFinish != null ? h.aAvgFinish.toFixed(1) : '—'} vs{' '}
                      {h.bAvgFinish != null ? h.bAvgFinish.toFixed(1) : '—'}
                    </span>
                    {h.largestMargin && (
                      <span>
                        Biggest win: {h.largestMargin.leader} by{' '}
                        {h.largestMargin.value}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
