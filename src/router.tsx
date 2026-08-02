import { createBrowserRouter, RouterProvider } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { RouteErrorFallback } from '@/components/route-error'
import { HomePage } from '@/pages/home'
import { NotFoundPage } from '@/pages/not-found'

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
