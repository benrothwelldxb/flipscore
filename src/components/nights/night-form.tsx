import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface NightFormValues {
  name: string
  venue: string
  /** Epoch ms (local midnight of the chosen day). */
  date: number
  notes: string
}

function toDateInput(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fromDateInput(value: string): number {
  if (!value) return Date.now()
  const ms = new Date(`${value}T00:00:00`).getTime()
  return Number.isNaN(ms) ? Date.now() : ms
}

interface NightFormProps {
  trigger: ReactNode
  title: string
  submitLabel: string
  initial?: Partial<NightFormValues>
  onSubmit: (values: NightFormValues) => void
}

/** Create/edit dialog for a Game Night's occasion details. */
export function NightForm({
  trigger,
  title,
  submitLabel,
  initial,
  onSubmit,
}: NightFormProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initial?.name ?? '')
  const [venue, setVenue] = useState(initial?.venue ?? '')
  const [date, setDate] = useState(() => initial?.date ?? Date.now())
  const [notes, setNotes] = useState(initial?.notes ?? '')

  function submit() {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), venue, date, notes })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="night-name">Name</Label>
            <Input
              id="night-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday Night, Christmas, Pub Night…"
              maxLength={40}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="night-date">Date</Label>
              <Input
                id="night-date"
                type="date"
                value={toDateInput(date)}
                onChange={(e) => setDate(fromDateInput(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="night-venue">Venue</Label>
              <Input
                id="night-venue"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Optional"
                maxLength={40}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="night-notes">Notes</Label>
            <textarea
              id="night-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={2}
              maxLength={280}
              className="border-input bg-transparent focus-visible:ring-ring/50 min-h-16 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={!name.trim()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
