import { Outlet } from 'react-router'

import { SyncEngine } from '@/components/sync-engine'

import { AppHeader } from './app-header'

/**
 * The mobile-first app shell: a sticky header over a centred, phone-width
 * content column. Horizontal padding uses `max(1rem, safe-area-inset)` so the
 * base gutter is preserved and the notch/rounded corners are respected in
 * landscape.
 */
export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main"
        className="bg-primary text-primary-foreground focus-visible:ring-ring sr-only z-50 rounded-md px-4 py-2 text-sm font-medium focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:ring-2"
      >
        Skip to content
      </a>
      <AppHeader />
      <SyncEngine />
      <main
        id="main"
        className="mx-auto w-full max-w-md flex-1 pt-6 pb-safe pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
      >
        <Outlet />
      </main>
    </div>
  )
}
