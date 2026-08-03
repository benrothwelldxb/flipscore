import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'

import { colorByKey } from '@/domain/colors'
import { estimateWinChances } from '@/domain/tension'
import type { Game } from '@/domain/types'
import { useWinChanceEnabled } from '@/stores/prefs-store'

/**
 * An opt-in live "win chance" estimate shown under the leaderboard during play.
 * Games are immutable (a mutation yields a new object), so `game` identity is a
 * perfect memo key — the Monte-Carlo only re-runs when the state actually moves.
 * Deliberately framed as an estimate; it models how rounds tend to go, not the
 * real deck.
 */
export function WinChanceStrip({ game }: { game: Game }) {
  const enabled = useWinChanceEnabled()

  const estimate = useMemo(
    () =>
      enabled && game.status === 'playing' ? estimateWinChances(game) : null,
    [game, enabled],
  )

  if (!estimate || game.players.length < 2 || estimate.basis === 'decided') {
    return null
  }

  // Only players with a non-trivial chance get a labelled row; the bar shows all.
  const ranked = estimate.chances
  const pct = (p: number) => Math.round(p * 100)

  return (
    <section
      aria-label="Win chance estimate"
      className="bg-card space-y-2 rounded-xl border p-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
          <Sparkles className="size-3.5" aria-hidden />
          Win chance
        </h3>
        <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
          Estimate
        </span>
      </div>

      <div
        className="bg-muted flex h-2.5 w-full overflow-hidden rounded-full"
        role="presentation"
      >
        {ranked.map((c) =>
          c.probability > 0 ? (
            <span
              key={c.playerId}
              className="h-full"
              style={{
                width: `${c.probability * 100}%`,
                backgroundColor: colorByKey(c.color).hex,
              }}
            />
          ) : null,
        )}
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {ranked
          .filter((c) => c.probability >= 0.01)
          .map((c) => (
            <li key={c.playerId} className="flex items-center gap-1.5 text-xs">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: colorByKey(c.color).hex }}
                aria-hidden
              />
              <span className="truncate font-medium">{c.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {pct(c.probability)}%
              </span>
            </li>
          ))}
      </ul>
    </section>
  )
}
