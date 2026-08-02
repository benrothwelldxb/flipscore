import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time errors anywhere in the tree and shows a friendly
 * fallback instead of a blank screen. Persisted data is untouched.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A real deployment would forward this to an error-reporting service.
    console.error('FlipScore caught an unexpected error:', error, info)
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback

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
          <Button onClick={this.handleReload}>Reload</Button>
        </div>
      )
    }

    return this.props.children
  }
}
