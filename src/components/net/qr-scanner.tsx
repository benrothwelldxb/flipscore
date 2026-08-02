import { useEffect, useRef, useState } from 'react'
import { Camera, ClipboardPaste, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getBarcodeDetectorCtor, isScannerSupported } from '@/lib/barcode'

interface QrScannerProps {
  onResult: (text: string) => void
  /** Label for the paste fallback field. */
  pasteLabel?: string
  /** Hide the paste fallback (e.g. when a typed field already covers it). */
  hidePaste?: boolean
}

/**
 * Scans a QR code with the device camera (native BarcodeDetector) and offers a
 * paste fallback, so the offline handshake still works where the camera or the
 * API is unavailable.
 */
export function QrScanner({
  onResult,
  pasteLabel = 'Paste code',
  hidePaste = false,
}: QrScannerProps) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  function stop() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanning(false)
  }

  useEffect(() => stop, [])

  async function start() {
    const Ctor = getBarcodeDetectorCtor()
    if (!Ctor) {
      setError('This device can’t scan — paste the code instead.')
      return
    }
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      setScanning(true)
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      const detector = new Ctor({ formats: ['qr_code'] })
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes[0]?.rawValue) {
            const value = codes[0].rawValue
            stop()
            onResult(value)
            return
          }
        } catch {
          // Transient decode error; keep scanning.
        }
        rafRef.current = requestAnimationFrame(() => void tick())
      }
      rafRef.current = requestAnimationFrame(() => void tick())
    } catch {
      setError('Camera unavailable — paste the code instead.')
      stop()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {scanning ? (
        <div className="relative overflow-hidden rounded-xl border bg-black">
          <video
            ref={videoRef}
            className="aspect-square w-full object-cover"
            playsInline
            muted
          />
          <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/70" />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute top-2 right-2"
            onClick={stop}
          >
            <X className="size-4" />
            Stop
          </Button>
        </div>
      ) : (
        isScannerSupported() && (
          <Button type="button" variant="outline" onClick={() => void start()}>
            <Camera className="size-4" />
            Scan with camera
          </Button>
        )
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      {!hidePaste && (
        <div className="flex flex-col gap-2">
          <label className="text-muted-foreground text-xs font-medium">
            {pasteLabel}
          </label>
          <textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            rows={2}
            className="border-input bg-background focus-visible:ring-ring/50 w-full resize-none rounded-lg border px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2"
            placeholder="Paste the code here"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!pasted.trim()}
            onClick={() => onResult(pasted.trim())}
          >
            <ClipboardPaste className="size-4" />
            Use pasted code
          </Button>
        </div>
      )}
    </div>
  )
}
