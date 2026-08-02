import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

import { cn } from '@/lib/utils'

interface QrCodeProps {
  /** The string to encode. */
  value: string
  /** Pixel size of the (square) code. */
  size?: number
  className?: string
  label?: string
}

/**
 * Renders a QR code as a self-contained data-URL image. Generation is local
 * (no network), so it works offline — which the offline handshake relies on.
 */
export function QrCode({ value, size = 224, className, label }: QrCodeProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    QRCode.toDataURL(value, {
      margin: 1,
      width: size * 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (active) {
          setSrc(url)
          setFailed(false)
        }
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [value, size])

  if (failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl border p-4 text-center text-sm text-muted-foreground',
          className,
        )}
        style={{ width: size, height: size }}
      >
        Couldn&apos;t render the code.
      </div>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-xl bg-white p-3 shadow-sm',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src && (
        <img
          src={src}
          alt={label ?? 'QR code'}
          width={size - 24}
          height={size - 24}
          className="h-full w-full"
        />
      )}
    </div>
  )
}
