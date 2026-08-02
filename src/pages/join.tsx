import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ArrowLeft, ScanLine, Wifi } from 'lucide-react'

import { ConnectedGuestScreen } from '@/components/game/connected/guest-screen'
import { QrScanner } from '@/components/net/qr-scanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PLAYER_COLORS, readableTextColor } from '@/domain/colors'
import { loadJoin } from '@/net/join-storage'
import { decodeSignal, isWebRtcSupported } from '@/net/webrtc-qr'
import { isValidRoomCode, normalizeRoomCode } from '@/net/room-code'
import { cn } from '@/lib/utils'
import { useNetStore } from '@/stores/net-store'

/** Guest entry point (`/join`). Falls through to the live session once joined. */
export function JoinPage() {
  const role = useNetStore((s) => s.role)
  if (role === 'guest') return <ConnectedGuestScreen />
  return <JoinForm />
}

function JoinForm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const joinRelay = useNetStore((s) => s.joinRelay)
  const answerOffer = useNetStore((s) => s.answerOffer)

  const initialCode = params.get('r') ?? ''
  const [mode, setMode] = useState<'online' | 'offline'>(
    initialCode ? 'online' : navigator.onLine === false ? 'offline' : 'online',
  )
  const [code, setCode] = useState(initialCode)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PLAYER_COLORS[6].key)
  const [offerBlob, setOfferBlob] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const codeValid = useMemo(() => isValidRoomCode(code), [code])
  const nameValid = name.trim().length > 0

  // If we still hold a token for the room in the URL, resume automatically —
  // this is what makes a mid-game reload reclaim the same seat.
  const resumed = useRef(false)
  useEffect(() => {
    if (resumed.current || !initialCode) return
    const room = normalizeRoomCode(initialCode)
    const saved = isValidRoomCode(room) ? loadJoin(room) : null
    if (saved) {
      resumed.current = true
      void joinRelay({ roomCode: room, name: saved.name, color: saved.color })
    }
  }, [initialCode, joinRelay])

  async function joinOnline() {
    if (!codeValid || !nameValid) return
    setBusy(true)
    setError(null)
    try {
      await joinRelay({
        roomCode: normalizeRoomCode(code),
        name: name.trim(),
        color,
      })
    } catch {
      setError('Could not reach the host. Check the code and your connection.')
      setBusy(false)
    }
  }

  async function connectOffline() {
    if (!offerBlob || !nameValid) return
    setBusy(true)
    setError(null)
    try {
      await answerOffer(offerBlob, { name: name.trim(), color })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to home"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-xl font-bold">Join a game</h1>
      </header>

      <div
        role="tablist"
        aria-label="Join method"
        className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1"
      >
        {(['online', 'offline'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={mode === key}
            onClick={() => {
              setMode(key)
              setError(null)
            }}
            className={cn(
              'flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition',
              mode === key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground',
            )}
          >
            {key === 'online' ? (
              <Wifi className="size-4" aria-hidden />
            ) : (
              <ScanLine className="size-4" aria-hidden />
            )}
            {key === 'online' ? 'With a code' : 'Offline'}
          </button>
        ))}
      </div>

      {mode === 'online' ? (
        <div className="space-y-2">
          <Label htmlFor="room-code">Game code</Label>
          <Input
            id="room-code"
            value={code}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABC123"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            className="text-center font-mono text-lg tracking-[0.3em]"
          />
        </div>
      ) : !isWebRtcSupported() ? (
        <p className="text-muted-foreground rounded-xl border p-4 text-center text-sm">
          Offline connections aren’t supported on this browser.
        </p>
      ) : offerBlob ? (
        <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 text-center text-sm">
          Invite scanned. Choose your name below, then connect.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            Scan the host’s invite code.
          </p>
          <QrScanner
            pasteLabel="Paste the invite code"
            onResult={(text) => {
              if (decodeSignal(text)?.t === 'offer') {
                setOfferBlob(text)
                setError(null)
              } else {
                setError('That doesn’t look like a valid invite code.')
              }
            }}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="join-name">Your name</Label>
        <Input
          id="join-name"
          value={name}
          maxLength={20}
          placeholder="Enter your name"
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Your colour</Label>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Your colour"
        >
          {PLAYER_COLORS.map((c) => {
            const selected = color === c.key
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={c.label}
                onClick={() => setColor(c.key)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full outline-none transition',
                  selected
                    ? 'ring-foreground ring-2 ring-offset-2 ring-offset-background'
                    : '',
                )}
                style={{
                  backgroundColor: c.hex,
                  color: readableTextColor(c.hex),
                }}
              >
                {selected && '✓'}
              </button>
            )
          })}
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {mode === 'online' ? (
        <Button
          size="lg"
          className="h-14 w-full text-base"
          disabled={!codeValid || !nameValid || busy}
          onClick={() => void joinOnline()}
        >
          {busy ? 'Joining…' : 'Join game'}
        </Button>
      ) : (
        <Button
          size="lg"
          className="h-14 w-full text-base"
          disabled={!offerBlob || !nameValid || busy}
          onClick={() => void connectOffline()}
        >
          {busy ? 'Connecting…' : 'Connect'}
        </Button>
      )}
    </div>
  )
}
