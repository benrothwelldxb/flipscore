import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center"
    >
      <Loader2
        className="text-muted-foreground size-8 animate-spin"
        aria-hidden
      />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  )
}

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center',
        className,
      )}
    >
      {icon && (
        <div className="text-muted-foreground" aria-hidden>
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-muted-foreground mx-auto max-w-xs text-sm text-balance">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
