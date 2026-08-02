import { Link } from 'react-router'

import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/theme/theme-toggle'

export function AppHeader() {
  return (
    <header className="pt-safe bg-background/80 sticky top-0 z-40 border-b backdrop-blur-lg">
      <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
        <Link
          to="/"
          className="focus-visible:ring-ring/50 flex items-center gap-2 rounded-md font-semibold outline-none focus-visible:ring-[3px]"
          aria-label="FlipScore home"
        >
          <Logo className="size-7" decorative />
          <span className="text-base tracking-tight">FlipScore</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  )
}
