import { memo, useId } from 'react'

import { RARITY_STYLES } from '@/domain/stickers/rarity'
import type { Sticker } from '@/domain/stickers/types'
import { cn } from '@/lib/utils'

import { Motif } from './sticker-motifs'

interface StickerArtProps {
  sticker: Sticker
  /** Rendered pixel size (square). Ignored when `fluid`. */
  size?: number
  /** Fill the parent (which should be square) instead of a fixed size. */
  fluid?: boolean
  /** Locked stickers show as a flat silhouette behind a small lock. */
  locked?: boolean
  /** When set, the SVG is an accessible image; otherwise it's decorative. */
  title?: string
  className?: string
}

/**
 * A single die-cut collectible sticker: a white paper edge, a rarity-tinted
 * foil frame, a dark medallion, and the illustrated {@link Motif}. Higher
 * rarities gain a foil sheen and sparkles. Locked stickers flatten the motif to
 * a neutral silhouette (a true single colour, via a colour-matrix filter, so it
 * reads on either theme) with a small lock. Pure and memoised — a whole album
 * of these is cheap to render.
 */
export const StickerArt = memo(function StickerArt({
  sticker,
  size = 96,
  fluid = false,
  locked = false,
  title,
  className,
}: StickerArtProps) {
  const uid = useId()
  const frameId = `frame-${uid}`
  const discId = `disc-${uid}`
  const silId = `sil-${uid}`
  const style = RARITY_STYLES[sticker.rarity]
  const stops = style.frame

  const a11y = title
    ? { role: 'img' as const, 'aria-label': title }
    : { 'aria-hidden': true }

  return (
    <svg
      viewBox="0 0 100 100"
      width={fluid ? '100%' : size}
      height={fluid ? '100%' : size}
      className={cn('inline-block', locked && 'opacity-95', className)}
      style={
        locked
          ? undefined
          : { filter: `drop-shadow(0 2px 3px ${style.glow}55)` }
      }
      {...a11y}
    >
      <defs>
        <linearGradient id={frameId} x1="0" y1="0" x2="1" y2="1">
          {stops.map((c, i) => (
            <stop
              key={i}
              offset={`${(i / (stops.length - 1)) * 100}%`}
              stopColor={c}
            />
          ))}
        </linearGradient>
        <radialGradient id={discId} cx="42%" cy="38%" r="75%">
          <stop offset="0%" stopColor="#3b4761" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
        {/* Flatten any motif to a flat slate silhouette for locked stickers. */}
        <filter id={silId} colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.392 0 0 0 0 0.455 0 0 0 0 0.545 0 0 0 1 0"
          />
        </filter>
      </defs>

      {/* White die-cut paper edge. */}
      <rect x="3" y="3" width="94" height="94" rx="27" fill="#ffffff" />

      {/* Foil frame. */}
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        rx="24"
        fill={locked ? '#e5e7eb' : `url(#${frameId})`}
      />

      {/* Dark medallion the motif sits on. */}
      <circle
        cx="50"
        cy="50"
        r="31"
        fill={locked ? '#eef2f7' : `url(#${discId})`}
      />

      {locked ? (
        <g filter={`url(#${silId})`} opacity={0.5}>
          <Motif art={sticker.art} />
        </g>
      ) : (
        <Motif art={sticker.art} />
      )}

      {/* Soft top gloss on the medallion. */}
      {!locked && (
        <path
          d="M26 40 A31 31 0 0 1 74 34 A34 34 0 0 0 26 46 Z"
          fill="#ffffff"
          opacity={0.12}
        />
      )}

      {/* Foil sheen + sparkles for the rarer tiers. */}
      {!locked && style.foil && (
        <>
          <path
            d="M20 12 L34 12 L60 88 L46 88 Z"
            fill="#ffffff"
            opacity={0.1}
          />
          <path
            d="M6 40 L6 24 A18 18 0 0 1 24 6 L40 6 Z"
            fill="#ffffff"
            opacity={0.08}
          />
          <path
            d="M78 18 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z"
            fill="#ffffff"
            opacity={0.9}
          />
          {sticker.rarity !== 'epic' && (
            <path
              d="M22 74 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z"
              fill="#ffffff"
              opacity={0.8}
            />
          )}
        </>
      )}

      {/* Lock chip for locked stickers. */}
      {locked && (
        <g>
          <circle cx="74" cy="74" r="13" fill="#ffffff" />
          <circle
            cx="74"
            cy="74"
            r="13"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />
          <path
            d="M70 73 v-2 a4 4 0 0 1 8 0 v2"
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect x="68.5" y="72.5" width="11" height="9" rx="2" fill="#64748b" />
        </g>
      )}
    </svg>
  )
})
