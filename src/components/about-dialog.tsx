import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface AboutDialogProps {
  /** Custom trigger; defaults to a subtle "About" text button. */
  trigger?: ReactNode
}

/** Credits + the (unofficial) companion-app disclaimer. */
export function AboutDialog({ trigger }: AboutDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded text-xs underline underline-offset-2 outline-none focus-visible:ring-2"
          >
            About &amp; credits
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[88svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>About FlipScorer</DialogTitle>
          <DialogDescription>
            An unofficial companion scorekeeper for Flip 7. Version{' '}
            {__APP_VERSION__}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 text-sm">
          <section className="space-y-3">
            <p className="font-semibold">
              Made by Ben Rothwell &amp; Billy Regan · 2026
            </p>
            <div className="text-muted-foreground space-y-3">
              <p>
                <span className="text-foreground font-medium">
                  Ben Rothwell
                </span>{' '}
                is a Principal of an international school in Dubai and a
                part-time enthusiast software developer.
              </p>
              <p>
                <span className="text-foreground font-medium">Billy Regan</span>{' '}
                is 8 years old, from London, and an avid Arsenal fan. He&apos;s
                keen to follow in Uncle Ben&apos;s footsteps, and contributed
                the ideas for all of the app&apos;s features — and the
                inspiration for the app itself — through his love of Flip 7™.
              </p>
            </div>
          </section>

          <section className="border-t pt-4">
            <h3 className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">
              The story
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The summer of 2026 found an uncle and his nephew sharing a love of
              Flip 7 and a growing interest in coding. One afternoon on a beach
              in Skiathos, they came together to dream up a scorekeeper for
              their favourite game — Billy inventing the features, Ben writing
              the code — and FlipScorer was born.
            </p>
          </section>

          <section className="border-t pt-4">
            <h3 className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">
              Disclaimer
            </h3>
            <p className="text-muted-foreground text-xs leading-relaxed">
              FlipScorer is an unofficial, fan-made companion app for keeping
              score. It is not affiliated with, endorsed by, sponsored by, or
              associated with <strong>Flip 7™</strong>, its designer{' '}
              <strong>Eric Olsen</strong>, or <strong>The Op Games</strong>.
              Flip 7 and all related names and marks are trademarks of their
              respective owners, used here only to describe the game this app
              helps you score.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
