# FlipScore

A mobile-first, card-game-inspired **scorekeeper**, built as an installable
Progressive Web App.

> **Status:** Foundation phase. The app shell, theming, navigation, and shared
> component kit are in place. Scoring and game management arrive in later
> phases.

## Tech stack

| Concern       | Choice                                  |
| ------------- | --------------------------------------- |
| Build tool    | Vite 8                                  |
| UI            | React 19 + TypeScript 6                 |
| Styling       | Tailwind CSS v4 + shadcn/ui (new-york)  |
| State         | Zustand (with `persist`)                |
| Routing       | React Router 8 (data router)            |
| Animation     | Framer Motion                           |
| Forms         | React Hook Form + Zod (wired for later) |
| Toasts        | Sonner                                  |
| PWA           | vite-plugin-pwa (Workbox)               |
| Unit tests    | Vitest + Testing Library                |
| E2E tests     | Playwright (mobile Chrome)              |
| Lint / format | ESLint (flat config) + Prettier         |

## Getting started

```bash
npm install
npm run dev          # start the dev server
```

## Scripts

| Script                   | What it does                                   |
| ------------------------ | ---------------------------------------------- |
| `npm run dev`            | Vite dev server                                |
| `npm run build`          | Type-check (`tsc -b`) then production build    |
| `npm run preview`        | Serve the production build locally             |
| `npm run typecheck`      | Type-check without emitting                    |
| `npm run lint`           | ESLint over the whole project                  |
| `npm run format`         | Prettier write                                 |
| `npm run test`           | Unit tests (Vitest)                            |
| `npm run test:coverage`  | Unit tests with V8 coverage                    |
| `npm run test:e2e`       | End-to-end tests (Playwright)                  |
| `npm run generate:icons` | Regenerate the PWA icon set from the SVG mark  |
| `npm run validate`       | typecheck + lint + format:check + test + build |

## Project structure

```
src/
  components/
    brand/        # logo mark
    layout/       # app shell (header + layout)
    theme/        # theme provider + toggle
    ui/           # shadcn/ui primitives (button, card, dialog, toaster)
    error-boundary.tsx
  hooks/          # app-level hooks (use-toast)
  lib/            # framework-agnostic helpers (cn)
  pages/          # route screens (home, not-found)
  stores/         # Zustand stores (theme)
  test/           # test setup
  router.tsx      # route table
  App.tsx         # providers + router composition
  main.tsx        # entry point
e2e/              # Playwright specs
scripts/          # build-time tooling (icon generation)
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the design rationale.
