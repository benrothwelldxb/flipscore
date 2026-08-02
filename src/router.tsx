import { createBrowserRouter, RouterProvider } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { RouteErrorFallback } from '@/components/route-error'
import { ArchivePage } from '@/pages/archive'
import { GamePage } from '@/pages/game'
import { HomePage } from '@/pages/home'
import { JoinPage } from '@/pages/join'
import { NotFoundPage } from '@/pages/not-found'
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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
