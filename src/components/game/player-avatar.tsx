import {
  colorByKey,
  initialsFromName,
  readableTextColor,
} from '@/domain/colors'
import { cn } from '@/lib/utils'

interface PlayerAvatarProps {
  name: string
  color: string
  className?: string
}

/** A round initials chip in the player's colour. Decorative — pair with the
    player's name for screen-reader users. */
export function PlayerAvatar({ name, color, className }: PlayerAvatarProps) {
  const { hex } = colorByKey(color)
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
        className,
      )}
      style={{ backgroundColor: hex, color: readableTextColor(hex) }}
      aria-hidden
    >
      {initialsFromName(name)}
    </span>
  )
}
