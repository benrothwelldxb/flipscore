/**
 * Turn an SVG string into a PNG and share (or download) it. Fully client-side:
 * the SVG is drawn onto a canvas and exported — no external services, so it
 * works offline and within the app's strict CSP.
 */

/** Rasterise an SVG string to a PNG blob at an optional pixel scale. */
export function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
  scale = 2,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(
      new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
    )
    const image = new Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = width * scale
        canvas.height = height * scale
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas is unavailable.')
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error('Could not render image.')),
          'image/png',
        )
      } catch (error) {
        URL.revokeObjectURL(url)
        reject(error instanceof Error ? error : new Error('Render failed.'))
      }
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load image.'))
    }
    image.src = url
  })
}

/**
 * Share a PNG blob via the Web Share API when it can carry files, otherwise
 * fall back to downloading it. Returns how it was handled.
 */
export async function shareOrDownloadImage(
  blob: Blob,
  filename: string,
  meta: { title?: string; text?: string } = {},
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
  }
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], ...meta })
      return 'shared'
    } catch (error) {
      // A user cancel throws AbortError — don't fall through to a download.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'shared'
      }
    }
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
