import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import {
  CalendarDays,
  ChevronRight,
  Flag,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react'

import { LoadingState } from '@/components/common/screen-state'
import { PlayerAvatar } from '@/components/game/player-avatar'
import { PlayerEditor } from '@/components/game/player-editor'
import { PageHeader } from '@/components/layout/page-header'
import { LeagueTable } from '@/components/nights/league-table'
import { NightForm } from '@/components/nights/night-form'
import { NightSummary } from '@/components/nights/night-summary'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { computeNightSummary } from '@/domain/game-night'
import { createPlayer } from '@/domain/game'
import {
  buildNightShareSvg,
  SHARE_HEIGHT,
  SHARE_WIDTH,
} from '@/domain/night-share-card'
import { PLAYER_LIMITS, type AvatarConfig, type Player } from '@/domain/types'
import { useToast } from '@/hooks/use-toast'
import { shareOrDownloadImage, svgToPngBlob } from '@/lib/share-image'
import {
  useGameStore,
  useHasHydrated,
  useNightGames,
} from '@/stores/game-store'
import {
  useNight,
  useNightsHydrated,
  useNightsStore,
} from '@/stores/nights-store'
import { useSavedPlayers } from '@/stores/roster-store'

function statusLabel(status: string): string {
  if (status === 'finished') return 'Final'
  if (status === 'playing') return 'Playing'
  return 'Setup'
}

export function NightPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const hydrated = useHasHydrated()
  const nightsHydrated = useNightsHydrated()
  const night = useNight(id)
  const games = useNightGames(id)
  const { toast } = useToast()

  const savedPlayers = useSavedPlayers()
  const updateNight = useNightsStore((s) => s.updateNight)
  const finishNight = useNightsStore((s) => s.finishNight)
  const reopenNight = useNightsStore((s) => s.reopenNight)
  const deleteNight = useNightsStore((s) => s.deleteNight)

  const [sharing, setSharing] = useState(false)

  const summary = useMemo(
    () => (night ? computeNightSummary(night, games) : null),
    [night, games],
  )

  if (!hydrated || !nightsHydrated) return <LoadingState />
  if (!night) return <Navigate to="/nights" replace />

  const finished = night.finishedAt != null
  const roster = night.players
  const orderedGames = [...games].sort((a, b) => a.createdAt - b.createdAt)
  const playedCount = games.filter((g) => g.status === 'finished').length

  function setRoster(players: Player[]) {
    updateNight(night!.id, {
      players: players.map((p, index) => ({ ...p, order: index })),
    })
  }

  function addPlayer(seed?: {
    name: string
    color: string
    avatar?: AvatarConfig
  }) {
    const base = createPlayer(roster.length, seed?.name)
    const player: Player = seed
      ? { ...base, color: seed.color, avatar: seed.avatar ?? base.avatar }
      : base
    setRoster([...roster, player])
  }

  function newGame() {
    if (roster.length < PLAYER_LIMITS.min) {
      toast('Add at least two players first')
      return
    }
    const gid = useGameStore.getState().createGameInNight(night!.id, roster)
    navigate(`/game/${gid}`)
  }

  async function share() {
    if (!summary) return
    setSharing(true)
    try {
      const svg = buildNightShareSvg(summary)
      const blob = await svgToPngBlob(svg, SHARE_WIDTH, SHARE_HEIGHT)
      const how = await shareOrDownloadImage(
        blob,
        `${night!.name}-flipscorer.png`,
        {
          title: night!.name,
          text: `${night!.name} — FlipScorer results`,
        },
      )
      toast(how === 'shared' ? 'Shared' : 'Saved image')
    } catch {
      toast('Could not create the image')
    } finally {
      setSharing(false)
    }
  }

  const takenNames = new Set(roster.map((p) => p.name.trim().toLowerCase()))
  const quickAdd = savedPlayers.filter(
    (p) => !takenNames.has(p.name.trim().toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-6 py-4 pb-safe">
      <PageHeader title={night.name}>
        <NightForm
          title="Edit game night"
          submitLabel="Save"
          initial={{
            name: night.name,
            venue: night.venue ?? '',
            date: night.date,
            notes: night.notes ?? '',
          }}
          onSubmit={(values) => updateNight(night.id, values)}
          trigger={
            <Button variant="ghost" size="icon" aria-label="Edit game night">
              <Pencil className="size-5" />
            </Button>
          }
        />
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete game night"
              className="text-destructive"
            >
              <Trash2 className="size-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this game night?</DialogTitle>
              <DialogDescription>
                The night is removed. The individual games stay in your archive.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Keep</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteNight(night.id)
                    navigate('/nights')
                  }}
                >
                  Delete
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="text-muted-foreground -mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1">
          <CalendarDays className="size-4" aria-hidden />
          {new Date(night.date).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </span>
        {night.venue && (
          <span className="flex items-center gap-1">
            <MapPin className="size-4" aria-hidden />
            {night.venue}
          </span>
        )}
      </div>
      {night.notes && <p className="-mt-3 text-sm">{night.notes}</p>}

      {finished ? (
        <>
          <div className="flex items-center justify-between rounded-xl border bg-emerald-500/10 px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <Trophy className="size-4" aria-hidden />
              Night complete
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => reopenNight(night.id)}
            >
              <RotateCcw className="size-4" />
              Reopen
            </Button>
          </div>
          {summary && (
            <NightSummary summary={summary} onShare={share} sharing={sharing} />
          )}
          <LeagueTable games={games} roster={roster} />
        </>
      ) : (
        <>
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Users className="size-4" aria-hidden />
                Roster
              </h2>
              <span className="text-muted-foreground text-xs">
                {roster.length}/{PLAYER_LIMITS.max}
              </span>
            </div>
            <PlayerEditor
              players={roster}
              onRename={(pid, name) =>
                setRoster(
                  roster.map((p) => (p.id === pid ? { ...p, name } : p)),
                )
              }
              onAvatarChange={(pid, avatar) =>
                setRoster(
                  roster.map((p) => (p.id === pid ? { ...p, avatar } : p)),
                )
              }
              onRemove={(pid) =>
                roster.length > PLAYER_LIMITS.min &&
                setRoster(roster.filter((p) => p.id !== pid))
              }
              onReorder={(ids) =>
                setRoster(
                  ids
                    .map((pid) => roster.find((p) => p.id === pid))
                    .filter((p): p is Player => p != null),
                )
              }
            />
            {roster.length < PLAYER_LIMITS.max && (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => addPlayer()}
                >
                  <Plus className="size-4" />
                  Add player
                </Button>
                {quickAdd.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {quickAdd.slice(0, 8).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          addPlayer({
                            name: p.name,
                            color: p.color,
                            avatar: p.avatar,
                          })
                        }
                        className="bg-muted/60 hover:bg-muted flex items-center gap-1 rounded-full py-1 pr-2.5 pl-1 text-sm font-medium"
                      >
                        <PlayerAvatar
                          name={p.name}
                          color={p.color}
                          avatar={p.avatar}
                          size={20}
                        />
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Games</h2>
            {orderedGames.length === 0 ? (
              <p className="text-muted-foreground bg-muted/40 rounded-xl border p-4 text-center text-sm">
                No games yet — start the first one.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {orderedGames.map((g, i) => {
                  const winner = g.players.find((p) => p.id === g.winnerId)
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/game/${g.id}`)}
                        className="bg-card focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-xl border p-3 text-left outline-none focus-visible:ring-2"
                      >
                        <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {g.name || `Game ${i + 1}`}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {statusLabel(g.status)}
                            {winner ? ` · 🏆 ${winner.name}` : ''}
                          </p>
                        </div>
                        <ChevronRight className="text-muted-foreground size-4" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <Button className="h-12 w-full" onClick={newGame}>
              <Plus className="size-4" />
              New game
            </Button>
          </section>

          {playedCount > 0 && summary && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Standings so far</h2>
              <NightSummary summary={summary} />
              <LeagueTable games={games} roster={roster} />
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="mt-2 h-12 w-full">
                    <Flag className="size-4" />
                    Finish night
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Finish the night?</DialogTitle>
                    <DialogDescription>
                      We&apos;ll lock in the champion and awards. You can reopen
                      it later to add more games.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Not yet</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button onClick={() => finishNight(night.id)}>
                        Finish night
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </section>
          )}
        </>
      )}
    </div>
  )
}
