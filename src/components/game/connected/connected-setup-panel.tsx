import { useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PLAYER_COLORS } from '@/domain/colors'
import type { Game } from '@/domain/types'
import { useGameStore } from '@/stores/game-store'
import { useNetStore } from '@/stores/net-store'

/**
 * Replaces the roster editor for Connected games: players join from their own
 * phones, so the host only chooses whether it plays too and whether to run over
 * the internet (relay) or fully offline (WebRTC + QR). "Open lobby" seats the
 * host, starts the transport, and hands off to the lobby.
 */
export function ConnectedSetupPanel({ game }: { game: Game }) {
  const startHosting = useNetStore((s) => s.startHosting)
  const beginLobby = useGameStore((s) => s.beginConnectedLobby)

  const [hostPlays, setHostPlays] = useState(true)
  const [hostName, setHostName] = useState('Host')
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' && navigator.onLine === false,
  )
  const [opening, setOpening] = useState(false)

  async function openLobby() {
    setOpening(true)
    const hostPlayerId = beginLobby(
      game.id,
      hostPlays
        ? { name: hostName.trim() || 'Host', color: PLAYER_COLORS[0].key }
        : null,
    )
    await startHosting(game.id, { offline, hostPlayerId })
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="bg-card space-y-4 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <p className="font-medium">Play on this device</p>
            <p className="text-muted-foreground text-sm">
              Add yourself as a player too.
            </p>
          </div>
          <Switch
            checked={hostPlays}
            onCheckedChange={setHostPlays}
            aria-label="Play on this device"
          />
        </div>
        {hostPlays && (
          <div className="space-y-2">
            <Label htmlFor="host-name">Your name</Label>
            <Input
              id="host-name"
              value={hostName}
              maxLength={20}
              onChange={(event) => setHostName(event.target.value)}
            />
          </div>
        )}
      </div>

      <div className="bg-card space-y-3 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <p className="flex items-center gap-2 font-medium">
              {offline ? (
                <WifiOff className="size-4" aria-hidden />
              ) : (
                <Wifi className="size-4" aria-hidden />
              )}
              Offline mode
            </p>
            <p className="text-muted-foreground text-sm">
              {offline
                ? 'No internet needed — players scan a code on the same Wi-Fi.'
                : 'Players join instantly by scanning one link (needs internet).'}
            </p>
          </div>
          <Switch
            checked={offline}
            onCheckedChange={setOffline}
            aria-label="Offline mode"
          />
        </div>
      </div>

      <Button
        size="lg"
        className="h-14 w-full text-base"
        disabled={opening}
        onClick={() => void openLobby()}
      >
        {opening ? 'Opening lobby…' : 'Open lobby'}
      </Button>
    </section>
  )
}
