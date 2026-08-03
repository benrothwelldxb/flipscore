import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import '@/index.css'

// Vite fires this when a lazy chunk (or its CSS) fails to preload — typically a
// stale build after a deploy. Reload once (sharing the route-error guard flag)
// to fetch the current manifest; a genuinely broken deploy won't loop.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('fs-chunk-reloaded')) {
    sessionStorage.setItem('fs-chunk-reloaded', '1')
    window.location.reload()
  }
})

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found in the document.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
