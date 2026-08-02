import { CalendarCheck, Lock } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CATEGORY_LABELS } from '@/domain/stickers/rarity'
import { progressOf } from '@/domain/stickers/evaluate'
import type { AchievementMetrics, Sticker } from '@/domain/stickers/types'

import { RarityPill } from './rarity-pill'
import { StickerArt } from './sticker-art'

interface StickerDetailProps {
  sticker: Sticker | null
  unlockedAt: number | null
  metrics: AchievementMetrics
  onOpenChange: (open: boolean) => void
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Full-size look at a sticker: how it was earned, or how to earn it. */
export function StickerDetail({
  sticker,
  unlockedAt,
  metrics,
  onOpenChange,
}: StickerDetailProps) {
  const unlocked = unlockedAt != null
  const progress = sticker ? progressOf(sticker, metrics) : null

  return (
    <Dialog open={sticker != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        {sticker && (
          <>
            <div className="flex flex-col items-center gap-3 pt-2">
              <StickerArt
                sticker={sticker}
                size={160}
                locked={!unlocked}
                title={unlocked ? sticker.name : `${sticker.name} (locked)`}
                className="drop-shadow-lg"
              />
              <DialogHeader className="items-center gap-1.5">
                <DialogTitle className="text-center text-xl">
                  {unlocked ? sticker.name : 'Locked sticker'}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <RarityPill rarity={sticker.rarity} />
                  <span className="text-muted-foreground text-[11px] font-medium">
                    {CATEGORY_LABELS[sticker.category]}
                  </span>
                </div>
              </DialogHeader>
            </div>

            <DialogDescription className="text-center text-sm">
              {sticker.achievement.hint}
            </DialogDescription>

            {unlocked ? (
              <div className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
                <CalendarCheck className="size-3.5" aria-hidden />
                Unlocked {formatDate(unlockedAt)}
              </div>
            ) : (
              progress && (
                <div className="space-y-1">
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full transition-[width]"
                      style={{ width: `${Math.round(progress.ratio * 100)}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-xs tabular-nums">
                    <Lock className="size-3" aria-hidden />
                    {progress.current} / {progress.target}
                  </p>
                </div>
              )
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
