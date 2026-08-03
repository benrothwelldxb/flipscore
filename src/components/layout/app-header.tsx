import { useState } from 'react'
import { Link } from 'react-router'
import { HelpCircle } from 'lucide-react'

import { Wordmark } from '@/components/brand/wordmark'
import { HowToPlay } from '@/components/onboarding/how-to-play'
import { SettingsDialog } from '@/components/settings-dialog'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Button } from '@/components/ui/button'
import { useIntroSeen, usePrefsStore } from '@/stores/prefs-store'

export function AppHeader() {
  const introSeen = useIntroSeen()
  const setIntroSeen = usePrefsStore((s) => s.setIntroSeen)
  // Opens automatically on first ever launch; the "?" button reopens it later.
  const [helpOpen, setHelpOpen] = useState(!introSeen)

  return (
    <header className="pt-safe bg-background/80 sticky top-0 z-40 border-b backdrop-blur-lg">
      <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
        <Link
          to="/"
          className="focus-visible:ring-ring/50 -m-1 flex items-center rounded-md p-1 outline-none focus-visible:ring-[3px]"
          aria-label="FlipScorer home"
        >
          <Wordmark className="h-7 w-auto" alt="" />
        </Link>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="How to play"
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle className="size-5" />
          </Button>
          <ThemeToggle />
          <SettingsDialog />
        </div>
      </div>

      <HowToPlay
        open={helpOpen}
        onOpenChange={(open) => {
          setHelpOpen(open)
          if (!open && !introSeen) setIntroSeen(true)
        }}
      />
    </header>
  )
}
