import { useState } from 'react'
import { Camera, Hash, LayoutGrid, type LucideIcon } from 'lucide-react'

import type { Flip7Rules } from '@/domain/flip7'
import type { RoundFlags } from '@/domain/types'
import {
  useCameraScoringEnabled,
  usePrefsStore,
  useScoreEntryMode,
  type ScoreEntryMode,
} from '@/stores/prefs-store'
import { cn } from '@/lib/utils'

import { CameraScorer } from './camera-scorer'
import { CardBuilder } from './card-builder'
import { ScoreEntry } from './score-entry'

interface ScoreEntryPanelProps {
  onSubmit: (value: number, flags?: RoundFlags) => void
  submitLabel?: string
  /** House rules for the Card Builder / Camera total. */
  rules?: Flip7Rules
}

type PanelMode = ScoreEntryMode | 'camera'

const BASE_OPTIONS: { key: ScoreEntryMode; label: string; icon: LucideIcon }[] =
  [
    { key: 'manual', label: 'Manual', icon: Hash },
    { key: 'cards', label: 'Card Builder', icon: LayoutGrid },
  ]

/** Score entry with a Manual / Card Builder switch (choice is remembered), plus
 *  an experimental Camera option when the user has opted in. */
export function ScoreEntryPanel({
  onSubmit,
  submitLabel,
  rules,
}: ScoreEntryPanelProps) {
  const persistedMode = useScoreEntryMode()
  const setMode = usePrefsStore((s) => s.setScoreEntryMode)
  const cameraEnabled = useCameraScoringEnabled()
  // Camera is a transient per-entry choice, not persisted as the default mode.
  const [cameraSelected, setCameraSelected] = useState(false)

  const active: PanelMode =
    cameraSelected && cameraEnabled ? 'camera' : persistedMode

  const options: { key: PanelMode; label: string; icon: LucideIcon }[] = [
    ...BASE_OPTIONS,
    ...(cameraEnabled
      ? [{ key: 'camera' as const, label: 'Camera', icon: Camera }]
      : []),
  ]

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label="Score entry method"
        className={cn(
          'bg-muted grid gap-1 rounded-lg p-1',
          cameraEnabled ? 'grid-cols-3' : 'grid-cols-2',
        )}
      >
        {options.map(({ key, label, icon: Icon }) => {
          const isActive = active === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                if (key === 'camera') {
                  setCameraSelected(true)
                } else {
                  setCameraSelected(false)
                  setMode(key)
                }
              }}
              className={cn(
                'focus-visible:ring-ring/50 flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium outline-none transition focus-visible:ring-2',
                isActive
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

      {active === 'manual' && (
        <ScoreEntry onSubmit={onSubmit} submitLabel={submitLabel} />
      )}
      {active === 'cards' && (
        <CardBuilder
          onSubmit={onSubmit}
          submitLabel={submitLabel}
          rules={rules}
        />
      )}
      {active === 'camera' && (
        <CameraScorer
          onSubmit={onSubmit}
          submitLabel={submitLabel}
          rules={rules}
        />
      )}
    </div>
  )
}
