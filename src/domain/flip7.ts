/**
 * Flip 7 round scoring — a pure, UI-independent engine.
 *
 * Rules modelled:
 * - Number cards 0–12; only unique values count toward the total.
 * - Modifier cards: +2 / +4 / +6 / +8 / +10 add flat points; ×2 doubles the
 *   number-card total (number cards only, not the flat modifiers).
 * - Flip 7: collecting 7 unique number cards awards a +15 bonus.
 * - Bust: the round scores 0 regardless of anything else.
 * - Round bonus: extra manual points (e.g. action-card awards).
 *
 * Order of operations: (numberSum × ×2) + flatModifiers + flip7Bonus +
 * roundBonus. The returned `breakdown` always sums to `total`.
 */

export const NUMBER_CARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

export const FLAT_MODIFIERS = ['+2', '+4', '+6', '+8', '+10'] as const
export type FlatModifier = (typeof FLAT_MODIFIERS)[number]
export type Modifier = FlatModifier | 'x2'
export const MODIFIERS: readonly Modifier[] = [...FLAT_MODIFIERS, 'x2']

export const FLIP7_BONUS = 15
export const FLIP7_COUNT = 7

/**
 * The score-affecting "house rules" for a game. Only two things actually change
 * the maths of a round — the Flip 7 bonus and how many unique cards earn it — so
 * those are the knobs. (The target score lives on {@link GameSettings} since it
 * governs the game, not a round.) Kept tiny and open for future variants.
 */
export interface Flip7Rules {
  flip7Bonus: number
  flip7Count: number
}

export const DEFAULT_RULES: Flip7Rules = {
  flip7Bonus: FLIP7_BONUS,
  flip7Count: FLIP7_COUNT,
}

/** Resolve possibly-absent rules (older games) to a concrete set. */
export function resolveRules(rules?: Flip7Rules): Flip7Rules {
  return rules ?? DEFAULT_RULES
}

/** A named bundle of rules + target score, for one-tap setup. */
export interface RulePreset {
  id: string
  label: string
  description: string
  targetScore: number
  rules: Flip7Rules
}

export const RULE_PRESETS: readonly RulePreset[] = [
  {
    id: 'standard',
    label: 'Standard',
    description: 'The classic game to 200.',
    targetScore: 200,
    rules: { flip7Bonus: 15, flip7Count: 7 },
  },
  {
    id: 'quick',
    label: 'Quick',
    description: 'A shorter game to 100.',
    targetScore: 100,
    rules: { flip7Bonus: 15, flip7Count: 7 },
  },
  {
    id: 'marathon',
    label: 'Marathon',
    description: 'The long haul to 300.',
    targetScore: 300,
    rules: { flip7Bonus: 15, flip7Count: 7 },
  },
  {
    id: 'family',
    label: 'Family',
    description: 'Easier Flip 7 (6 cards) and a bigger +20 bonus.',
    targetScore: 150,
    rules: { flip7Bonus: 20, flip7Count: 6 },
  },
] as const

export interface Flip7Selection {
  /** Number cards collected (only unique values score). */
  numbers: number[]
  modifiers: Modifier[]
  busted: boolean
  /** Extra manual round bonus points. */
  roundBonus: number
}

export interface BreakdownLine {
  label: string
  value: number
  detail?: string
}

export interface Flip7Result {
  total: number
  busted: boolean
  isFlip7: boolean
  numberSum: number
  doubled: boolean
  breakdown: BreakdownLine[]
  /** Number values selected more than once (the UI prevents these). */
  duplicateNumbers: number[]
}

export function emptySelection(): Flip7Selection {
  return { numbers: [], modifiers: [], busted: false, roundBonus: 0 }
}

/** The point value a flat modifier contributes (×2 contributes nothing flat). */
export function flatValue(modifier: Modifier): number {
  return modifier === 'x2' ? 0 : parseInt(modifier, 10)
}

export function scoreFlip7(
  selection: Flip7Selection,
  rules: Flip7Rules = DEFAULT_RULES,
): Flip7Result {
  const counts = new Map<number, number>()
  for (const n of selection.numbers) {
    counts.set(n, (counts.get(n) ?? 0) + 1)
  }
  const duplicateNumbers = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([n]) => n)
    .sort((a, b) => a - b)
  const unique = [...counts.keys()].sort((a, b) => a - b)

  if (selection.busted) {
    return {
      total: 0,
      busted: true,
      isFlip7: false,
      numberSum: 0,
      doubled: false,
      breakdown: [{ label: 'Busted', value: 0, detail: 'Round scores 0' }],
      duplicateNumbers,
    }
  }

  const numberSum = unique.reduce((sum, n) => sum + n, 0)
  const doubled = selection.modifiers.includes('x2')
  const isFlip7 = unique.length >= rules.flip7Count

  const breakdown: BreakdownLine[] = [
    {
      label: 'Number cards',
      value: numberSum,
      detail: unique.length ? unique.join(' + ') : 'none',
    },
  ]
  if (doubled) {
    breakdown.push({ label: '×2 doubler', value: numberSum })
  }
  for (const modifier of selection.modifiers) {
    if (modifier === 'x2') continue
    breakdown.push({
      label: `Modifier ${modifier}`,
      value: flatValue(modifier),
    })
  }
  if (isFlip7) {
    breakdown.push({ label: 'Flip 7 bonus', value: rules.flip7Bonus })
  }
  if (selection.roundBonus !== 0) {
    breakdown.push({ label: 'Round bonus', value: selection.roundBonus })
  }

  const total = breakdown.reduce((sum, line) => sum + line.value, 0)

  return {
    total,
    busted: false,
    isFlip7,
    numberSum,
    doubled,
    breakdown,
    duplicateNumbers,
  }
}

// ---- Pure selection transforms (shared by UI and tests) -------------------

export function toggleNumber(
  selection: Flip7Selection,
  n: number,
): Flip7Selection {
  const has = selection.numbers.includes(n)
  return {
    ...selection,
    numbers: has
      ? selection.numbers.filter((value) => value !== n)
      : [...selection.numbers, n],
  }
}

export function toggleModifier(
  selection: Flip7Selection,
  modifier: Modifier,
): Flip7Selection {
  const has = selection.modifiers.includes(modifier)
  return {
    ...selection,
    modifiers: has
      ? selection.modifiers.filter((m) => m !== modifier)
      : [...selection.modifiers, modifier],
  }
}

export function toggleBust(selection: Flip7Selection): Flip7Selection {
  return { ...selection, busted: !selection.busted }
}

export function setRoundBonus(
  selection: Flip7Selection,
  value: number,
): Flip7Selection {
  return { ...selection, roundBonus: value }
}
