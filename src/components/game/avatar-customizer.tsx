import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react'

import {
  Avatar,
  COUNTS,
  HAIR_COLOURS,
  randomAvatar,
  SHIRT_COLOURS,
} from '@/avatar'
import { Button } from '@/components/ui/button'
import type { AvatarConfig } from '@/domain/types'
import { cn } from '@/lib/utils'

interface AvatarCustomizerProps {
  value: AvatarConfig
  name: string
  onChange: (config: AvatarConfig) => void
}

/** Intentionally-simple avatar editor: cycle each feature or pick a colour, with
 *  a live preview and one-tap Shuffle. Everything updates the player instantly. */
export function AvatarCustomizer({
  value,
  name,
  onChange,
}: AvatarCustomizerProps) {
  const cycle = (key: keyof typeof COUNTS, delta: number) => {
    const count = COUNTS[key]
    const current = value[key as keyof AvatarConfig] as number
    onChange({ ...value, [key]: (current + delta + count) % count })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3">
        <Avatar config={value} size={120} blink title={name} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(randomAvatar())}
        >
          <Shuffle className="size-4" />
          Shuffle
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Stepper
          label="Hair"
          onPrev={() => cycle('hairStyle', -1)}
          onNext={() => cycle('hairStyle', 1)}
        />
        <Swatches
          label="Hair colour"
          colours={HAIR_COLOURS}
          value={value.hairColour}
          onPick={(hairColour) => onChange({ ...value, hairColour })}
        />
        <Stepper
          label="Eyes"
          onPrev={() => cycle('eyes', -1)}
          onNext={() => cycle('eyes', 1)}
        />
        <Stepper
          label="Mouth"
          onPrev={() => cycle('mouth', -1)}
          onNext={() => cycle('mouth', 1)}
        />
        <Stepper
          label="Glasses"
          onPrev={() => cycle('glasses', -1)}
          onNext={() => cycle('glasses', 1)}
        />
        <Stepper
          label="Facial hair"
          onPrev={() => cycle('facialHair', -1)}
          onNext={() => cycle('facialHair', 1)}
        />
        <Stepper
          label="Accessory"
          onPrev={() => cycle('accessory', -1)}
          onNext={() => cycle('accessory', 1)}
        />
        <Swatches
          label="Shirt colour"
          colours={SHIRT_COLOURS}
          value={value.shirtColour}
          onPick={(shirtColour) => onChange({ ...value, shirtColour })}
        />
      </div>
    </div>
  )
}

function Stepper({
  label,
  onPrev,
  onNext,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="bg-muted/40 flex items-center justify-between rounded-lg border px-3 py-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onPrev}
          aria-label={`Previous ${label.toLowerCase()}`}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onNext}
          aria-label={`Next ${label.toLowerCase()}`}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function Swatches({
  label,
  colours,
  value,
  onPick,
}: {
  label: string
  colours: readonly string[]
  value: string
  onPick: (colour: string) => void
}) {
  return (
    <div className="bg-muted/40 rounded-lg border px-3 py-2">
      <p id={`${label}-label`} className="mb-1.5 text-sm font-medium">
        {label}
      </p>
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-labelledby={`${label}-label`}
      >
        {colours.map((colour, index) => {
          const selected = value.toLowerCase() === colour.toLowerCase()
          return (
            <button
              key={colour}
              type="button"
              aria-pressed={selected}
              aria-label={`${label} ${index + 1}`}
              onClick={() => onPick(colour)}
              className={cn(
                'focus-visible:ring-ring size-7 rounded-full border border-black/10 outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2',
                selected
                  ? 'ring-foreground ring-2 ring-offset-2 ring-offset-background'
                  : '',
              )}
              style={{ backgroundColor: colour }}
            />
          )
        })}
      </div>
    </div>
  )
}
