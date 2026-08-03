import { lazy } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { RouteErrorFallback } from '@/components/route-error'
import { HomePage } from '@/pages/home'

// The landing page loads eagerly (it's the first paint); every other route is
// code-split so the initial bundle stays small. Pages use named exports, so we
// adapt them to the default export React.lazy expects.
const AlbumPage = lazy(() =>
  import('@/pages/album').then((m) => ({ default: m.AlbumPage })),
)
const ArchivePage = lazy(() =>
  import('@/pages/archive').then((m) => ({ default: m.ArchivePage })),
)
const FriendsPage = lazy(() =>
  import('@/pages/friends').then((m) => ({ default: m.FriendsPage })),
)
const GamePage = lazy(() =>
  import('@/pages/game').then((m) => ({ default: m.GamePage })),
)
const JoinPage = lazy(() =>
  import('@/pages/join').then((m) => ({ default: m.JoinPage })),
)
const NightPage = lazy(() =>
  import('@/pages/night').then((m) => ({ default: m.NightPage })),
)
const NightsPage = lazy(() =>
  import('@/pages/nights').then((m) => ({ default: m.NightsPage })),
)
const PlayerPage = lazy(() =>
  import('@/pages/player').then((m) => ({ default: m.PlayerPage })),
)
const StatsPage = lazy(() =>
  import('@/pages/stats').then((m) => ({ default: m.StatsPage })),
)
const NotFoundPage = lazy(() =>
  import('@/pages/not-found').then((m) => ({ default: m.NotFoundPage })),
)

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'join', element: <JoinPage /> },
      { path: 'game/:id', element: <GamePage /> },
      { path: 'archive', element: <ArchivePage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'album', element: <AlbumPage /> },
      { path: 'nights', element: <NightsPage /> },
      { path: 'night/:id', element: <NightPage /> },
      { path: 'friends', element: <FriendsPage /> },
      { path: 'player/:name', element: <PlayerPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
