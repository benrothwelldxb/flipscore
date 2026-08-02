import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RULE_PRESETS, resolveRules, type Flip7Rules } from '@/domain/flip7'
import type { GameSettings } from '@/domain/types'
import { cn } from '@/lib/utils'

interface HouseRulesProps {
  targetScore: number
  rules?: Flip7Rules
  onChange: (patch: Partial<GameSettings>) => void
}

function clampInt(raw: string, fallback: number, min: number, max: number) {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** Presets + fine controls for the score-affecting house rules. */
export function HouseRules({ targetScore, rules, onChange }: HouseRulesProps) {
  const r = resolveRules(rules)
  const [target, setTarget] = useState(String(targetScore))
  const [bonus, setBonus] = useState(String(r.flip7Bonus))
  const [count, setCount] = useState(String(r.flip7Count))

  const activePreset = RULE_PRESETS.find(
    (p) =>
      p.targetScore === targetScore &&
      p.rules.flip7Bonus === r.flip7Bonus &&
      p.rules.flip7Count === r.flip7Count,
  )

  function applyPreset(id: string) {
    const preset = RULE_PRESETS.find((p) => p.id === id)
    if (!preset) return
    setTarget(String(preset.targetScore))
    setBonus(String(preset.rules.flip7Bonus))
    setCount(String(preset.rules.flip7Count))
    onChange({ targetScore: preset.targetScore, rules: { ...preset.rules } })
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm leading-none font-medium">House rules</h2>

      <div className="flex flex-wrap gap-1.5">
        {RULE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p.id)}
            aria-pressed={activePreset?.id === p.id}
            title={p.description}
            className={cn(
              'focus-visible:ring-ring rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition focus-visible:ring-2',
              activePreset?.id === p.id
                ? 'border-primary bg-primary/15 text-primary'
                : 'bg-card hover:bg-accent/40',
            )}
          >
            {p.label}
          </button>
        ))}
        {!activePreset && (
          <span className="text-muted-foreground self-center px-1 text-xs">
            Custom
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="rule-target" className="text-xs">
            Target
          </Label>
          <Input
            id="rule-target"
            inputMode="numeric"
            pattern="[0-9]*"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onBlur={() => {
              const v = clampInt(target, targetScore, 10, 2000)
              setTarget(String(v))
              onChange({ targetScore: v })
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rule-bonus" className="text-xs">
            Flip 7 bonus
          </Label>
          <Input
            id="rule-bonus"
            inputMode="numeric"
            pattern="[0-9]*"
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            onBlur={() => {
              const v = clampInt(bonus, r.flip7Bonus, 0, 100)
              setBonus(String(v))
              onChange({ rules: { ...r, flip7Bonus: v } })
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rule-count" className="text-xs">
            Flip 7 cards
          </Label>
          <Input
            id="rule-count"
            inputMode="numeric"
            pattern="[0-9]*"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            onBlur={() => {
              const v = clampInt(count, r.flip7Count, 3, 12)
              setCount(String(v))
              onChange({ rules: { ...r, flip7Count: v } })
            }}
          />
        </div>
      </div>
    </section>
  )
}
