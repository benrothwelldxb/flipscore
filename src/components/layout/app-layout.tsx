import { Outlet } from 'react-router'

import { AppHeader } from './app-header'

/**
 * The mobile-first app shell: a sticky header over a centred, phone-width
 * content column, with the device safe-areas respected on every edge.
 */
export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-safe px-safe pt-6">
        <Outlet />
      </main>
    </div>
  )
}
