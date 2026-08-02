import { Wifi, WifiOff } from 'lucide-react'

import type { Game } from '@/domain/types'
import { useNetStore } from '@/stores/net-store'

/** A slim status strip above the host's play view during a Connected game. */
export function ConnectionBar({ game }: { game: Game }) {
  const role = useNetStore((s) => s.role)
  const gameId = useNetStore((s) => s.gameId)
  const seats = useNetStore((s) => s.seats)
  const mode = useNetStore((s) => s.transportMode)
  const roomCode = useNetStore((s) => s.roomCode)

  const hosting = role === 'hosting' && gameId === game.id

  if (!hosting) {
    return (
      <div className="text-muted-foreground bg-muted/40 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
        <WifiOff className="size-4" aria-hidden />
        Session ended — playing on this device.
      </div>
    )
  }

  const connected = seats.filter((s) => s.connected).length

  return (
    <div className="bg-card flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
      <span className="flex items-center gap-2 font-medium">
        <Wifi className="size-4 text-emerald-500" aria-hidden />
        {connected} {connected === 1 ? 'player' : 'players'} connected
      </span>
      {mode === 'relay' && roomCode && (
        <span className="text-muted-foreground font-mono tracking-widest">
          {roomCode}
        </span>
      )}
      {mode === 'qr' && <span className="text-muted-foreground">Offline</span>}
    </div>
  )
}
