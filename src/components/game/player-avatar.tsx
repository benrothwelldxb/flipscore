import { Avatar, type AvatarExpression } from '@/avatar'
import {
  colorByKey,
  initialsFromName,
  readableTextColor,
} from '@/domain/colors'
import type { AvatarConfig } from '@/domain/types'
import { cn } from '@/lib/utils'

interface PlayerAvatarProps {
  name: string
  color: string
  /** When present, renders the generated SVG avatar; otherwise an initials chip. */
  avatar?: AvatarConfig
  /** Rendered pixel size (square). */
  size?: number
  blink?: boolean
  crown?: boolean
  winner?: boolean
  expression?: AvatarExpression
  className?: string
}

/**
 * A player's badge: the generated SVG {@link Avatar} when the player has one,
 * with a coloured initials chip as a backward-compatible fallback. Both are
 * labelled with the player's name, so identity never relies on colour alone.
 */
export function PlayerAvatar({
  name,
  color,
  avatar,
  size = 36,
  blink,
  crown,
  winner,
  expression,
  className,
}: PlayerAvatarProps) {
  if (avatar) {
    return (
      <Avatar
        config={avatar}
        size={size}
        title={name}
        blink={blink}
        crown={crown}
        winner={winner}
        expression={expression}
        className={cn('shrink-0', className)}
      />
    )
  }

  const { hex } = colorByKey(color)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        backgroundColor: hex,
        color: readableTextColor(hex),
      }}
      aria-hidden
    >
      {initialsFromName(name)}
    </span>
  )
}
