import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, RefreshCw, ScanLine, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { emptySelection, type Flip7Selection } from '@/domain/flip7'
import type { RoundFlags } from '@/domain/types'
import { cn } from '@/lib/utils'
import { detectionsToSelection } from '@/vision/to-selection'
import { getRecognizerInfo } from '@/vision/recognizer'
import type { CardRecognizer, DetectedCard } from '@/vision/types'

import { CardBuilder } from './card-builder'

interface CameraScorerProps {
  onSubmit: (value: number, flags?: RoundFlags) => void
  submitLabel?: string
}

type Phase = 'camera' | 'scanning' | 'review'

function hasCamera(): boolean {
  return (
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  )
}

function detectionLabel(card: DetectedCard): string {
  switch (card.kind) {
    case 'number':
      return String(card.value)
    case 'modifier':
      return card.value === 'x2' ? '×2' : String(card.value)
    case 'flip7':
      return 'Flip 7'
    case 'bust':
      return 'Bust'
  }
}

/**
 * Experimental Camera Scoring. Captures a frame, runs the pluggable recognizer,
 * then hands the detected cards to the Card Builder — seeded and fully editable —
 * so the user confirms/corrects and the score is computed by the same engine as
 * every other entry path. The recognizer is created lazily and disposed on
 * unmount; nothing here knows which model is behind the interface.
 */
export function CameraScorer({ onSubmit, submitLabel }: CameraScorerProps) {
  const recognizer = getRecognizerInfo()
  const [phase, setPhase] = useState<Phase>('camera')
  const [error, setError] = useState<string | null>(null)
  const [detected, setDetected] = useState<DetectedCard[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [selection, setSelection] = useState<Flip7Selection>(emptySelection())
  const [scanId, setScanId] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognizerRef = useRef<CardRecognizer | null>(null)

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function startCamera() {
    if (!hasCamera()) {
      // Defer so the state update never runs synchronously inside the effect.
      await Promise.resolve()
      setError('No camera available — enter cards by hand below.')
      setPhase('review')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      setError(null)
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
      }
    } catch {
      setError('Couldn’t open the camera — enter cards by hand below.')
      setPhase('review')
    }
  }

  // Start the camera on mount; tear everything down on unmount. Starting the
  // camera is an external-system subscription (state is only set after an await
  // resolves), which is the documented exception to set-state-in-effect.
  useEffect(() => {
    const ref = recognizerRef
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void startCamera()
    return () => {
      stopCamera()
      void ref.current?.dispose?.()
    }
    // startCamera/stopCamera intentionally run once on mount.
  }, [])

  async function scan() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    setPhase('scanning')
    setError(null)

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)

    try {
      recognizerRef.current ??= recognizer.create()
      const result = await recognizerRef.current.recognize(canvas)
      setDetected(result.cards)
      setNote(result.note ?? null)
      setSelection(detectionsToSelection(result.cards))
      setScanId((n) => n + 1)
      stopCamera()
      setPhase('review')
    } catch {
      setError('Scanning failed — enter the cards by hand below.')
      setDetected([])
      setSelection(emptySelection())
      setScanId((n) => n + 1)
      stopCamera()
      setPhase('review')
    }
  }

  function rescan() {
    setDetected([])
    setNote(null)
    setPhase('camera')
    void startCamera()
  }

  if (phase === 'review') {
    return (
      <div className="flex flex-col gap-3">
        <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {detected.length
                ? 'Detected — check and correct below'
                : 'Nothing detected'}
            </p>
            <Button variant="outline" size="sm" onClick={rescan}>
              <RefreshCw className="size-4" />
              Rescan
            </Button>
          </div>
          {detected.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {detected.map((card, index) => (
                <li
                  key={index}
                  className="bg-background inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold"
                >
                  {card.kind === 'flip7' && (
                    <Sparkles className="size-3 text-primary" aria-hidden />
                  )}
                  {detectionLabel(card)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">
              {note ?? 'Add the cards you drew below.'}
            </p>
          )}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <CardBuilder
          key={scanId}
          initialSelection={selection}
          onSubmit={onSubmit}
          submitLabel={submitLabel}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-xl border bg-black">
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full object-cover"
          playsInline
          muted
        />
        <div
          className="pointer-events-none absolute inset-4 rounded-lg border-2 border-white/60"
          aria-hidden
        />
        {phase === 'scanning' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
            <Loader2 className="size-6 animate-spin" aria-hidden />
            <p className="text-sm">Reading cards…</p>
          </div>
        )}
      </div>

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <ScanLine className="size-3.5" aria-hidden />
        Experimental · {recognizer.label}. Point at your cards, then scan.
      </p>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={() => {
            stopCamera()
            setDetected([])
            setSelection(emptySelection())
            setScanId((n) => n + 1)
            setPhase('review')
          }}
        >
          Enter by hand
        </Button>
        <Button
          className={cn(
            phase === 'scanning' && 'pointer-events-none opacity-70',
          )}
          disabled={phase === 'scanning'}
          onClick={() => void scan()}
        >
          <Camera className="size-4" />
          Scan cards
        </Button>
      </div>
    </div>
  )
}
