import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Archive,
  Copy,
  Download,
  RotateCcw,
  Search,
  Star,
  Trash2,
  Upload,
} from 'lucide-react'

import { EmptyState, LoadingState } from '@/components/common/screen-state'
import { PlayerAvatar } from '@/components/game/player-avatar'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Game } from '@/domain/types'
import { useToast } from '@/hooks/use-toast'
import { downloadText } from '@/lib/download'
import { vibrate } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import {
  useFinishedGames,
  useGameStore,
  useHasHydrated,
} from '@/stores/game-store'

function winnerName(game: Game): string | null {
  return game.players.find((p) => p.id === game.winnerId)?.name ?? null
}

function formatDate(ts: number | null): string {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ArchivePage() {
  const hydrated = useHasHydrated()
  const games = useFinishedGames()
  const navigate = useNavigate()
  const { toast } = useToast()
  const store = useGameStore.getState
  const [query, setQuery] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  if (!hydrated) return <LoadingState />

  const q = query.trim().toLowerCase()
  const filtered = games
    .filter((g) => {
      if (!q) return true
      const haystack = [g.name, ...g.players.map((p) => p.name)]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
    .sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        (b.finishedAt ?? 0) - (a.finishedAt ?? 0),
    )

  function handleExport() {
    downloadText('flipscorer-backup.json', store().exportGames())
    toast('Exported', { description: 'Saved a JSON backup of your games.' })
  }

  async function handleImport(file: File) {
    const result = store().importGames(await file.text())
    if (result.error) {
      toast('Import failed', { description: result.error })
      return
    }
    toast('Imported', {
      description: `${result.added} added · ${result.updated} updated · ${result.skipped} skipped`,
    })
  }

  return (
    <div className="flex flex-col gap-4 py-4 pb-safe">
      <PageHeader title="Archive" />

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={handleExport}>
          <Download className="size-4" />
          Export
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" />
          Import
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleImport(file)
            event.target.value = ''
          }}
        />
      </div>

      {games.length > 0 && (
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search games or players"
            aria-label="Search archive"
            className="pl-9"
          />
        </div>
      )}

      {games.length === 0 ? (
        <EmptyState
          icon={<Archive className="size-10" />}
          title="No finished games yet"
          description="Finished games land here. You can favourite, replay, duplicate, and export them."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matches"
          description={`Nothing matches “${query}”.`}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((game) => (
            <li key={game.id} className="bg-card rounded-xl border p-3">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/game/${game.id}`)}
                  className="focus-visible:ring-ring/50 min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2"
                >
                  <p className="truncate font-semibold">
                    {game.name || 'Untitled game'}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {formatDate(game.finishedAt)} · {game.players.length}{' '}
                    players
                    {winnerName(game) ? ` · 🏆 ${winnerName(game)}` : ''}
                  </p>
                  <div className="mt-1.5 flex -space-x-1.5">
                    {game.players.slice(0, 6).map((player) => (
                      <PlayerAvatar
                        key={player.id}
                        name={player.name}
                        color={player.color}
                        className="ring-card size-6 text-[10px] ring-2"
                      />
                    ))}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={game.favorite ? 'Remove favourite' : 'Favourite'}
                  aria-pressed={game.favorite}
                  onClick={() => {
                    store().toggleFavorite(game.id)
                    vibrate(6)
                  }}
                >
                  <Star
                    className={cn(
                      'size-5',
                      game.favorite && 'fill-amber-400 text-amber-400',
                    )}
                  />
                </Button>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <Button
                  variant="outline"
                  onClick={() => {
                    const newId = store().rematch(game.id)
                    if (newId) navigate(`/game/${newId}`)
                  }}
                >
                  <RotateCcw className="size-4" />
                  Replay
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    store().duplicateGame(game.id)
                    toast('Duplicated')
                  }}
                >
                  <Copy className="size-4" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => {
                    const before = game
                    store().deleteGame(game.id)
                    toast('Deleted', {
                      action: {
                        label: 'Undo',
                        onClick: () => store().replaceGame(before),
                      },
                    })
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
