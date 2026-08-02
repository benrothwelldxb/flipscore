import { Hash, LayoutGrid, type LucideIcon } from 'lucide-react'

import {
  usePrefsStore,
  useScoreEntryMode,
  type ScoreEntryMode,
} from '@/stores/prefs-store'
import { cn } from '@/lib/utils'

import { CardBuilder } from './card-builder'
import { ScoreEntry } from './score-entry'

interface ScoreEntryPanelProps {
  onSubmit: (value: number) => void
  submitLabel?: string
}

const OPTIONS: { key: ScoreEntryMode; label: string; icon: LucideIcon }[] = [
  { key: 'manual', label: 'Manual', icon: Hash },
  { key: 'cards', label: 'Card Builder', icon: LayoutGrid },
]

/** Score entry with a Manual / Card Builder switch (choice is remembered). */
export function ScoreEntryPanel({
  onSubmit,
  submitLabel,
}: ScoreEntryPanelProps) {
  const mode = useScoreEntryMode()
  const setMode = usePrefsStore((s) => s.setScoreEntryMode)

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label="Score entry method"
        className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1"
      >
        {OPTIONS.map(({ key, label, icon: Icon }) => {
          const active = mode === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setMode(key)}
              className={cn(
                'flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          )
        })}
      </div>

      {mode === 'manual' ? (
        <ScoreEntry onSubmit={onSubmit} submitLabel={submitLabel} />
      ) : (
        <CardBuilder onSubmit={onSubmit} submitLabel={submitLabel} />
      )}
    </div>
  )
}
