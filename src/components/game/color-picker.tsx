import { useRef, type KeyboardEvent } from 'react'
import { Check } from 'lucide-react'

import { PLAYER_COLORS, readableTextColor } from '@/domain/colors'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  value: string
  onChange: (colorKey: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(event: KeyboardEvent, index: number) {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    if (!forward && !back) return
    event.preventDefault()
    const delta = forward ? 1 : -1
    const next = (index + delta + PLAYER_COLORS.length) % PLAYER_COLORS.length
    onChange(PLAYER_COLORS[next].key)
    refs.current[next]?.focus()
  }

  const selectedIndex = PLAYER_COLORS.findIndex((c) => c.key === value)

  return (
    <div
      role="radiogroup"
      aria-label="Player colour"
      className="flex flex-wrap gap-2"
    >
      {PLAYER_COLORS.map((color, index) => {
        const selected = value === color.key
        const tabbable = selected || (selectedIndex < 0 && index === 0)
        return (
          <button
            key={color.key}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color.label}
            tabIndex={tabbable ? 0 : -1}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => onChange(color.key)}
            className={cn(
              'ring-offset-background flex size-11 items-center justify-center rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2',
              selected && 'ring-ring ring-2 ring-offset-2',
            )}
            style={{ backgroundColor: color.hex }}
          >
            {selected && (
              <Check
                className="size-4"
                style={{ color: readableTextColor(color.hex) }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
