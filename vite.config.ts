import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = createRequire(import.meta.url)('./package.json') as {
  version: string
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'FlipScorer — Flip 7 scorekeeper',
        short_name: 'FlipScorer',
        description:
          'A fast, mobile-first scorekeeper for the card game Flip 7 — Host, Pass-the-Phone, and Connected play, a Card Builder, and stats. Installable and works offline.',
        lang: 'en',
        dir: 'ltr',
        theme_color: '#7c3aed',
        background_color: '#0d0b3d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['games', 'utilities', 'entertainment'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'New game',
            short_name: 'New game',
            url: '/?new=1',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Join a game',
            short_name: 'Join',
            url: '/join',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Stats',
            short_name: 'Stats',
            url: '/stats',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
        ],
        screenshots: [
          {
            src: 'screenshots/home.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'FlipScorer home',
          },
          {
            src: 'screenshots/play.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Live scoring',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Keep large social / launch / screenshot art out of the offline
        // precache — they're fetched on demand, not needed for the app shell.
        globIgnores: [
          '**/splash-*.png',
          '**/og-image.png',
          '**/screenshots/*.png',
        ],
      },
      // Keep the service worker out of the way during dev + tests.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split large, rarely-changing vendors into their own cacheable chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('framer-motion')) return 'motion-vendor'
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor'
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      exclude: [
        ...(configDefaults.coverage.exclude ?? []),
        'e2e/**',
        'scripts/**',
        '**/*.config.*',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/test/**',
        'src/components/ui/**',
      ],
    },
  },
})
