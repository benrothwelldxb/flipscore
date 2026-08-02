import { RARITY_STYLES } from '@/domain/stickers/rarity'
import type { Rarity } from '@/domain/stickers/types'
import { cn } from '@/lib/utils'

/** A small tinted chip naming a rarity tier. */
export function RarityPill({
  rarity,
  className,
}: {
  rarity: Rarity
  className?: string
}) {
  const style = RARITY_STYLES[rarity]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        className,
      )}
      style={{ backgroundColor: `${style.glow}22`, color: style.glow }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: style.glow }}
        aria-hidden
      />
      {style.label}
    </span>
  )
}
