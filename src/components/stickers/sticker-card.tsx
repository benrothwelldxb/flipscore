import { motion, useReducedMotion } from 'framer-motion'

import { RARITY_STYLES } from '@/domain/stickers/rarity'
import type { Sticker } from '@/domain/stickers/types'
import { cn } from '@/lib/utils'

import { StickerArt } from './sticker-art'

interface StickerCardProps {
  sticker: Sticker
  unlocked: boolean
  /** Freshly unlocked (unseen) — pops in and shows a NEW ribbon. */
  isNew?: boolean
  /** Stagger index for the entrance animation. */
  index?: number
  onSelect: (sticker: Sticker) => void
}

/** One slot in the album: the sticker (or its silhouette) plus its name. */
export function StickerCard({
  sticker,
  unlocked,
  isNew = false,
  index = 0,
  onSelect,
}: StickerCardProps) {
  const reduce = useReducedMotion()
  const style = RARITY_STYLES[sticker.rarity]
  const animate = isNew && !reduce

  const label = unlocked
    ? `${sticker.name}. ${style.label}. Unlocked.`
    : `Locked sticker. ${style.label}. ${sticker.achievement.hint}`

  const inner = (
    <button
      type="button"
      onClick={() => onSelect(sticker)}
      aria-label={label}
      className="group focus-visible:ring-ring flex w-full flex-col items-center gap-1 rounded-xl p-1 outline-none focus-visible:ring-2"
    >
      <div className="relative w-full">
        <div className="aspect-square w-full transition-transform group-hover:scale-105 group-active:scale-95">
          <StickerArt sticker={sticker} fluid locked={!unlocked} />
        </div>
        {isNew && (
          <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold shadow">
            NEW
          </span>
        )}
      </div>
      <span
        className={cn(
          'w-full truncate text-center text-[11px] font-medium',
          unlocked ? 'text-foreground' : 'text-muted-foreground/70',
        )}
      >
        {sticker.name}
      </span>
    </button>
  )

  if (!animate) return inner

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4, rotate: -8 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{
        type: 'spring',
        bounce: 0.5,
        duration: 0.6,
        delay: Math.min(index, 8) * 0.06,
      }}
    >
      {inner}
    </motion.div>
  )
}
