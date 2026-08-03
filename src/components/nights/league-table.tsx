import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Medal } from 'lucide-react'

import { PlayerAvatar } from '@/components/game/player-avatar'
import {
  LEAGUE_PRESETS,
  LEAGUE_PRESET_LABELS,
  computeLeagueTable,
  type LeaguePreset,
} from '@/domain/tournament'
import type { Game, Player } from '@/domain/types'
import { cn } from '@/lib/utils'

const PRESETS: LeaguePreset[] = ['podium', 'f1', 'winner']
const SHORT: Record<LeaguePreset, string> = {
  podium: '3-2-1',
  f1: 'Grand Prix',
  winner: 'Wins',
}

/**
 * A points-based league across a set of games. The scoring preset is picked
 * locally — it changes how the table is ranked, not the underlying results.
 */
export function LeagueTable({
  games,
  roster,
}: {
  games: Game[]
  roster: Player[]
}) {
  const [preset, setPreset] = useState<LeaguePreset>('podium')
  const rows = useMemo(
    () => computeLeagueTable(games, LEAGUE_PRESETS[preset], roster),
    [games, preset, roster],
  )

  if (rows.length === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-muted-foreground flex items-center gap-1.5 text-sm font-semibold">
          <Medal className="size-4" aria-hidden />
          League
        </h3>
        <div
          role="group"
          aria-label="Scoring system"
          className="bg-muted/60 flex rounded-full p-0.5 text-xs font-medium"
        >
          {PRESETS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={preset === key}
              onClick={() => setPreset(key)}
              className={cn(
                'rounded-full px-2.5 py-1 transition-colors',
                preset === key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {SHORT[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-b text-xs">
            <tr>
              <th className="p-2 text-left font-medium">#</th>
              <th className="p-2 text-left font-medium">Player</th>
              <th className="p-2 text-right font-medium">P</th>
              <th className="p-2 text-right font-medium">W</th>
              <th className="p-2 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.player.id} className="border-b last:border-0">
                <td className="p-2 font-bold tabular-nums">{row.position}</td>
                <td className="p-2">
                  <Link
                    to={`/player/${encodeURIComponent(row.player.name)}`}
                    className="hover:text-primary flex items-center gap-2"
                  >
                    <PlayerAvatar
                      name={row.player.name}
                      color={row.player.color}
                      avatar={row.player.avatar}
                      size={24}
                    />
                    <span className="truncate font-medium">
                      {row.player.name}
                    </span>
                  </Link>
                </td>
                <td className="text-muted-foreground p-2 text-right tabular-nums">
                  {row.played}
                </td>
                <td className="p-2 text-right font-semibold tabular-nums">
                  {row.wins}
                </td>
                <td className="p-2 text-right font-bold tabular-nums">
                  {row.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">
        {LEAGUE_PRESET_LABELS[preset]} · P played · W wins
      </p>
    </section>
  )
}
