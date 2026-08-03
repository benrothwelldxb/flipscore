import { createBrowserRouter, RouterProvider } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { RouteErrorFallback } from '@/components/route-error'
import { AlbumPage } from '@/pages/album'
import { ArchivePage } from '@/pages/archive'
import { FriendsPage } from '@/pages/friends'
import { GamePage } from '@/pages/game'
import { HomePage } from '@/pages/home'
import { JoinPage } from '@/pages/join'
import { NightPage } from '@/pages/night'
import { NightsPage } from '@/pages/nights'
import { NotFoundPage } from '@/pages/not-found'
import { PlayerPage } from '@/pages/player'
import { StatsPage } from '@/pages/stats'

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
