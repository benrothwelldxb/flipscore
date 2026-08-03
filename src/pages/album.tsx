import { useEffect, useMemo, useState } from 'react'

import { LoadingState } from '@/components/common/screen-state'
import { PageHeader } from '@/components/layout/page-header'
import { RarityPill } from '@/components/stickers/rarity-pill'
import { StickerCard } from '@/components/stickers/sticker-card'
import { StickerDetail } from '@/components/stickers/sticker-detail'
import { playerNameOptions } from '@/domain/social'
import { STICKERS } from '@/domain/stickers/catalog'
import { computeAchievementMetrics } from '@/domain/stickers/metrics'
import { CATEGORY_BLURBS, CATEGORY_LABELS } from '@/domain/stickers/rarity'
import { CATEGORIES, RARITIES, type Sticker } from '@/domain/stickers/types'
import { cn } from '@/lib/utils'
import { useAllGames, useHasHydrated } from '@/stores/game-store'
import { useIdentityStore, useMyName } from '@/stores/identity-store'
import {
  useCollectionProgress,
  useNewStickerIds,
  useStickersHydrated,
  useStickersStore,
} from '@/stores/stickers-store'

export function AlbumPage() {
  const gamesHydrated = useHasHydrated()
  const stickersHydrated = useStickersHydrated()
  const games = useAllGames()
  const myName = useMyName()
  const metrics = useMemo(
    () => computeAchievementMetrics(games, myName),
    [games, myName],
  )
  const nameOptions = useMemo(() => playerNameOptions(games), [games])

  const unlocked = useStickersStore((s) => s.unlocked)
  const progress = useCollectionProgress()
  // Unlocked-but-unseen stickers get a NEW ribbon + entrance this visit; they
  // are marked seen on the way out (below), so the flag clears next time.
  const newStickerIds = useNewStickerIds()
  const newIds = useMemo(() => new Set(newStickerIds), [newStickerIds])

  const [selected, setSelected] = useState<Sticker | null>(null)

  // Grant any retroactive unlocks (e.g. after an import), then mark everything
  // seen when leaving so freshly-earned stickers only celebrate once.
  useEffect(() => {
    if (!gamesHydrated || !stickersHydrated) return
    useStickersStore
      .getState()
      .reconcile(computeAchievementMetrics(games, myName))
    return () => useStickersStore.getState().acknowledgeAll()
    // Run once on mount; games at mount are what matter for the reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamesHydrated, stickersHydrated])

  // Switching who "you" are rebuilds the album to that player's achievements.
  function chooseMe(name: string) {
    useIdentityStore.getState().setName(name)
    useStickersStore.getState().rebuild(computeAchievementMetrics(games, name))
  }

  if (!gamesHydrated || !stickersHydrated) return <LoadingState />

  const pct = Math.round((progress.unlocked / progress.total) * 100)

  return (
    <div className="flex flex-col gap-6 py-4 pb-safe">
      <PageHeader title="Sticker Book" />

      <section className="from-primary/10 to-accent/20 rounded-2xl border bg-gradient-to-br p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold tabular-nums">
              {progress.unlocked}
              <span className="text-muted-foreground text-lg font-semibold">
                {' '}
                / {progress.total}
              </span>
            </p>
            <p className="text-muted-foreground text-xs">stickers collected</p>
          </div>
          <p className="text-2xl font-bold tabular-nums">{pct}%</p>
        </div>
        <div
          className="bg-muted mt-3 h-2.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={progress.unlocked}
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-label="Stickers collected"
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {RARITIES.map((r) => (
            <RarityPill key={r} rarity={r} />
          ))}
        </div>
      </section>

      {nameOptions.length > 1 && (
        <section aria-label="Whose achievements">
          <p className="text-muted-foreground mb-2 text-xs">
            Showing achievements for{' '}
            <span className="text-foreground font-medium">
              {myName ?? 'you'}
            </span>
            . Tap to switch.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {nameOptions.map((name) => {
              const active = name === myName
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => chooseMe(name)}
                  aria-pressed={active}
                  className={cn(
                    'focus-visible:ring-ring/50 rounded-full border px-3 py-1 text-sm outline-none transition focus-visible:ring-2',
                    active
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {CATEGORIES.map((category) => {
        const stickers = STICKERS.filter((s) => s.category === category)
        const got = stickers.filter((s) => unlocked[s.id]).length
        return (
          <section key={category} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{CATEGORY_LABELS[category]}</h2>
              <span className="text-muted-foreground text-xs tabular-nums">
                {got}/{stickers.length}
              </span>
            </div>
            <p className="text-muted-foreground -mt-1 text-xs">
              {CATEGORY_BLURBS[category]}
            </p>
            <div className="bg-card/60 grid grid-cols-3 gap-2 rounded-2xl border p-3 sm:grid-cols-4">
              {stickers.map((sticker, i) => (
                <StickerCard
                  key={sticker.id}
                  sticker={sticker}
                  unlocked={!!unlocked[sticker.id]}
                  isNew={newIds.has(sticker.id)}
                  index={i}
                  onSelect={setSelected}
                />
              ))}
            </div>
          </section>
        )
      })}

      <StickerDetail
        sticker={selected}
        unlockedAt={
          selected ? (unlocked[selected.id]?.unlockedAt ?? null) : null
        }
        metrics={metrics}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  )
}
