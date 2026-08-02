import { memo, useId } from 'react'

import { AvatarSvg } from '@/avatar'
import { StickerArt } from '@/components/stickers/sticker-art'
import { generateAvatar } from '@/domain/avatar/generate'
import type { LegacyCard } from '@/domain/legacy'
import { cn } from '@/lib/utils'

export const CARD_W = 360
export const CARD_H = 644

const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
const INK = '#f8fafc'
const SUB = '#94a3b8'
/** Lighter sub-tone for the smallest (9px) labels, to hold AA contrast. */
const SUB2 = '#cbd5e1'

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

/** One featured numeric stat. */
function Stat({
  x,
  y,
  label,
  value,
  accent,
}: {
  x: number
  y: number
  label: string
  value: string
  accent: string
}) {
  return (
    <>
      <text
        x={x}
        y={y}
        fontFamily={FONT}
        fontSize={11}
        fontWeight={600}
        fill={SUB}
        letterSpacing={1}
      >
        {label}
      </text>
      <text
        x={x}
        y={y + 22}
        fontFamily={FONT}
        fontSize={22}
        fontWeight={800}
        fill={INK}
      >
        {value}
      </text>
      <rect
        x={x}
        y={y + 30}
        width={132}
        height={1}
        fill={accent}
        opacity={0.25}
      />
    </>
  )
}

/** A recent-form pip: a win, or a finishing position. */
function FormPip({ x, won, rank }: { x: number; won: boolean; rank: number }) {
  const fill = won ? '#10b981' : rank === 2 ? '#cbd5e1' : '#334155'
  const ink = won ? '#ffffff' : rank === 2 ? '#0f172a' : '#e2e8f0'
  return (
    <g>
      <rect x={x} y={0} width={30} height={30} rx={8} fill={fill} />
      <text
        x={x + 15}
        y={16}
        fontFamily={FONT}
        fontSize={15}
        fontWeight={800}
        fill={ink}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {won ? 'W' : rank}
      </text>
    </g>
  )
}

interface LegacyCardSvgProps {
  card: LegacyCard
  /** Responsive by default; the intrinsic size still serialises for export. */
  className?: string
}

/**
 * The Legacy Card as a single self-contained SVG — used both for the on-screen
 * profile and (serialised) for the shared PNG, so what you see is exactly what
 * you share. Concrete colours (no theme tokens) keep it looking identical in
 * light/dark and once rasterised. Memoised: a card only re-renders when its
 * derived data actually changes.
 */
