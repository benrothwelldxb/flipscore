import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { validateScoreInput } from '@/domain/validation'
import { vibrate } from '@/lib/haptics'

interface ScoreEntryProps {
  onSubmit: (value: number) => void
  submitLabel?: string
  autoFocus?: boolean
}

const QUICK_ADDS = [1, 5, 10, 25]

/** One-handed manual score entry: big numeric field, quick-adds, validation. */
export function ScoreEntry({
  onSubmit,
  submitLabel = 'Save score',
  autoFocus = true,
}: ScoreEntryProps) {
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)

  const current = () => (/^-?\d+$/.test(raw.trim()) ? parseInt(raw, 10) : 0)

  const bump = (amount: number) => {
    setRaw(String(current() + amount))
    setError(null)
    vibrate(5)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = validateScoreInput(raw)
    if (!result.valid) {
      setError(result.error)
      return
    }
    vibrate(12)
    onSubmit(result.value)
    setRaw('')
    setError(null)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        inputMode="numeric"
        pattern="-?[0-9]*"
        value={raw}
        onChange={(event) => {
          setRaw(event.target.value)
          setError(null)
        }}
        placeholder="0"
        aria-label="Score for this round"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'score-error' : undefined}
        autoFocus={autoFocus}
        className="h-16 text-center text-3xl font-bold"
      />
      {error && (
        <p
          id="score-error"
          role="alert"
          className="text-destructive text-center text-sm"
        >
          {error}
        </p>
      )}
      <div className="grid grid-cols-4 gap-2">
        {QUICK_ADDS.map((amount) => (
          <Button
            key={amount}
            type="button"
            variant="secondary"
            onClick={() => bump(amount)}
            aria-label={`Add ${amount}`}
          >
            +{amount}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => bump(-5)}
          aria-label="Minus 5"
        >
          −5
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setRaw('')
            setError(null)
          }}
        >
          Clear
        </Button>
      </div>
      <Button type="submit" size="lg" className="h-14 text-base">
        {submitLabel}
      </Button>
    </form>
  )
}
