# FlipScore — Architecture

This document explains how the foundation is structured and the reasoning
behind it. The goal for this phase was a small, correct, well-separated base
that later phases (the scoring engine, game setup, history) can extend without
re-plumbing.

## Layering

The codebase keeps four concerns deliberately separate. This phase only
populates the outer layers; the split is set up so business logic and
persistence can land next without touching UI.

```
UI (components, pages)
        │  reads state, dispatches actions
        ▼
State (Zustand stores)  ◄── Persistence (localStorage via persist middleware)
        │  calls
        ▼
Business logic (pure functions in lib/ and stores)
```

- **UI** — `components/` and `pages/`. Presentational and screen components.
  They never talk to `localStorage` or contain domain rules; they read from
  stores and call actions.
- **State** — `stores/`. Zustand stores are the single source of truth. The
  theme store is the reference implementation for the pattern later stores will
  follow.
- **Business logic** — pure, testable functions (e.g. `resolveTheme`,
  `getSystemTheme`, `cn`). Framework-free, so they are trivial to unit test.
- **Persistence** — Zustand's `persist` middleware. `partialize` controls
  exactly what is written, so derived values never get serialised.

## Key decisions

### Theming (light / dark / system)

- The store holds the user's **choice** (`light | dark | system`) and the
  **resolved** scheme actually applied. Only the choice is persisted; the
  resolved value is derived at runtime.
- `ThemeProvider` is the single place that touches the DOM: it toggles the
  `.dark` class and `color-scheme` on `<html>`, and subscribes to the OS
  `prefers-color-scheme` change while on "system".
- Colours are authored as **oklch** design tokens in `index.css` for
  perceptually consistent light/dark pairs, mapped into Tailwind v4 via
  `@theme inline`. A card-deck-inspired `--suit-*` accent set is defined for
  future game UI.

### Routing

React Router 8's data router (`createBrowserRouter`) with a single `AppLayout`
shell and a catch-all 404. The router is exported as an `AppRouter` component so
route definitions stay in one file and fast-refresh stays clean.

### Resilience

- An `ErrorBoundary` wraps the whole tree and shows a friendly, actionable
  fallback instead of a white screen — persisted data is never at risk.
- The `main.tsx` entry fails loudly if `#root` is missing rather than silently
  no-op'ing.

### Toasts

Sonner is wrapped in a local `Toaster` (theme-aware, safe-area-offset) and
exposed only through a `useToast` hook, so feature code never imports the toast
library directly — the implementation can be swapped without touching callers.

### Component kit

shadcn/ui primitives (`button`, `card`, `dialog`, `sonner`) live under
`components/ui`. They are owned source (not a dependency), styled via the design
tokens, and the fast-refresh lint rule is relaxed there because they
intentionally co-locate variant helpers with components.

### Mobile-first & PWA

- Layout is a centred, phone-width column. Safe-area utilities
  (`pt-safe`, `pb-safe`, `px-safe`) wire padding to `env(safe-area-inset-*)`,
  and the viewport uses `viewport-fit=cover`.
- `vite-plugin-pwa` (Workbox `generateSW`) precaches the shell for offline use;
  the manifest + generated icon set make the app installable.
- `prefers-reduced-motion` is honoured globally in the base layer.

## Build & quality gates

`npm run validate` runs the full gate: **typecheck → lint → format check →
unit tests → build**. Playwright e2e runs separately (`npm run test:e2e`) and in
CI. Production vendors are split (`react-vendor`, `motion-vendor`) so the
long-lived libraries cache independently of app code.

## Domain & game state (v1.0)

The game engine follows the same UI / logic / state / persistence split.

- **`src/domain/`** — framework-free core. `types.ts` (Game, Player, Round,
  Score, GameSettings, GameMode, LeaderboardEntry), `scoring.ts` (totals,
  leaderboard, leader, winner detection — all pure), `game.ts` (factories +
  pure state-machine transforms: `startGame`, `recordScore`, `advanceRound`,
  `finishGame`, `reorderPlayers`), `validation.ts` (Zod schemas +
  `validateScoreInput`), and `colors.ts` (player palette + contrast helper).
  This layer has no React and is exhaustively unit-tested.
- **`src/stores/game-store.ts`** — the Zustand store is a thin state-machine
  driver: every action maps over `games`, applies a pure transform from
  `domain/game`, and stamps `updatedAt`. Persistence uses the same versioned
  `persist` pattern as the theme store; `hasHydrated` gates screens on a
  loading state until localStorage is read back.
- **UI** — screens under `components/game/` (`setup-screen`, `host-screen`,
  `pass-the-phone-screen`, `results-screen`) are dispatched by
  `pages/game.tsx` off `game.status` + `settings.mode`. They read the game via
  selector hooks and call store actions; no domain logic lives in components.

The **state machine** is `status: setup → playing → finished`, with rounds
advancing inside `playing` and `recordScore` auto-transitioning to `finished`
when a total reaches the target. Because transforms are pure, the whole flow is
tested without rendering.

Accessibility specifics for the game UI: custom radiogroups (colour + mode) use
the ARIA radio pattern with roving tabindex and arrow keys; drag-and-drop
(dnd-kit) announces reordering by player name; the Pass-the-Phone handoff moves
focus and announces via a polite live region.

## What's intentionally deferred

**Connected mode** (real-time cross-device scoring) is stubbed in the UI as
"coming soon" — it needs a sync backend and is out of scope for v1.0. Other
future work: per-round score history/undo in the UI, richer stats, and a
configurable win rule (currently highest-total-at-target). The domain layer is
the seam these slot into without touching UI.
