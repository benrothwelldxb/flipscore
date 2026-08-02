import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, Loader2, Play, UserPlus, X } from 'lucide-react'

import { QrCode } from '@/components/net/qr-code'
import { QrScanner } from '@/components/net/qr-scanner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlayerAvatar } from '@/components/game/player-avatar'
import { PLAYER_LIMITS, type Game } from '@/domain/types'
import { useGameStore } from '@/stores/game-store'
import { useNetStore } from '@/stores/net-store'
import { isWebRtcSupported } from '@/net/webrtc-qr'

interface HostLobbyProps {
  game: Game
}

export function HostLobby({ game }: HostLobbyProps) {
  const navigate = useNavigate()
  const roomCode = useNetStore((s) => s.roomCode)
  const mode = useNetStore((s) => s.transportMode)
  const hostReady = useNetStore((s) => s.hostReady)
  const seats = useNetStore((s) => s.seats)
  const hostPlayerId = useNetStore((s) => s.hostPlayerId)
  const store = useGameStore.getState
  const net = useNetStore.getState

  const canStart = game.players.length >= PLAYER_LIMITS.min

  const joinUrl = roomCode
    ? `${location.origin}/join?r=${roomCode}`
    : `${location.origin}/join`

  function connectionOf(playerId: string): 'host' | 'online' | 'offline' {
    if (playerId === hostPlayerId) return 'host'
    const seat = seats.find((s) => s.playerId === playerId)
    return seat?.connected ? 'online' : 'offline'
  }

  function closeLobby() {
    net().stopHosting()
    store().deleteGame(game.id)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex flex-col gap-6 pb-28">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Lobby</h1>
          <p className="text-muted-foreground text-sm">
            {mode === 'qr' ? 'Offline · same Wi-Fi' : 'Online'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close lobby"
          onClick={closeLobby}
        >
          <X className="size-5" />
        </Button>
      </header>

      {mode === 'relay' ? (
        <RelayInvite ready={hostReady} joinUrl={joinUrl} roomCode={roomCode} />
      ) : (
        <OfflineInvite />
      )}

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-semibold">
          Players ({game.players.length})
        </h2>
        {game.players.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-sm">
            No one has joined yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {game.players.map((player) => {
              const status = connectionOf(player.id)
              return (
                <li
                  key={player.id}
                  className="bg-card flex items-center gap-3 rounded-xl border p-3"
                >
                  <PlayerAvatar name={player.name} color={player.color} />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {player.name}
                    {status === 'host' && (
                      <span className="text-muted-foreground ml-1 text-xs font-normal">
                        (you)
                      </span>
                    )}
                  </span>
                  {status === 'offline' ? (
                    <span className="text-muted-foreground text-xs">
                      Offline
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
                      aria-label="Connected"
                    >
                      <Check className="size-3.5" aria-hidden />
                      Ready
                    </span>
                  )}
                  {status !== 'host' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Remove ${player.name}`}
                      onClick={() => net().kickPlayer(player.id)}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="bg-background/80 fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-safe backdrop-blur">
        <div className="mx-auto flex max-w-md flex-col gap-1">
          <Button
            size="lg"
            className="h-14 w-full text-base"
            disabled={!canStart}
            onClick={() => store().startGame(game.id)}
          >
            <Play className="size-5" />
            Start game
          </Button>
          {!canStart && (
            <p className="text-muted-foreground text-center text-xs">
              Need at least {PLAYER_LIMITS.min} players to start.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function RelayInvite({
  ready,
  joinUrl,
  roomCode,
}: {
  ready: boolean
  joinUrl: string
  roomCode: string | null
}) {
  if (!ready || !roomCode) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2
          className="text-muted-foreground size-6 animate-spin"
          aria-hidden
        />
        <p className="text-muted-foreground text-sm">Opening the room…</p>
      </div>
    )
  }
  return (
    <section className="flex flex-col items-center gap-3 text-center">
      <QrCode value={joinUrl} label="Scan to join this game" />
      <div>
        <p className="text-muted-foreground text-sm">
          Scan to join, or enter code
        </p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em]">
          {roomCode}
        </p>
      </div>
    </section>
  )
}

function OfflineInvite() {
  const [open, setOpen] = useState(false)
  const [offer, setOffer] = useState<{ id: string; blob: string } | null>(null)
  const [phase, setPhase] = useState<'offer' | 'answer' | 'connecting'>('offer')
  const [error, setError] = useState<string | null>(null)
  const net = useNetStore.getState

  async function invite() {
    setError(null)
    setPhase('offer')
    setOpen(true)
    try {
      setOffer(await net().createOffer())
    } catch {
      setError('Couldn’t start an invite on this device.')
    }
  }

  async function onAnswer(answerBlob: string) {
    if (!offer) return
    setPhase('connecting')
    setError(null)
    try {
      await net().acceptAnswer(offer.id, answerBlob)
      setOpen(false)
    } catch (err) {
      setError((err as Error).message)
      setPhase('answer')
    }
  }

  if (!isWebRtcSupported()) {
    return (
      <p className="text-muted-foreground rounded-xl border p-4 text-center text-sm">
        Offline connections aren’t supported on this browser.
      </p>
    )
  }

  return (
    <section className="flex flex-col items-center gap-3 text-center">
      <p className="text-muted-foreground text-sm">
        Invite each player with a QR code — no internet required.
      </p>
      <Button onClick={() => void invite()}>
        <UserPlus className="size-4" />
        Invite a player
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite a player</DialogTitle>
            <DialogDescription>
              {phase === 'offer'
                ? 'They scan this code in FlipScorer, then show you their reply.'
                : phase === 'connecting'
                  ? 'Connecting…'
                  : 'Scan the reply code from their phone.'}
            </DialogDescription>
          </DialogHeader>

          {phase !== 'answer' && offer && (
            <div className="flex flex-col items-center gap-4">
              <QrCode value={offer.blob} label="Invite code" size={220} />
              {phase === 'connecting' ? (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Establishing the connection…
                </p>
              ) : (
                <Button variant="outline" onClick={() => setPhase('answer')}>
                  They’ve scanned it — scan their reply
                </Button>
              )}
            </div>
          )}

          {phase === 'answer' && (
            <QrScanner
              onResult={(text) => void onAnswer(text)}
              pasteLabel="Paste their reply code"
            />
          )}

          {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
        </DialogContent>
      </Dialog>
    </section>
  )
}
