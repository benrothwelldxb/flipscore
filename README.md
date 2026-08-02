# FlipScorer

A mobile-first, card-game-inspired **scorekeeper**, built as an installable
Progressive Web App.

> **Status:** deployable. Create games, manage players, and keep score in three
> modes: **Host Scorekeeper**, **Pass the Phone**, and **Connected** (everyone
> scores live from their own phone).

## Features

- **Three game modes** — Host Scorekeeper (one device sees all scores), the
  flagship Pass the Phone (per-player, one-handed, animated handoffs), and
  Connected (each player joins from their own phone and enters only their own
  score, with the host authoritative).
- **Connected mode** — players join by scanning a QR / opening a link (online,
  via a Cloudflare Durable Object relay) or by a serverless **WebRTC-over-QR**
  handshake that needs **no internet** on a shared Wi-Fi. Handles reconnects,
  disconnects, host-leaving, and connection loss; a dropped or reloaded player
  reclaims their seat automatically.
- **Saved players** — games remember the players they start with, so the next
  game adds a whole roster back with one tap (and keeps stats consistent).
- **Camera Scoring (experimental, opt-in)** — point the camera at your cards to
  detect numbers and modifiers; the detections seed the Card Builder so you
  confirm/correct and the score is computed automatically. Built behind a
  pluggable recognizer interface so the model can be upgraded later; the OCR
  engine is lazy-loaded and the feature is off by default (Settings →
  Experimental).
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
- **Undo & round editing** — undo the last action, and edit, delete, or replay
  any past round.
- **Delightful & tactile** — animated leaderboards with medals and count-up
  totals, a winner confetti burst + fanfare, and optional sound / haptics you
  control in Settings (reduced-motion respected throughout).
- **Archive & backup** — every finished game is stored; search, favourite,
  replay, duplicate, delete, and export / import your whole history as JSON.
  Games use versioned, soft-deletable records (a `rev` counter + timestamps)
  ready for future cloud sync.
- **Player statistics** — games played / won, win %, highest & lowest round,
  average score and finishing position, longest win streak, most Flip 7
  bonuses and busts — with hand-built, theme-aware charts that update
  automatically after every game.
- **Installable PWA** — works offline, no account needed. Maskable icons,
  shortcuts, social sharing image, and iOS launch screens.
- **Accessible & fast** — Lighthouse (mobile, throttled) ≈ 93 performance ·
  100 accessibility · 100 best-practices · 100 SEO; zero serious/critical axe
  violations across the core screens.

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
| `npm run generate:icons` | Regenerate icons/wordmark from ./brand sources |
| `npm run validate`       | typecheck + lint + format:check + test + build |

## Project structure

```
src/
  domain/         # framework-free core: scoring, game state machine, Flip 7
                  #   engine, stats, validation, backup — exhaustively tested
  net/            # Connected mode: protocol, host/guest sessions, transports
                  #   (relay + WebRTC-QR), controllers — transport-agnostic core
  vision/         # Camera Scoring: pluggable recognizer, OCR, pure parsers
  stores/         # Zustand stores (game, net, roster, prefs, theme)
  components/
    game/         # setup, host/pass/connected screens, card builder, scorer
    stats/        # hand-built SVG/CSS charts
    net/          # QR code + scanner
    brand/ layout/ theme/ ui/   # brand art, app shell, theming, shadcn/ui
  pages/          # route screens (home, join, game, archive, stats, 404)
  lib/            # framework-agnostic helpers (cn, id, haptics, sound, …)
  router.tsx  App.tsx  main.tsx
worker/           # Cloudflare Worker + SignalRoom Durable Object (relay)
e2e/              # Playwright specs
scripts/          # build-time tooling (icon / OG / splash generation)
```

## Deploy (Cloudflare)

The app is a static SPA — build once and serve `dist/`. Both Cloudflare
products work; pick one.

**Worker + static assets + relay (matches `wrangler.toml`)**

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- The Worker serves `./dist` as assets with
  `not_found_handling = "single-page-application"` (handles client-side routing,
  so **no `_redirects` file is used**) and hosts the Connected-mode signaling
  relay — a `SignalRoom` Durable Object at `/rtc/<code>`. The DO keeps no
  persistent storage, so its SQLite-backed class works on the Workers free plan.
- Local dev with the relay: `npm run build && npx wrangler dev` (Connected
  online mode needs the Worker; the plain Vite dev server serves the SPA only).
- The Worker name in `wrangler.toml` must match your Worker (`flipscorer`).
- Connected **offline** mode is pure peer-to-peer (WebRTC + QR) and needs no
  server at all.

This is the **recommended** deploy — it's the only one that hosts the online
Connected relay.

**Pages (alternative — static)**

- Everything works on Pages **except online Connected mode** (its relay is a
  Durable Object, hosted only by the Worker). Offline Connected (WebRTC + QR)
  still works.
- Build: `npm run build`, output `dist`. For SPA routing add a `dist/_redirects`
  with `/* /index.html 200` (the deploy workflow injects this; don't commit it
  to `public/`, or the Worker assets deploy rejects it as a loop).
- CLI: `npx wrangler pages deploy dist --project-name=<your-project>`.

**CI/CD** — `.github/workflows/`:

- `ci.yml` runs the full gate (type-check, lint, format check, coverage tests,
  build) plus Playwright e2e on every push and PR.
- `deploy.yml` publishes the Worker (recommended); `deploy-pages.yml` publishes
  to Pages. Both are manual (`workflow_dispatch`) and need `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID` secrets.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the design rationale and
[`CHANGELOG.md`](./CHANGELOG.md) for release notes.
