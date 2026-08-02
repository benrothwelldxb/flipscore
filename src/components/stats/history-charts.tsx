import { cn } from '@/lib/utils'

/** One recent result: a win, or a finishing position. */
export interface FormResult {
  won: boolean
  rank: number
}

/** A football-style form guide: a row of recent results, most recent last. */
export function FormGuide({
  results,
  className,
}: {
  results: FormResult[]
  className?: string
}) {
  if (results.length === 0) return null
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {results.map((r, i) => (
        <span
          key={i}
          aria-label={r.won ? 'Win' : `Finished ${r.rank}`}
          className={cn(
            'flex size-6 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
            r.won
              ? 'bg-emerald-500 text-white'
              : r.rank === 2
                ? 'bg-amber-400 text-amber-950'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {r.won ? 'W' : r.rank}
        </span>
      ))}
    </div>
  )
}

export interface TimelineDatum {
  rank: number
  playerCount: number
  won: boolean
}

/**
 * A finishing-position sparkline over time (oldest → newest). The y-axis is
 * inverted so 1st place sits at the top; winning games get a filled dot.
 */
export function FinishTimeline({
  data,
  className,
  height = 56,
}: {
  data: TimelineDatum[]
  className?: string
  height?: number
}) {
  if (data.length < 2) return null
  const W = 100
  const H = 40
  const pad = 4
  const maxRank = Math.max(...data.map((d) => d.playerCount), 2)

  const x = (i: number) => pad + (i / (data.length - 1)) * (W - pad * 2)
  // rank 1 → top (pad); rank maxRank → bottom.
  const y = (rank: number) =>
    pad + ((rank - 1) / Math.max(1, maxRank - 1)) * (H - pad * 2)

  const line = data
    .map(
      (d, i) =>
        `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)} ${y(d.rank).toFixed(2)}`,
    )
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn('w-full', className)}
      style={{ height }}
      role="img"
      aria-label="Finishing position over time"
      preserveAspectRatio="none"
    >
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(d.rank)}
          r={d.won ? 2.6 : 1.8}
          fill={d.won ? 'var(--primary)' : 'var(--card)'}
          stroke="var(--primary)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

/** A two-sided comparison bar (e.g. head-to-head wins). */
export function VersusBar({
  leftLabel,
  left,
  right,
  rightLabel,
  leftColor = 'var(--primary)',
  rightColor = 'var(--muted-foreground)',
}: {
  leftLabel: string
  left: number
  right: number
  rightLabel: string
  leftColor?: string
  rightColor?: string
}) {
  const total = left + right
  const leftPct = total > 0 ? (left / total) * 100 : 50
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium">
        <span className="tabular-nums">
          {left} <span className="text-muted-foreground">{leftLabel}</span>
        </span>
        <span className="tabular-nums">
          <span className="text-muted-foreground">{rightLabel}</span> {right}
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        <div style={{ width: `${leftPct}%`, backgroundColor: leftColor }} />
        <div
          style={{ width: `${100 - leftPct}%`, backgroundColor: rightColor }}
        />
      </div>
    </div>
  )
}
