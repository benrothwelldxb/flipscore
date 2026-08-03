import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// A heavier E2E project than playwright.config.ts: instead of `vite preview`
// serving static files, this runs the real Worker under `wrangler dev` (with a
// migrated local D1), so the live Cloud Accounts API — passwordless sign-in and
// last-write-wins library sync — is exercised end to end. Run with:
//
//   npm run test:e2e:full
//
// The Worker's console-email mode echoes the sign-in code back in the API
// response on a local origin, which the tests use to complete sign-in without a
// real mailbox.

const PORT = 8788
const baseURL = `http://localhost:${PORT}`

const preinstalledChromium =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const executablePath =
  !process.env.CI && existsSync(preinstalledChromium)
    ? preinstalledChromium
    : undefined

export default defineConfig({
  testDir: './e2e-full',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Mobile Chrome (live API)',
      use: {
        ...devices['Pixel 5'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    // Build the SPA, migrate + reset the local D1, then serve both the assets
    // and the Worker from one origin via `wrangler dev`.
    command: `npm run build && node scripts/migrate-local.mjs && npx wrangler dev --port ${PORT} --local`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
