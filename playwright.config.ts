import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const baseURL = `http://localhost:${PORT}`

// In CI we install browsers via `playwright install`. In sandboxes that ship a
// pre-installed Chromium (e.g. Claude Code on the web), point at it directly so
// the bundled-browser version check is bypassed. Override with
// PLAYWRIGHT_CHROMIUM_PATH if needed.
const preinstalledChromium =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const executablePath =
  !process.env.CI && existsSync(preinstalledChromium)
    ? preinstalledChromium
    : undefined

/**
 * Playwright runs against the production build served by `vite preview`,
 * which mirrors what ships to users (including the PWA service worker).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    // Build first so e2e always runs against a fresh production bundle.
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
