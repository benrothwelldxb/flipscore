import { useState, type ComponentProps, type CSSProperties } from 'react'
import {
  Ban,
  ChevronDown,
  Layers,
  Minus,
  Plus,
  Shield,
  Snowflake,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { readableTextColor } from '@/domain/colors'
import {
  DEFAULT_RULES,
  emptySelection,
  MODIFIERS,
  NUMBER_CARDS,
  scoreFlip7,
  setRoundBonus,
  toggleBust,
  toggleModifier,
  toggleNumber,
  type Flip7Rules,
  type Flip7Selection,
} from '@/domain/flip7'
import type { RoundFlags } from '@/domain/types'
import { vibrate } from '@/lib/haptics'
import { cn } from '@/lib/utils'

interface CardBuilderProps {
  onSubmit: (value: number, flags?: RoundFlags) => void
  submitLabel?: string
  /** Seed the builder (e.g. with cards detected by Camera Scoring). */
  initialSelection?: Flip7Selection
  /** House rules governing the Flip 7 bonus/threshold. */
  rules?: Flip7Rules
}

/** The action cards a scorer records as round annotations. */
interface ActionCards {
  secondChance: boolean
  freeze: boolean
  flipThree: boolean
}

const ACTION_CARDS: {
  key: keyof ActionCards
  label: string
  icon: LucideIcon
}[] = [
  { key: 'secondChance', label: 'Second Chance', icon: Shield },
  { key: 'freeze', label: 'Freeze', icon: Snowflake },
  { key: 'flipThree', label: 'Flip Three', icon: Layers },
]

// Each Flip 7 number card has its own colour (matching the real deck). We fill
// the whole tile with that colour and render the numeral in whichever of
// black/white has the higher contrast, so every card is legible — the number,
// not the colour alone, is always the primary signal.
const NUMBER_COLORS = [
  '#ec4899', // 0  pink
  '#b0a28e', // 1  warm light grey
  '#84cc16', // 2  lime green
  '#ef4444', // 3  red
  '#14b8a6', // 4  turquoise
  '#15803d', // 5  dark green
  '#7c3aed', // 6  purple
  '#a13b2a', // 7  browny red
  '#22c55e', // 8  green
  '#f97316', // 9  orange
  '#dc2626', // 10 red
  '#38bdf8', // 11 light blue
  '#6b7280', // 12 grey
]
const MODIFIER_COLOR = '#ea580c'
const DOUBLER_COLOR = '#b91c1c'

function CardTile({
  label,
  color,
  active,
  className,
  ...props
}: {
  label: string
  /** The card's face colour; the numeral is auto-contrasted against it. */
  color: string
  active: boolean
} & ComponentProps<'button'>) {
  const ink = readableTextColor(color)
  return (
    <button
      type="button"
      aria-pressed={active}
      style={
        {
          color: ink,
          backgroundColor: color,
          '--tw-ring-color': ink,
        } as CSSProperties
      }
      className={cn(
        'relative flex aspect-[3/4] items-center justify-center rounded-md border border-black/10 text-xl font-extrabold tabular-nums shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'z-10 scale-[1.08] shadow-md ring-2 ring-offset-2 ring-offset-background'
          : 'opacity-70 hover:opacity-100',
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
  initialSelection,
  rules = DEFAULT_RULES,
}: CardBuilderProps) {
  const [selection, setSelection] = useState<Flip7Selection>(
    initialSelection ?? emptySelection(),
  )
  const [actions, setActions] = useState<ActionCards>({
    secondChance: false,
    freeze: false,
    flipThree: false,
  })
  const result = scoreFlip7(selection, rules)

  function update(next: Flip7Selection) {
    setSelection(next)
    vibrate(4)
  }

  function toggleAction(key: keyof ActionCards) {
    vibrate(4)
    setActions((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      // A Second Chance means the bust was avoided — the two can't both apply.
      if (key === 'secondChance' && next.secondChance && selection.busted) {
        setSelection((s) => ({ ...s, busted: false }))
      }
      return next
    })
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
              color={NUMBER_COLORS[n]}
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
                color={isDouble ? DOUBLER_COLOR : MODIFIER_COLOR}
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
          className={cn(
            'h-11 shrink-0',
            !selection.busted && 'text-destructive',
          )}
          onClick={() => {
            const nowBusted = !selection.busted
            update(toggleBust(selection))
            if (nowBusted && actions.secondChance) {
              setActions((a) => ({ ...a, secondChance: false }))
            }
          }}
        >
          <Ban className="size-4" />
          {selection.busted ? 'Busted' : 'Bust'}
        </Button>
      </div>

      <div>
        <p className="text-muted-foreground mb-1.5 text-xs font-semibold">
          Action cards
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {ACTION_CARDS.map(({ key, label, icon: Icon }) => {
            const on = actions[key]
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleAction(key)}
                className={cn(
                  'focus-visible:ring-ring flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-medium outline-none transition focus-visible:ring-2',
                  on
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
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
              secondChance: actions.secondChance,
              freeze: actions.freeze,
              flipThree: actions.flipThree,
            })
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
