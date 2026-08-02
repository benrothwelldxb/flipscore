# FlipScore

A mobile-first, card-game-inspired **scorekeeper**, built as an installable
Progressive Web App.

> **Status:** v1.0 — deployable. Create games, manage players, and keep score
> in two modes: **Host Scorekeeper** and **Pass the Phone**. (Connected /
> cross-device mode is stubbed as "coming soon".)

## Features

- **Two game modes** — Host Scorekeeper (one device sees all scores) and the
  flagship Pass the Phone (per-player, one-handed, animated handoffs).
- **Game setup** — 2–12 players, add / edit / remove, drag-and-drop ordering,
  colour selection, initials avatars, target score (default 200).
- **Live scoring** — running totals, ranked leaderboard, current-leader
  highlighting, winner detection, end-game flow.
- **Flip 7 Card Builder** — an optional card-selection scorer (number cards,
  ±/×2 modifiers, Flip 7 bonus, bust, round bonus) with a live total and
  calculation breakdown, alongside manual entry. The scoring engine is pure and
  exhaustively unit-tested.
- **Persistence** — games auto-save to localStorage; resume unfinished games or
  delete them from the launcher.
- **Installable PWA** — works offline, no account needed.
- **Accessible & fast** — Lighthouse 96 / 100 / 100 / 100
  (performance / a11y / best-practices / SEO).

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

## Deploy (Cloudflare Pages)

The app is a static SPA — build once and serve `dist/`.

- **Build command:** `npm run build`
- **Output directory:** `dist`
- SPA routing + caching headers ship via `public/_redirects` and
  `public/_headers`; `wrangler.toml` sets `pages_build_output_dir = "dist"`.

**Dashboard:** create a Pages project from this repo with the build command and
output directory above.

**CLI:** `npx wrangler pages deploy dist --project-name=flipscore`

**CI:** the `Deploy` workflow (`.github/workflows/deploy.yml`) publishes on
manual dispatch once `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
repository secrets are set.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the design rationale.
