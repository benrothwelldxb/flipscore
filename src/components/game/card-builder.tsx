import { useState } from 'react'
import { Ban, Minus, Plus, Sparkles } from 'lucide-react'

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
import { vibrate } from '@/lib/haptics'
import { cn } from '@/lib/utils'

interface CardBuilderProps {
  onSubmit: (value: number) => void
  submitLabel?: string
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
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'rounded-xl border p-4 text-center transition-colors',
          result.busted
            ? 'border-destructive/40 bg-destructive/5'
            : result.isFlip7
              ? 'border-primary/50 bg-primary/5'
              : 'bg-card',
        )}
      >
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          Round score
        </p>
        <p
          className="text-4xl font-bold tabular-nums"
          aria-live="polite"
          aria-label={`Round score ${result.total}`}
        >
          {result.total}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5 empty:hidden">
          {result.isFlip7 && (
            <span className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
              <Sparkles className="size-3" aria-hidden />
              Flip 7 +15
            </span>
          )}
          {result.doubled && (
            <span className="inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-black">
              ×2
            </span>
          )}
          {result.busted && (
            <span className="bg-destructive inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white">
              Busted
            </span>
          )}
        </div>
      </div>

      <fieldset
        disabled={result.busted}
        className="space-y-2 disabled:opacity-40"
      >
        <legend className="text-muted-foreground mb-2 text-sm font-semibold">
          Number cards
        </legend>
        <div className="grid grid-cols-7 gap-1.5">
          {NUMBER_CARDS.map((n) => {
            const active = selection.numbers.includes(n)
            return (
              <button
                key={n}
                type="button"
                aria-pressed={active}
                aria-label={`Number card ${n}`}
                onClick={() => update(toggleNumber(selection, n))}
                className={cn(
                  'flex aspect-[3/4] items-center justify-center rounded-md border text-lg font-bold tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50',
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow'
                    : 'bg-card',
                )}
              >
                {n}
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset
        disabled={result.busted}
        className="space-y-2 disabled:opacity-40"
      >
        <legend className="text-muted-foreground mb-2 text-sm font-semibold">
          Modifiers
        </legend>
        <div className="grid grid-cols-3 gap-1.5">
          {MODIFIERS.map((modifier) => {
            const active = selection.modifiers.includes(modifier)
            const isDouble = modifier === 'x2'
            return (
              <button
                key={modifier}
                type="button"
                aria-pressed={active}
                aria-label={
                  isDouble ? 'Times two' : `Plus ${modifier.slice(1)}`
                }
                onClick={() => update(toggleModifier(selection, modifier))}
                className={cn(
                  'h-11 rounded-md border text-base font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50',
                  active
                    ? isDouble
                      ? 'border-amber-500 bg-amber-500 text-black'
                      : 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card',
                )}
              >
                {isDouble ? '×2' : modifier}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Round bonus</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Decrease round bonus by 5"
            onClick={() =>
              update(setRoundBonus(selection, selection.roundBonus - 5))
            }
          >
            <Minus className="size-4" />
          </Button>
          <span
            className="w-12 text-center font-bold tabular-nums"
            aria-live="polite"
          >
            {selection.roundBonus}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
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
        onClick={() => update(toggleBust(selection))}
      >
        <Ban className="size-4" />
        {selection.busted ? 'Busted — tap to undo' : 'Bust (score 0)'}
      </Button>

      <div className="bg-muted/40 rounded-lg p-3 text-sm">
        <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
          Breakdown
        </p>
        <ul className="space-y-0.5">
          {result.breakdown.map((line, index) => (
            <li key={index} className="flex justify-between gap-2">
              <span className="text-muted-foreground truncate">
                {line.label}
                {line.detail ? ` (${line.detail})` : ''}
              </span>
              <span className="font-medium tabular-nums">{line.value}</span>
            </li>
          ))}
          <li className="mt-1 flex justify-between border-t pt-1 font-bold">
            <span>Total</span>
            <span className="tabular-nums">{result.total}</span>
          </li>
        </ul>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setSelection(emptySelection())}
        >
          Clear
        </Button>
        <Button
          type="button"
          size="lg"
          className="h-14 flex-1 text-base"
          onClick={() => {
            vibrate(12)
            onSubmit(result.total)
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
