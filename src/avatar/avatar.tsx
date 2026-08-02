import { memo, useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import type { AvatarConfig } from '@/domain/types'
import { cn } from '@/lib/utils'

import { normalizeAvatar } from './generate'
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

  // A stable-but-varied blink cadence so a table of avatars doesn't blink in
  // unison (cosmetic only, so deriving it from the config is fine).
  const blinkDelay = 2.4 + ((c.eyes + c.skinTone) % 5) * 0.7

  return (
    <motion.div
      role="img"
      aria-label={title ?? 'Player avatar'}
      className={cn('inline-block leading-none', className)}
      style={{ width: size, height: size }}
      animate={
        winner && !reduce
          ? { scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] }
          : { scale: selected ? 1.06 : 1 }
      }
      transition={
        winner && !reduce
          ? { duration: 0.7, repeat: Infinity, repeatDelay: 1.4 }
          : { type: 'spring', stiffness: 380, damping: 20 }
      }
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        aria-hidden
        shapeRendering="geometricPrecision"
      >
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

          {expression === 'bust' ? (
            <EyesBust />
          ) : (
            <motion.g
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              animate={doBlink ? { scaleY: [1, 1, 0.1, 1] } : undefined}
              transition={
                doBlink
                  ? {
                      duration: 0.22,
                      times: [0, 0.85, 0.92, 1],
                      repeat: Infinity,
                      repeatDelay: blinkDelay,
                    }
                  : undefined
              }
            >
              <Eyes variant={c.eyes} />
            </motion.g>
          )}

          {expression === 'bust' ? <MouthBust /> : <Mouth variant={c.mouth} />}
          <Glasses variant={c.glasses} />
          <Accessory variant={c.accessory} />
        </g>

        {crown && <Crown />}
      </svg>
    </motion.div>
  )
})
