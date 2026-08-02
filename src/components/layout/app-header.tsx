import { Link } from 'react-router'

import { Wordmark } from '@/components/brand/wordmark'
import { SettingsDialog } from '@/components/settings-dialog'
import { ThemeToggle } from '@/components/theme/theme-toggle'

export function AppHeader() {
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
          <ThemeToggle />
          <SettingsDialog />
        </div>
      </div>
    </header>
  )
}
