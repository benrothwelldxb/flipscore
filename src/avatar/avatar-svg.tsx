import { memo, useId, useMemo } from 'react'

import { normalizeAvatar } from '@/domain/avatar/generate'
import type { AvatarConfig } from '@/domain/types'

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

interface AvatarSvgProps {
  config: AvatarConfig
  /** Rendered size (square). */
  size?: number
  /** Offset — set when nesting inside another SVG. */
  x?: number
  y?: number
  crown?: boolean
  expression?: 'default' | 'bust'
}

/**
 * The avatar as a *pure, static* SVG element (no wrapper div, no animation), so
 * it can be nested inside another SVG — e.g. the Legacy Card — and serialised
 * to a PNG. Same feature parts as the interactive {@link Avatar}; memoised.
 */
export const AvatarSvg = memo(function AvatarSvg({
  config,
  size = 100,
  x = 0,
  y = 0,
  crown = false,
  expression = 'default',
}: AvatarSvgProps) {
  const c = useMemo(() => normalizeAvatar(config), [config])
  const clipId = useId()

  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
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
        {expression === 'bust' ? <EyesBust /> : <Eyes variant={c.eyes} />}
        {expression === 'bust' ? <MouthBust /> : <Mouth variant={c.mouth} />}
        <Glasses variant={c.glasses} />
        <Accessory variant={c.accessory} />
      </g>
      {crown && <Crown />}
    </svg>
  )
})
