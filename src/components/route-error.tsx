import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router'

import { Button } from '@/components/ui/button'

/** A failed lazy-route chunk load — usually a stale build after a deploy. */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  // Chrome: "Failed to fetch dynamically imported module"; Firefox/Safari:
  // "…module script failed". Deliberately NOT a bare "Failed to fetch", which
  // would match any network TypeError and mask real errors.
  return /dynamically imported module|module script failed/i.test(message)
}

/**
 * Rendered by React Router's `errorElement` when a route throws. Without this,
 * the data router shows its own unstyled default error page and the app-level
 * ErrorBoundary never sees route render errors.
 */
export function RouteErrorFallback() {
  const error = useRouteError()
  const chunkError = isChunkLoadError(error)

  // A stale chunk after a deploy fixes itself on reload — do it once per session
  // automatically (guarded so a genuinely broken deploy can't reload-loop).
  const willReload = chunkError && !sessionStorage.getItem('fs-chunk-reloaded')
  useEffect(() => {
    if (willReload) {
      sessionStorage.setItem('fs-chunk-reloaded', '1')
      window.location.reload()
    }
  }, [willReload])

  // Don't flash the error UI for the frame before the reload fires.
  if (willReload) return null

  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.'

  return (
    <div
      role="alert"
      className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <div className="text-5xl" aria-hidden>
        🃏
      </div>
      <h1 className="text-xl font-semibold">Something went sideways</h1>
      <p className="text-muted-foreground max-w-xs text-sm text-balance">
        FlipScore hit an unexpected error. Your saved games are safe — try
        reloading.
      </p>
      <p className="text-muted-foreground/70 max-w-xs font-mono text-xs break-words">
        {detail}
      </p>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </div>
  )
}
