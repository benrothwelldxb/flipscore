import {
  Ban,
  Layers,
  Shield,
  Snowflake,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Rule {
  icon: LucideIcon
  title: string
  body: string
  className: string
}

const RULES: Rule[] = [
  {
    icon: Target,
    title: 'Race to the target',
    body: 'Each round you add up the number cards you keep. First player to the target score (200 by default) wins.',
    className: 'text-primary',
  },
  {
    icon: Ban,
    title: 'Bust = zero',
    body: 'Flip a number you already have and you bust — you score nothing that round. Stop and bank while you’re ahead.',
    className: 'text-destructive',
  },
  {
    icon: Sparkles,
    title: 'Flip 7 bonus',
    body: 'Collect 7 different number cards in one round to end it early and bag a +15 bonus.',
    className: 'text-primary',
  },
  {
    icon: Snowflake,
    title: 'Freeze',
    body: 'Banks a player’s points safely — they’re locked in and sit out the rest of the round.',
    className: 'text-sky-500',
  },
  {
    icon: Layers,
    title: 'Flip Three',
    body: 'Forces three more flips in a row — a gamble that can push a big round or a bust.',
    className: 'text-amber-500',
  },
  {
    icon: Shield,
    title: 'Second Chance',
    body: 'Survive one bust: the duplicate is discarded and play continues.',
    className: 'text-emerald-500',
  },
]

/** A controlled dialog explaining Flip 7 and how to score it in the app. */
export function HowToPlay({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How to play Flip 7</DialogTitle>
          <DialogDescription>
            Push your luck, avoid the bust, and be first to the target.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-3">
          {RULES.map(({ icon: Icon, title, body, className }) => (
            <li key={title} className="flex gap-3">
              <Icon
                className={`mt-0.5 size-5 shrink-0 ${className}`}
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-muted-foreground text-sm">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm font-medium">Scoring a round</p>
          <p className="text-muted-foreground text-sm">
            Tap a player to enter their round total. Type it in with{' '}
            <span className="font-medium">Manual</span>, tap the cards you kept
            with the <span className="font-medium">Card Builder</span> (it adds
            up modifiers and the Flip 7 bonus for you), or try the experimental{' '}
            <span className="font-medium">Camera</span>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
