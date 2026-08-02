import { useRef, type KeyboardEvent } from 'react'
import { Radio, Smartphone, Wifi, type LucideIcon } from 'lucide-react'

import type { GameMode } from '@/domain/types'
import { cn } from '@/lib/utils'

interface ModeOption {
  key: GameMode
  title: string
  description: string
  icon: LucideIcon
}

const MODES: ModeOption[] = [
  {
    key: 'host',
    title: 'Host Scorekeeper',
    description: 'One device, one scorekeeper. See every score at once.',
    icon: Radio,
  },
  {
    key: 'pass',
    title: 'Pass the Phone',
    description:
      'Each player enters their own score, then passes the phone on.',
    icon: Smartphone,
  },
  {
    key: 'connected',
    title: 'Connected',
    description: 'Everyone joins from their own phone and scores live.',
    icon: Wifi,
  },
]

interface ModeSelectorProps {
  value: GameMode
  onChange: (mode: GameMode) => void
}

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(event: KeyboardEvent, index: number) {
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'
    const back = event.key === 'ArrowUp' || event.key === 'ArrowLeft'
    if (!forward && !back) return
    event.preventDefault()
    const delta = forward ? 1 : -1
    const next = (index + delta + MODES.length) % MODES.length
    refs.current[next]?.focus()
    onChange(MODES[next].key)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Game mode"
      className="flex flex-col gap-2"
    >
      {MODES.map((mode, index) => {
        const selected = value === mode.key
        const Icon = mode.icon
        return (
          <button
            key={mode.key}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => onChange(mode.key)}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4 text-left transition outline-none',
              'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              selected
                ? 'border-primary bg-primary/5 ring-primary ring-1'
                : 'bg-card border-border',
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 size-5 shrink-0',
                selected ? 'text-primary' : 'text-muted-foreground',
              )}
              aria-hidden
            />
            <span className="flex-1">
              <span className="flex items-center gap-2 font-semibold">
                {mode.title}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-sm">
                {mode.description}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
