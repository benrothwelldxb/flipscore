import { useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import {
  Check,
  Download,
  Lock,
  Palette,
  Share2,
  Sparkles,
  Swords,
  TrendingUp,
} from 'lucide-react'

import { EmptyState, LoadingState } from '@/components/common/screen-state'
import { PlayerAvatar } from '@/components/game/player-avatar'
import { CosmeticsEditor } from '@/components/legacy/cosmetics-editor'
import { CARD_H, CARD_W, LegacyCardSvg } from '@/components/legacy/legacy-card'
import { StickerArt } from '@/components/stickers/sticker-art'
import { PageHeader } from '@/components/layout/page-header'
import { StatTile } from '@/components/stats/charts'
import {
  FinishTimeline,
  FormGuide,
  VersusBar,
} from '@/components/stats/history-charts'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { colorByKey } from '@/domain/colors'
import { computePlayerHistory } from '@/domain/history'
import { computeLegacyCard } from '@/domain/legacy'
import { STICKERS } from '@/domain/stickers/catalog'
import { useToast } from '@/hooks/use-toast'
import {
  downloadImage,
  shareOrDownloadImage,
  svgToPngBlob,
} from '@/lib/share-image'
import { cn } from '@/lib/utils'
import { useAllGames, useHasHydrated } from '@/stores/game-store'
import { useNights, useNightsHydrated } from '@/stores/nights-store'
import { useProfile, useProfilesHydrated } from '@/stores/profile-store'
import { useStickersHydrated, useStickersStore } from '@/stores/stickers-store'

export function PlayerPage() {
  const { name: raw } = useParams()
  const name = raw ? decodeURIComponent(raw) : ''

  const hydrated = useHasHydrated()
  const stickersHydrated = useStickersHydrated()
  const nightsHydrated = useNightsHydrated()
  const profilesHydrated = useProfilesHydrated()

  const games = useAllGames()
  const nights = useNights()
  const unlocked = useStickersStore((s) => s.unlocked)
  const profile = useProfile(name)
  const [now] = useState(() => Date.now())
  const { toast } = useToast()

  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)

  const unlockedIds = useMemo(() => Object.keys(unlocked), [unlocked])
  const unlockedStickers = useMemo(
    () => STICKERS.filter((s) => unlocked[s.id]),
    [unlocked],
  )

  const history = useMemo(
    () => computePlayerHistory(games, name),
    [games, name],
  )
  const card = useMemo(
    () =>
      computeLegacyCard({
        games,
        nights,
        name,
        unlockedStickerIds: unlockedIds,
        totalStickers: STICKERS.length,
        profile,
        now,
        history,
      }),
    [games, nights, name, unlockedIds, profile, now, history],
  )

  async function exportCard(scale: number, mode: 'share' | 'save') {
    const svgEl = cardRef.current?.querySelector('svg')
    if (!svgEl) return
    setBusy(true)
    try {
      const svg = new XMLSerializer().serializeToString(svgEl)
      const blob = await svgToPngBlob(svg, CARD_W, CARD_H, scale)
      const slug = card.name.replace(/[^\w-]+/g, '_') || 'player'
      const filename = `${slug}-legacy-card.png`
      if (mode === 'share') {
        const how = await shareOrDownloadImage(blob, filename, {
          title: `${card.name} · FlipScorer`,
          text: `${card.name}'s FlipScorer Legacy Card`,
        })
        toast(how === 'shared' ? 'Shared' : 'Saved image')
      } else {
        downloadImage(blob, filename)
        toast('Saved image')
      }
    } catch {
      toast('Could not create the image')
    } finally {
      setBusy(false)
    }
  }

  if (!hydrated || !stickersHydrated || !nightsHydrated || !profilesHydrated) {
    return <LoadingState />
  }

  if (history.games === 0) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <PageHeader title={name || 'Player'} />
        <EmptyState
          title="No games yet"
          description={`${name || 'This player'} hasn't finished any games. Play a game to build their Legacy Card.`}
        />
      </div>
    )
  }

  const { bests } = history

  return (
    <div className="flex flex-col gap-6 py-4 pb-safe">
      <PageHeader title={history.name} />

      <div ref={cardRef} className="mx-auto w-full max-w-[360px]">
        <LegacyCardSvg card={card} />
      </div>

      <div className="mx-auto flex w-full max-w-[360px] flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-11">
                <Palette className="size-4" />
                Customise
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90svh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Customise Legacy Card</DialogTitle>
              </DialogHeader>
              <div className="mx-auto w-40">
                <LegacyCardSvg card={card} />
              </div>
              <CosmeticsEditor
                card={card}
                name={name}
                unlockedStickers={unlockedStickers}
              />
            </DialogContent>
          </Dialog>
          <Button
            className="h-11"
            disabled={busy}
            onClick={() => exportCard(3, 'share')}
          >
            <Share2 className="size-4" />
            {busy ? 'Rendering…' : 'Share'}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => exportCard(2, 'save')}
          >
            <Download className="size-4" />
            Save PNG
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => exportCard(4, 'save')}
          >
            <Download className="size-4" />
            Hi-res PNG
          </Button>
        </div>
        {card.favouriteSticker && (
          <div className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
            <span className="size-5">
              <StickerArt sticker={card.favouriteSticker} fluid />
            </span>
            Signature sticker: {card.favouriteSticker.name}
          </div>
        )}
      </div>

      {/* Level / XP */}
      <section className="bg-card rounded-2xl border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">
              Level {card.level.level}
              <span className="text-muted-foreground ml-2 text-sm font-medium">
                {card.rarity.label}
              </span>
            </p>
            <p className="text-muted-foreground text-xs">
              {card.level.xpForNext > 0
                ? `${card.level.xpForNext - card.level.xpIntoLevel} XP to level ${card.level.level + 1}`
                : 'Max level'}
            </p>
          </div>
          <p className="text-muted-foreground text-sm tabular-nums">
            {card.xp.total.toLocaleString()} XP
          </p>
        </div>
        <div className="bg-muted mt-3 h-2.5 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-500"
            style={{ width: `${Math.round(card.level.progress * 100)}%` }}
          />
        </div>
        <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {card.xp.lines.map((l) => (
            <span key={l.label}>
              {l.label} +{l.xp.toLocaleString()}
            </span>
          ))}
        </div>
      </section>

      {/* Career: personal bests */}
      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-semibold">
          Personal bests
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <StatTile value={bests.highestRound} label="Best round" />
          <StatTile value={bests.highestGameTotal} label="Best total" />
          <StatTile
            value={bests.bestFinish != null ? `#${bests.bestFinish}` : '—'}
            label="Best finish"
          />
          <StatTile value={bests.longestWinStreak} label="Win streak" />
          <StatTile value={bests.mostFlip7InGame} label="Flip 7 (game)" />
          <StatTile value={bests.largestWinMargin} label="Big win by" />
        </div>
      </section>

      {history.timeline.length >= 2 && (
        <section className="space-y-2">
          <h2 className="text-muted-foreground flex items-center gap-1.5 text-sm font-semibold">
            <TrendingUp className="size-4" aria-hidden />
            Finish timeline
          </h2>
          <div className="bg-card rounded-xl border p-3">
            <FinishTimeline
              data={history.timeline.map((t) => ({
                rank: t.rank,
                playerCount: t.playerCount,
                won: t.won,
              }))}
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-muted-foreground text-[11px]">
                Finishing position — higher is better
              </p>
              <FormGuide
                results={[...history.recentForm]
                  .reverse()
                  .map((t) => ({ won: t.won, rank: t.rank }))}
              />
            </div>
          </div>
        </section>
      )}

      {/* Milestones */}
      <section className="space-y-2">
        <h2 className="text-muted-foreground flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4" aria-hidden />
          Milestones
        </h2>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {history.milestones.map((m) => (
            <div
              key={m.label}
              className={cn(
                'flex items-center gap-2 rounded-lg border p-2.5 text-sm',
                m.reached ? 'bg-card' : 'bg-muted/40 text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full',
                  m.reached
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {m.reached ? (
                  <Check className="size-3.5" />
                ) : (
                  <Lock className="size-3" />
                )}
              </span>
              <span className="flex-1">{m.label}</span>
              {!m.reached && m.target != null && (
                <span className="text-xs tabular-nums">
                  {m.current ?? 0}/{m.target}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Rivalries */}
      {history.rivalries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-muted-foreground flex items-center gap-1.5 text-sm font-semibold">
            <Swords className="size-4" aria-hidden />
            Rivalries
          </h2>
          <div className="flex flex-col gap-2">
            {history.rivalries.map((r) => {
              const h = r.headToHead
              return (
                <div key={r.name} className="bg-card rounded-xl border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <PlayerAvatar name={r.name} color={r.color} size={28} />
                    <p className="flex-1 truncate text-sm font-semibold">
                      {history.name}{' '}
                      <span className="text-muted-foreground font-normal">
                        vs
                      </span>{' '}
                      {r.name}
                    </p>
                    <span className="text-muted-foreground text-xs">
                      {h.games} {h.games === 1 ? 'game' : 'games'}
                    </span>
                  </div>
                  <VersusBar
                    leftLabel="W"
                    left={h.aWins}
                    right={h.bWins}
                    rightLabel="W"
                    leftColor={colorByKey(history.color).hex}
                    rightColor={colorByKey(r.color).hex}
                  />
                  <div className="text-muted-foreground mt-2 flex justify-between text-[11px]">
                    <span>
                      Avg finish{' '}
                      {h.aAvgFinish != null ? h.aAvgFinish.toFixed(1) : '—'} vs{' '}
                      {h.bAvgFinish != null ? h.bAvgFinish.toFixed(1) : '—'}
                    </span>
                    {h.largestMargin && (
                      <span>
                        Biggest win: {h.largestMargin.leader} by{' '}
                        {h.largestMargin.value}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
