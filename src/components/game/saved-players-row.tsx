import { Plus, X } from 'lucide-react'

import { colorByKey, readableTextColor } from '@/domain/colors'
import { useGameStore } from '@/stores/game-store'
import { useRosterStore, useSavedPlayers } from '@/stores/roster-store'

interface SavedPlayersRowProps {
  gameId: string
  /** Names already in the game (case-insensitive) — hidden from the picker. */
  currentNames: string[]
  /** True when the game is at the player cap. */
  disabled: boolean
}

/** One-tap add for previously-used players, so a roster needn't be retyped. */
export function SavedPlayersRow({
  gameId,
  currentNames,
  disabled,
}: SavedPlayersRowProps) {
  const saved = useSavedPlayers()
  const forget = useRosterStore((s) => s.forget)
  const addNamedPlayer = useGameStore((s) => s.addNamedPlayer)

  const taken = new Set(currentNames.map((n) => n.trim().toLowerCase()))
  const available = saved.filter((p) => !taken.has(p.name.trim().toLowerCase()))

  if (available.length === 0) return null

  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-xs font-medium">Saved players</p>
      <ul className="flex flex-wrap gap-1.5">
        {available.map((player) => {
          const { hex } = colorByKey(player.color)
          return (
            <li key={player.id} className="flex items-center">
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  addNamedPlayer(gameId, player.name, player.color)
                }
                className="focus-visible:ring-ring/50 flex items-center gap-1 rounded-full border py-1 pr-2 pl-1 text-sm font-medium outline-none transition hover:brightness-95 focus-visible:ring-2 disabled:opacity-40"
                aria-label={`Add ${player.name}`}
              >
                <span
                  className="flex size-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: hex,
                    color: readableTextColor(hex),
                  }}
                  aria-hidden
                >
                  <Plus className="size-3" />
                </span>
                {player.name}
              </button>
              <button
                type="button"
                onClick={() => forget(player.id)}
                aria-label={`Forget ${player.name}`}
                className="text-muted-foreground hover:text-foreground -ml-1 rounded-full p-1"
              >
                <X className="size-3" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
