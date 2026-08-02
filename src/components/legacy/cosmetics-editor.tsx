import { Check, Lock } from 'lucide-react'

import { StickerArt } from '@/components/stickers/sticker-art'
import { PLAYER_COLORS } from '@/domain/colors'
import { BACKGROUNDS, TITLES } from '@/domain/cosmetics'
import type { LegacyCard } from '@/domain/legacy'
import type { Sticker } from '@/domain/stickers/types'
import { cn } from '@/lib/utils'
import { useProfile, useProfileStore } from '@/stores/profile-store'

interface CosmeticsEditorProps {
  card: LegacyCard
  name: string
  /** All stickers unlocked in the collection (choices for the showcase). */
  unlockedStickers: Sticker[]
}

/** Live cosmetic controls — every change updates the previewed card at once. */
export function CosmeticsEditor({
  card,
  name,
  unlockedStickers,
}: CosmeticsEditorProps) {
  const profile = useProfile(name)
  const setTitle = useProfileStore((s) => s.setTitle)
  const setBackground = useProfileStore((s) => s.setBackground)
  const setAccent = useProfileStore((s) => s.setAccent)
  const togglePin = useProfileStore((s) => s.togglePin)

  const unlockedTitleIds = new Set(card.unlockedTitles.map((t) => t.id))
  const unlockedBgIds = new Set(card.unlockedBackgrounds.map((b) => b.id))
  const pinned = new Set(profile.pinnedStickerIds ?? [])

  return (
    <div className="flex flex-col gap-5">
      {/* Titles */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Title</h3>
        <div className="flex flex-wrap gap-1.5">
          {TITLES.map((t) => {
            const unlocked = unlockedTitleIds.has(t.id)
            const equipped = card.title.id === t.id
            return (
              <button
                key={t.id}
                type="button"
                aria-disabled={!unlocked}
                aria-pressed={equipped}
                aria-label={
                  unlocked ? t.label : `${t.label} — locked: ${t.hint}`
                }
                onClick={() => unlocked && setTitle(name, t.id)}
                className={cn(
                  'focus-visible:ring-ring flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition focus-visible:ring-2',
                  equipped
                    ? 'border-primary bg-primary/15 text-primary'
                    : unlocked
                      ? 'bg-card hover:bg-accent/40'
                      : 'text-muted-foreground/60 cursor-not-allowed opacity-70',
                )}
              >
                {!unlocked && <Lock className="size-3" aria-hidden />}
                {t.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Backgrounds */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Background</h3>
        <div className="grid grid-cols-4 gap-2">
          {BACKGROUNDS.map((b) => {
            const unlocked = unlockedBgIds.has(b.id)
            const equipped = card.background.id === b.id
            return (
              <button
                key={b.id}
                type="button"
                aria-disabled={!unlocked}
                aria-pressed={equipped}
                onClick={() => unlocked && setBackground(name, b.id)}
                aria-label={`${b.label}${unlocked ? '' : ` — locked, unlocks at level ${b.unlockLevel}`}`}
                className={cn(
                  'focus-visible:ring-ring relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border-2 outline-none transition focus-visible:ring-2',
                  equipped ? 'border-primary' : 'border-transparent',
                )}
                style={{
                  backgroundImage: `linear-gradient(135deg, ${b.from}, ${b.via ?? b.to}, ${b.to})`,
                }}
              >
                {equipped && (
                  <Check
                    className="size-4 text-white drop-shadow"
                    aria-hidden
                  />
                )}
                {!unlocked && (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/55 text-[10px] font-semibold text-white">
                    <Lock className="size-3" aria-hidden />
                    Lv {b.unlockLevel}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* Accent colour */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Accent colour</h3>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setAccent(name, undefined)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium',
              profile.accentColor == null
                ? 'border-primary bg-primary/15 text-primary'
                : 'bg-card',
            )}
          >
            Default
          </button>
          {PLAYER_COLORS.map((c) => {
            const selected = profile.accentColor === c.hex
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setAccent(name, c.hex)}
                aria-label={c.label}
                aria-pressed={selected}
                className={cn(
                  'size-8 rounded-full border border-black/10 transition',
                  selected &&
                    'ring-foreground ring-offset-background ring-2 ring-offset-2',
                )}
                style={{ backgroundColor: c.hex }}
              />
            )
          })}
        </div>
      </section>

      {/* Showcase stickers */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Showcase stickers</h3>
          <span className="text-muted-foreground text-xs">
            {pinned.size}/4 pinned
          </span>
        </div>
        {unlockedStickers.length === 0 ? (
          <p className="text-muted-foreground bg-muted/40 rounded-lg border p-3 text-center text-xs">
            Unlock stickers in the Sticker Book to pin them here.
          </p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {unlockedStickers.map((s) => {
              const isPinned = pinned.has(s.id)
              const full = pinned.size >= 4 && !isPinned
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={full}
                  onClick={() => togglePin(name, s.id)}
                  aria-pressed={isPinned}
                  aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${s.name}`}
                  className={cn(
                    'relative aspect-square rounded-lg transition',
                    isPinned && 'ring-primary ring-2',
                    full && 'opacity-40',
                  )}
                >
                  <StickerArt sticker={s} fluid />
                  {isPinned && (
                    <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