export const LegacyCardSvg = memo(function LegacyCardSvg({
  card,
  className,
}: LegacyCardSvgProps) {
  const uid = useId()
  const frameId = `frame-${uid}`
  const bgId = `bg-${uid}`
  const glowId = `glow-${uid}`
  const avatar = card.avatar ?? generateAvatar(card.name)
  const { rarity, background, accent } = card

  // Level ring geometry.
  const ringR = 20
  const ringC = 2 * Math.PI * ringR
  const dash = ringC * Math.min(1, Math.max(0, card.level.progress))

  const titleW = Math.min(300, card.title.label.length * 11 + 32)
  const form = card.recentForm.slice(-6)
  const formW = form.length * 30 + (form.length - 1) * 6
  const formX = (CARD_W - formW) / 2

  const pinned = card.pinnedStickers.slice(0, 4)
  const showcaseCount = 4
  const chip = 46
  const gap = 12
  const showcaseW = showcaseCount * chip + (showcaseCount - 1) * gap
  const showcaseX = (CARD_W - showcaseW) / 2

  const favourites = [
    ['MODE', card.favouriteModeLabel],
    ['RIVAL', card.favouriteOpponent ? clip(card.favouriteOpponent, 10) : '—'],
    ['NIGHT', card.favouriteNight ? clip(card.favouriteNight, 12) : '—'],
  ]

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={CARD_W}
      height={CARD_H}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      className={cn('h-auto w-full max-w-[360px]', className)}
      role="img"
      aria-label={`${card.name} — ${rarity.label} Legacy Card, level ${card.level.level}`}
    >
      <defs>
        <linearGradient id={frameId} x1="0" y1="0" x2="1" y2="1">
          {rarity.frame.map((c, i) => (
            <stop
              key={i}
              offset={`${(i / (rarity.frame.length - 1)) * 100}%`}
              stopColor={c}
            />
          ))}
        </linearGradient>
        <linearGradient id={bgId} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor={background.from} />
          {background.via && <stop offset="55%" stopColor={background.via} />}
          <stop offset="100%" stopColor={background.to} />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity={0.55} />
          <stop offset="100%" stopColor={accent} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Metallic frame + card face. */}
      <rect
        x={0}
        y={0}
        width={CARD_W}
        height={CARD_H}
        rx={28}
        fill={`url(#${frameId})`}
      />
      <rect
        x={9}
        y={9}
        width={CARD_W - 18}
        height={CARD_H - 18}
        rx={20}
        fill={`url(#${bgId})`}
      />
      {/* Top gloss + optional holo sheen. */}
      <rect
        x={9}
        y={9}
        width={CARD_W - 18}
        height={140}
        rx={20}
        fill="#ffffff"
        opacity={0.05}
      />
      {rarity.foil && (
        <>
          <path
            d={`M40 9 L100 9 L60 ${CARD_H - 9} L9 ${CARD_H - 9} L9 320 Z`}
            fill="#ffffff"
            opacity={0.05}
          />
          <path
            d={`M${CARD_W - 120} 9 L${CARD_W - 60} 9 L${CARD_W - 9} 240 L${CARD_W - 9} 9 Z`}
            fill="#ffffff"
            opacity={0.06}
          />
        </>
      )}

      {/* Header: rarity, season, level ring. */}
      <text
        x={26}
        y={38}
        fontFamily={FONT}
        fontSize={15}
        fontWeight={800}
        fill={rarity.gem}
        letterSpacing={2}
      >
        {rarity.label.toUpperCase()}
      </text>
      <text
        x={26}
        y={56}
        fontFamily={FONT}
        fontSize={11}
        fontWeight={600}
        fill={SUB}
        letterSpacing={2}
      >
        {card.seasonLabel.toUpperCase()}
      </text>

      <g transform={`translate(${CARD_W - 46}, 46)`}>
        <circle r={ringR} fill="#0f172a" opacity={0.5} />
        <circle
          r={ringR}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.15}
          strokeWidth={4}
        />
        <circle
          r={ringR}
          fill="none"
          stroke={accent}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${ringC - dash}`}
          transform="rotate(-90)"
        />
        <text
          x={0}
          y={-3}
          fontFamily={FONT}
          fontSize={9}
          fontWeight={700}
          fill={SUB2}
          textAnchor="middle"
        >
          LV
        </text>
        <text
          x={0}
          y={11}
          fontFamily={FONT}
          fontSize={16}
          fontWeight={800}
          fill={INK}
          textAnchor="middle"
        >
          {card.level.level}
        </text>
      </g>

      {/* Avatar with accent glow ring. */}
      <circle cx={CARD_W / 2} cy={150} r={78} fill={`url(#${glowId})`} />
      <circle cx={CARD_W / 2} cy={150} r={62} fill="#0f172a" />
      <circle
        cx={CARD_W / 2}
        cy={150}
        r={62}
        fill="none"
        stroke={accent}
        strokeWidth={4}
      />
      <AvatarSvg config={avatar} size={116} x={CARD_W / 2 - 58} y={92} />

      {/* Identity. */}
      <text
        x={CARD_W / 2}
        y={244}
        fontFamily={FONT}
        fontSize={30}
        fontWeight={800}
        fill={INK}
        textAnchor="middle"
      >
        {clip(card.name, 16)}
      </text>
      <rect
        x={(CARD_W - titleW) / 2}
        y={258}
        width={titleW}
        height={26}
        rx={13}
        fill={accent}
        opacity={0.18}
      />
      <text
        x={CARD_W / 2}
        y={276}
        fontFamily={FONT}
        fontSize={14}
        fontWeight={700}
        fill={accent}
        textAnchor="middle"
      >
        {clip(card.title.label, 24)}
      </text>

      {/* Recent form. */}
      <g transform={`translate(${formX}, 300)`}>
        {form.map((f, i) => (
          <FormPip key={i} x={i * 36} won={f.won} rank={f.rank} />
        ))}
      </g>

      {/* Featured stats. */}
      <g transform="translate(0, 356)">
        <Stat
          x={26}
          y={0}
          label="WINS"
          value={String(card.stats.wins)}
          accent={accent}
        />
        <Stat
          x={202}
          y={0}
          label="WIN %"
          value={`${Math.round(card.stats.winPct * 100)}%`}
          accent={accent}
        />
        <Stat
          x={26}
          y={52}
          label="GAMES"
          value={String(card.stats.gamesPlayed)}
          accent={accent}
        />
        <Stat
          x={202}
          y={52}
          label="HIGH ROUND"
          value={String(card.stats.highestRound)}
          accent={accent}
        />
        <Stat
          x={26}
          y={104}
          label="WIN STREAK"
          value={String(card.stats.longestWinStreak)}
          accent={accent}
        />
        <Stat
          x={202}
          y={104}
          label="BEST COMEBACK"
          value={String(card.stats.bestComeback)}
          accent={accent}
        />
      </g>

      {/* Showcase stickers. */}
      <text
        x={26}
        y={500}
        fontFamily={FONT}
        fontSize={11}
        fontWeight={600}
        fill={SUB}
        letterSpacing={1}
      >
        SHOWCASE
      </text>
      <text
        x={CARD_W - 26}
        y={500}
        fontFamily={FONT}
        fontSize={11}
        fontWeight={700}
        fill={rarity.gem}
        textAnchor="end"
      >
        {card.stickerCount} STICKERS
      </text>
      {Array.from({ length: showcaseCount }).map((_, i) => {
        const x = showcaseX + i * (chip + gap)
        const sticker = pinned[i]
        return sticker ? (
          <svg key={i} x={x} y={510} width={chip} height={chip}>
            <StickerArt sticker={sticker} fluid />
          </svg>
        ) : (
          <rect
            key={i}
            x={x}
            y={510}
            width={chip}
            height={chip}
            rx={12}
            fill="#ffffff"
            fillOpacity={0.04}
            stroke="#ffffff"
            strokeOpacity={0.12}
            strokeDasharray="4 4"
          />
        )
      })}

      {/* Favourites strip. */}
      <g transform="translate(0, 586)">
        {favourites.map(([label, value], i) => {
          const x = 26 + i * 106
          return (
            <g key={label}>
              <text
                x={x}
                y={0}
                fontFamily={FONT}
                fontSize={9}
                fontWeight={700}
                fill={SUB2}
                letterSpacing={1}
              >
                {label}
              </text>
              <text
                x={x}
                y={16}
                fontFamily={FONT}
                fontSize={13}
                fontWeight={700}
                fill={INK}
              >
                {value}
              </text>
            </g>
          )
        })}
      </g>

      {/* Footer wordmark. */}
      <text
        x={CARD_W / 2}
        y={CARD_H - 12}
        fontFamily={FONT}
        fontSize={11}
        fontWeight={700}
        fill={SUB}
        textAnchor="middle"
        letterSpacing={2}
      >
        FLIPSCORER
      </text>
    </svg>
  )
})
