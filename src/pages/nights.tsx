import { useNavigate } from 'react-router'
import { CalendarDays, MapPin, PartyPopper, Plus, Trophy } from 'lucide-react'

import { EmptyState, LoadingState } from '@/components/common/screen-state'
import { PlayerAvatar } from '@/components/game/player-avatar'
import { PageHeader } from '@/components/layout/page-header'
import { NightForm } from '@/components/nights/night-form'
import { Button } from '@/components/ui/button'
import { computeNightSummary } from '@/domain/game-night'
import type { GameNight } from '@/domain/types'
import { cn } from '@/lib/utils'
import { useAllGames, useHasHydrated } from '@/stores/game-store'
import {
  useNights,
  useNightsHydrated,
  useNightsStore,
} from '@/stores/nights-store'
import type { Game } from '@/domain/types'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function NightRow({
  night,
  games,
  onOpen,
}: {
  night: GameNight
  games: Game[]
  onOpen: () => void
}) {
  const played = games.filter(
    (g) => g.gameNightId === night.id && g.status === 'finished',
  ).length
  const finished = night.finishedAt != null
  const champion = finished ? computeNightSummary(night, games).champion : null

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="bg-card focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-xl border p-3 text-left outline-none focus-visible:ring-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{night.name}</p>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                finished
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary/15 text-primary',
              )}
            >
              {finished ? 'Complete' : 'In progress'}
            </span>
          </div>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3" aria-hidden />
              {formatDate(night.date)}
            </span>
            {night.venue && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" aria-hidden />
                {night.venue}
              </span>
            )}
            <span>
              · {played} {played === 1 ? 'game' : 'games'}
            </span>
          </p>
          {champion && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Trophy className="size-3" aria-hidden />
              {champion.player.name}
            </p>
          )}
        </div>
        <div className="flex -space-x-1.5">
          {night.players.slice(0, 5).map((p) => (
            <PlayerAvatar
              key={p.id}
              name={p.name}
              color={p.color}
              avatar={p.avatar}
              size={26}
              className="ring-card rounded-full ring-2"
            />
          ))}
        </div>
      </button>
    </li>
  )
}

export function NightsPage() {
  const navigate = useNavigate()
  const hydrated = useHasHydrated()
  const nightsHydrated = useNightsHydrated()
  const nights = useNights()
  const games = useAllGames()
  const createNight = useNightsStore((s) => s.createNight)

  if (!hydrated || !nightsHydrated) return <LoadingState />

  const sorted = [...nights].sort(
    (a, b) =>
      Number(a.finishedAt != null) - Number(b.finishedAt != null) ||
      b.date - a.date,
  )

  const createButton = (
    <NightForm
      title="New game night"
      submitLabel="Create"
      trigger={
        <Button size="lg" className="h-14 w-full text-base">
          <Plus className="size-5" />
          New game night
        </Button>
      }
      onSubmit={(values) => {
        const id = createNight(values)
        navigate(`/night/${id}`)
      }}
    />
  )

  return (
    <div className="flex flex-col gap-4 py-4 pb-safe">
      <PageHeader title="Game Nights" />

      <p className="text-muted-foreground -mt-1 text-sm">
        Group an evening of games, then crown a champion and hand out the
        awards.
      </p>

      {createButton}

      {sorted.length === 0 ? (
        <EmptyState
          icon={<PartyPopper className="size-10" />}
          title="No game nights yet"
          description="Create a game night for your Friday session, a birthday, or the holidays — every game you play in it counts towards the trophies."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((night) => (
            <NightRow
              key={night.id}
              night={night}
              games={games}
              onOpen={() => navigate(`/night/${night.id}`)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
