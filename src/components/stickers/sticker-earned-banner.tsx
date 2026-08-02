import { Link } from 'react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Sticker } from '@/domain/stickers/types'

import { StickerArt } from './sticker-art'

/** Celebratory strip shown on the results screen when a game earns stickers. */
export function StickerEarnedBanner({ stickers }: { stickers: Sticker[] }) {
  const reduce = useReducedMotion()
  if (stickers.length === 0) return null

  const heading =
    stickers.length === 1
      ? 'New sticker unlocked!'
      : `${stickers.length} new stickers unlocked!`

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={reduce ? {} : { opacity: 1, y: 0 }}
      transition={
        reduce ? { duration: 0 } : { delay: 0.3, type: 'spring', bounce: 0.3 }
      }
      className="from-primary/10 to-accent/20 rounded-2xl border bg-gradient-to-br p-4"
    >
      <div className="flex items-center justify-center gap-2 text-center">
        <Sparkles className="text-primary size-4" aria-hidden />
        <h2 className="font-semibold">{heading}</h2>
      </div>

      <ul className="mt-3 flex flex-wrap items-start justify-center gap-3">
        {stickers.map((sticker, i) => (
          <motion.li
            key={sticker.id}
            initial={reduce ? false : { opacity: 0, scale: 0.4, rotate: -10 }}
            animate={reduce ? {} : { opacity: 1, scale: 1, rotate: 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    delay: 0.4 + Math.min(i, 6) * 0.12,
                    type: 'spring',
                    bounce: 0.55,
                  }
            }
            className="flex w-16 flex-col items-center gap-1"
          >
            <StickerArt sticker={sticker} size={64} title={sticker.name} />
            <span className="w-full truncate text-center text-[10px] font-medium">
              {sticker.name}
            </span>
          </motion.li>
        ))}
      </ul>

      <Button asChild variant="outline" size="sm" className="mt-3 w-full">
        <Link to="/album">View Sticker Book</Link>
      </Button>
    </motion.section>
  )
}
