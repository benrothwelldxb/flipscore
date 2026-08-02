import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

export function StatTile({
  value,
  label,
  sub,
}: {
  value: ReactNode
  label: string
  sub?: string
}) {
  return (
    <div className="bg-card rounded-xl border p-3">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
      {sub && (
        <p className="text-muted-foreground/80 truncate text-[11px]">{sub}</p>
      )}
    </div>
  )
}

/** A donut ring showing a 0..1 fraction with the percentage in the centre. */
export function WinRing({
  pct,
  color,
  size = 84,
  stroke = 10,
}: {
  pct: number
  color?: string
  size?: number
  stroke?: number
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dash = circumference * Math.max(0, Math.min(1, pct))
  const center = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${Math.round(pct * 100)} percent win rate`}
      className="shrink-0"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={stroke}
      />
      <motion.circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color ?? 'var(--primary)'}
        strokeWidth={stroke}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
        initial={{ strokeDasharray: `0 ${circumference}` }}
        animate={{ strokeDasharray: `${dash} ${circumference - dash}` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-foreground text-base font-bold"
      >
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}

export function BarRow({
  label,
  value,
  max,
  color,
  suffix = '',
}: {
  label: string
  value: number
  max: number
  color?: string
  suffix?: string
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 truncate text-sm">{label}</span>
      <div className="bg-muted h-2.5 flex-1 overflow-hidden rounded-full">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color ?? 'var(--primary)' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
        {value}
        {suffix}
      </span>
    </div>
  )
}

export function RecordCard({
  icon,
  label,
  name,
  value,
  className,
}: {
  icon: ReactNode
  label: string
  name: string
  value: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-card flex items-center gap-3 rounded-xl border p-3',
        className,
      )}
    >
      <div className="text-primary shrink-0" aria-hidden>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="truncate font-semibold">{name}</p>
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
