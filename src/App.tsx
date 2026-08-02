import { MotionConfig } from 'framer-motion'

import { ErrorBoundary } from '@/components/error-boundary'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { AppRouter } from '@/router'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <AppRouter />
          <Toaster />
        </MotionConfig>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
