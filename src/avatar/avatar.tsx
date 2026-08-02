import { memo, useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import type { AvatarConfig } from '@/domain/types'
import { cn } from '@/lib/utils'

import { normalizeAvatar } from '@/domain/avatar/generate'
import {
  Accessory,
  Background,
  Crown,
  Eyebrows,
  Eyes,
  EyesBust,
  Face,
  FacialHair,
  Glasses,
  Hair,
  Highlight,
  Mouth,
  MouthBust,
  Shadow,
  Shirt,
} from './parts'

export type AvatarExpression = 'default' | 'bust'

interface AvatarProps {
  config: AvatarConfig
  /** Rendered pixel size (square). */
  size?: number
  /** Occasional blink (disabled automatically under reduced-motion). */
  blink?: boolean
  /** Gentle scale-up, e.g. the current player. */
  selected?: boolean
  /** Celebratory wiggle for the winner. */
  winner?: boolean
  /** Leader crown overlay. */
  crown?: boolean
  /** Swap to a dizzy/dismayed face after a bust. */
  expression?: AvatarExpression
  /** Accessible label (usually the player's name). */
  title?: string
  className?: string
}

/**
 * A complete, deterministic SVG avatar composed from the feature parts. Pure
 * function of `config` (memoised), lightweight (flat shapes, no gradients or
 * raster), and self-contained (its own background circle) so it reads on any
 * theme. Animation is deliberately minimal and respects reduced-motion.
 */
export const Avatar = memo(function Avatar({
  config,
  size = 96,
  blink = false,
  selected = false,
  winner = false,
  crown = false,
  expression = 'default',
  title,
  className,
}: AvatarProps) {
  const c = useMemo(() => normalizeAvatar(config), [config])
  const clipId = useId()
  const reduce = useReducedMotion()
  const doBlink = blink && !reduce && expression === 'default'
  const animateRoot = !reduce && (winner || selected)

  // A stable-but-varied blink cadence so a table of avatars doesn't blink in
  // unison (cosmetic only, so deriving it from the config is fine).
  const blinkDelay = 2.4 + ((c.eyes + c.skinTone) % 5) * 0.7

  // Only pay for a framer-motion node when something actually animates — a
  // static leaderboard of avatars mounts plain <div>/<g> elements.
  const eyes =
    expression === 'bust' ? (
      <EyesBust />
    ) : doBlink ? (
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={{ scaleY: [1, 1, 0.1, 1] }}
        transition={{
          duration: 0.22,
          times: [0, 0.85, 0.92, 1],
          repeat: Infinity,
          repeatDelay: blinkDelay,
        }}
      >
        <Eyes variant={c.eyes} />
      </motion.g>
    ) : (
      <g>
        <Eyes variant={c.eyes} />
      </g>
    )

  const svg = (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>

      <Background colour={c.backgroundColour} />

      <g clipPath={`url(#${clipId})`}>
        <Shirt colour={c.shirtColour} />
        <Shadow />
        <Face tone={c.skinTone} shape={c.faceShape} />
        <Highlight />
        <FacialHair variant={c.facialHair} colour={c.hairColour} />
        <Hair variant={c.hairStyle} colour={c.hairColour} />
        <Eyebrows variant={c.eyebrows} />
        {eyes}
        {expression === 'bust' ? <MouthBust /> : <Mouth variant={c.mouth} />}
        <Glasses variant={c.glasses} />
        <Accessory variant={c.accessory} />
      </g>

      {crown && <Crown />}
    </svg>
  )

  const common = {
    role: 'img' as const,
    'aria-label': title ?? 'Player avatar',
    className: cn('inline-block leading-none', className),
    style: { width: size, height: size },
  }

  if (!animateRoot) return <div {...common}>{svg}</div>

  return (
    <motion.div
      {...common}
      animate={
        winner
          ? { scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] }
          : { scale: 1.06 }
      }
      transition={
        winner
          ? { duration: 0.7, repeat: Infinity, repeatDelay: 1.4 }
          : { type: 'spring', stiffness: 380, damping: 20 }
      }
    >
      {svg}
    </motion.div>
  )
})
