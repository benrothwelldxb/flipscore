import { useState, type ComponentProps, type CSSProperties } from 'react'
import { Ban, ChevronDown, Minus, Plus, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  emptySelection,
  MODIFIERS,
  NUMBER_CARDS,
  scoreFlip7,
  setRoundBonus,
  toggleBust,
  toggleModifier,
  toggleNumber,
  type Flip7Selection,
} from '@/domain/flip7'
import type { RoundFlags } from '@/domain/types'
import { vibrate } from '@/lib/haptics'
import { cn } from '@/lib/utils'

interface CardBuilderProps {
  onSubmit: (value: number, flags?: RoundFlags) => void
  submitLabel?: string
}

// Flip 7's cards are cream faces with a coloured numeral. Number inks form a
// rainbow (approximating the real deck); modifier cards are orange.
const CARD_FACE = '#f5efdd'
const NUMBER_INK = [
  '#6b7280',
  '#0d9488',
  '#2563eb',
  '#dc2626',
  '#ea580c',
  '#16a34a',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#e11d48',
  '#d97706',
  '#9333ea',
]
const MODIFIER_INK = '#ea580c'
const DOUBLER_INK = '#c2410c'

function CardTile({
  label,
  ink,
  active,
  className,
  ...props
}: {
  label: string
  ink: string
  active: boolean
} & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      style={
        {
          color: ink,
          backgroundColor: CARD_FACE,
          ...(active ? { '--tw-ring-color': ink } : {}),
        } as CSSProperties
      }
      className={cn(
        'flex aspect-[3/4] items-center justify-center rounded-md border border-black/10 text-lg font-extrabold tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'scale-[1.05] shadow-md ring-2'
          : 'opacity-90 hover:opacity-100',
        className,
      )}
      {...props}
    >
      {label}
    </button>
  )
}

export function CardBuilder({
  onSubmit,
  submitLabel = 'Save score',
}: CardBuilderProps) {
  const [selection, setSelection] = useState<Flip7Selection>(emptySelection())
  const result = scoreFlip7(selection)

  function update(next: Flip7Selection) {
    setSelection(next)
    vibrate(4)
  }

  return (
    <div className="flex flex-col gap-3">
      <fieldset disabled={result.busted} className="disabled:opacity-40">
        <legend className="text-muted-foreground mb-1.5 text-xs font-semibold">
          Number cards
        </legend>
        <div className="grid grid-cols-7 gap-1.5">
          {NUMBER_CARDS.map((n) => (
            <CardTile
              key={n}
              label={String(n)}
              ink={NUMBER_INK[n]}
              active={selection.numbers.includes(n)}
              aria-label={`Number card ${n}`}
              onClick={() => update(toggleNumber(selection, n))}
            />
          ))}
        </div>
      </fieldset>

      <fieldset disabled={result.busted} className="disabled:opacity-40">
        <legend className="text-muted-foreground mb-1.5 text-xs font-semibold">
          Modifiers
        </legend>
        <div className="grid grid-cols-6 gap-1.5">
          {MODIFIERS.map((modifier) => {
            const isDouble = modifier === 'x2'
            return (
              <CardTile
                key={modifier}
                label={isDouble ? '×2' : modifier}
                ink={isDouble ? DOUBLER_INK : MODIFIER_INK}
                active={selection.modifiers.includes(modifier)}
                aria-label={
                  isDouble ? 'Times two' : `Plus ${modifier.slice(1)}`
                }
                onClick={() => update(toggleModifier(selection, modifier))}
              />
            )
          })}
        </div>
      </fieldset>

      <div className="flex items-center gap-2">
        <div className="bg-card flex flex-1 items-center justify-between rounded-lg border px-3 py-1.5">
          <span className="text-sm font-medium">Bonus</span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Decrease round bonus by 5"
              onClick={() =>
                update(setRoundBonus(selection, selection.roundBonus - 5))
              }
            >
              <Minus className="size-4" />
            </Button>
            <span
              className="w-8 text-center font-bold tabular-nums"
              aria-live="polite"
            >
              {selection.roundBonus}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Increase round bonus by 5"
              onClick={() =>
                update(setRoundBonus(selection, selection.roundBonus + 5))
              }
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant={selection.busted ? 'destructive' : 'outline'}
          aria-pressed={selection.busted}
          className={cn('h-11 shrink-0', !selection.busted && 'text-destructive')}
          onClick={() => update(toggleBust(selection))}
        >
          <Ban className="size-4" />
          {selection.busted ? 'Busted' : 'Bust'}
        </Button>
      </div>

      <details className="group border-border bg-muted/30 rounded-lg border">
        <summary className="flex cursor-pointer list-none items-center justify-between p-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span>Breakdown</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="space-y-0.5 px-3 pb-3 text-sm">
          {result.breakdown.map((line, index) => (
            <li key={index} className="flex justify-between gap-2">
              <span className="text-muted-foreground truncate">
                {line.label}
                {line.detail ? ` (${line.detail})` : ''}
              </span>
              <span className="font-medium tabular-nums">{line.value}</span>
            </li>
          ))}
        </ul>
      </details>

      <div className="bg-background/90 sticky bottom-0 -mb-1 flex items-center gap-3 border-t pt-3 pb-1 backdrop-blur">
        <div className="text-center leading-none">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
            Total
          </p>
          <p
            className={cn(
              'text-3xl font-bold tabular-nums',
              result.busted
                ? 'text-destructive'
                : result.isFlip7
                  ? 'text-primary'
                  : '',
            )}
            aria-live="polite"
            aria-label={`Round score ${result.total}`}
          >
            {result.total}
          </p>
          {result.isFlip7 && (
            <span className="text-primary inline-flex items-center gap-0.5 text-[10px] font-semibold">
              <Sparkles className="size-2.5" aria-hidden />
              Flip 7
            </span>
          )}
        </div>
        <Button
          type="button"
          size="lg"
          className="h-14 flex-1 text-base"
          onClick={() => {
            vibrate(12)
            onSubmit(result.total, {
              flip7: result.isFlip7,
              bust: result.busted,
            })
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
