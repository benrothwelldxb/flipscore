import { Link } from 'react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { CalendarDays, MapPin, Share2, Trophy } from 'lucide-react'

import { PlayerAvatar } from '@/components/game/player-avatar'
import { Button } from '@/components/ui/button'
import type { GameNightSummary, NightPlayerStat } from '@/domain/game-night'
import { cn } from '@/lib/utils'

import { AwardCard } from './award-card'

const PLACEMENT = new Set(['champion', 'runner-up', 'wooden-spoon'])

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Podium tile for one of the top three. */
function PodiumStep({
  stat,
  place,
}: {
  stat: NightPlayerStat
  place: 1 | 2 | 3
}) {
  const heights = { 1: 'h-20', 2: 'h-14', 3: 'h-10' }
  const tones = {
    1: 'bg-amber-400 text-amber-950',
    2: 'bg-slate-300 text-slate-800',
    3: 'bg-orange-400 text-orange-950',
  }
  return (
    <div className="flex w-full flex-col items-center justify-end gap-1.5">
      <PlayerAvatar
        name={stat.player.name}
        color={stat.player.color}
        avatar={stat.player.avatar}
        size={place === 1 ? 56 : 44}
        crown={place === 1}
        winner={place === 1}
      />
      <p className="w-full truncate text-center text-xs font-semibold">
        {stat.player.name}
      </p>
      <div
        className={cn(
          'flex w-full items-start justify-center rounded-t-lg pt-1 text-lg font-black',
          heights[place],
          tones[place],
        )}
      >
        {place}
      </div>
    </div>
  )
}

interface NightSummaryProps {
  summary: GameNightSummary
  onShare?: () => void
  sharing?: boolean
}

/** The end-of-night results: champion, podium, awards and full standings. */
export function NightSummary({ summary, onShare, sharing }: NightSummaryProps) {
  const reduce = useReducedMotion()
  const { night, standings, awards, champion } = summary
  const podium = standings.slice(0, 3)
  const funAwards = awards.filter((a) => !PLACEMENT.has(a.key))

  if (summary.gamesPlayed === 0) {
    return (
      <div className="bg-muted/40 text-muted-foreground rounded-xl border p-6 text-center text-sm">
        Play a game to start building the night&apos;s results.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.95 }}
        animate={reduce ? {} : { opacity: 1, scale: 1 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', bounce: 0.35 }}
        className="from-primary/10 to-accent/20 flex flex-col items-center gap-2 rounded-2xl border bg-gradient-to-br p-5 text-center"
      >
        <Trophy className="size-7 text-amber-500" aria-hidden />
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          {night.name}
          {night.venue ? ` · ${night.venue}` : ''}
        </p>
        {champion && (
          <>
            <PlayerAvatar
              name={champion.player.name}
              color={champion.player.color}
              avatar={champion.player.avatar}
              size={96}
              crown
              winner
              blink
              className="drop-shadow-lg"
            />
            <div>
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                Overall Champion
              </p>
              <h2 className="text-2xl font-bold">{champion.player.name}</h2>
              <p className="text-muted-foreground text-sm">
                {champion.wins} {champion.wins === 1 ? 'win' : 'wins'} ·{' '}
                {summary.gamesPlayed}{' '}
                {summary.gamesPlayed === 1 ? 'game' : 'games'}
              </p>
            </div>
          </>
        )}
      </motion.div>

      {podium.length >= 2 && (
        <div className="grid grid-cols-3 items-end gap-2">
          {podium[1] && <PodiumStep stat={podium[1]} place={2} />}
          {podium[0] && <PodiumStep stat={podium[0]} place={1} />}
          {podium[2] ? <PodiumStep stat={podium[2]} place={3} /> : <div />}
        </div>
      )}

      {funAwards.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-muted-foreground text-sm font-semibold">
            Awards
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {funAwards.map((award) => (
              <AwardCard key={award.key} award={award} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-muted-foreground text-sm font-semibold">
          Final standings
        </h3>
        <div className="bg-card overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-b text-xs">
              <tr>
                <th className="p-2 text-left font-medium">#</th>
                <th className="p-2 text-left font-medium">Player</th>
                <th className="p-2 text-right font-medium">W</th>
                <th className="p-2 text-right font-medium">Avg</th>
                <th className="p-2 text-right font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.player.id} className="border-b last:border-0">
                  <td className="p-2 font-bold tabular-nums">{i + 1}</td>
                  <td className="p-2">
                    <Link
                      to={`/player/${encodeURIComponent(s.player.name)}`}
                      className="hover:text-primary flex items-center gap-2"
                    >
                      <PlayerAvatar
                        name={s.player.name}
                        color={s.player.color}
                        avatar={s.player.avatar}
                        size={24}
                      />
                      <span className="truncate font-medium">
                        {s.player.name}
                      </span>
                    </Link>
                  </td>
                  <td className="p-2 text-right font-semibold tabular-nums">
                    {s.wins}
                  </td>
                  <td className="text-muted-foreground p-2 text-right tabular-nums">
                    {s.avgFinish.toFixed(1)}
                  </td>
                  <td className="p-2 text-right tabular-nums">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="text-muted-foreground flex items-center justify-center gap-3 text-xs">
        <span className="flex items-center gap-1">
          <CalendarDays className="size-3.5" aria-hidden />
          {formatDate(night.date)}
        </span>
        {night.venue && (
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {night.venue}
          </span>
        )}
      </div>

      {onShare && (
        <Button
          size="lg"
          className="h-12 w-full"
          onClick={onShare}
          disabled={sharing}
        >
          <Share2 className="size-4" />
          {sharing ? 'Preparing image…' : 'Share results'}
        </Button>
      )}
    </div>
  )
}
