# FlipScorer — Architecture

This document explains how FlipScorer is structured and the reasoning behind
it — from the framework-free domain core out to the UI, the Connected-mode
networking, and the experimental Camera Scoring. The guiding principle
throughout is a strict separation of concerns so each layer can be tested and
evolved on its own.

## Layering

The codebase keeps four concerns deliberately separate, so business logic and
persistence never depend on the UI.

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

## Domain & game state

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

**Flip 7 Card Builder.** `src/domain/flip7.ts` is a second, self-contained pure
engine: `scoreFlip7(selection)` computes a round score from selected cards
(numbers, ±/×2 modifiers, Flip 7 bonus, bust, round bonus) and returns a
breakdown that always sums to the total. It has zero UI dependencies and is
exhaustively unit-tested. The `CardBuilder` component holds only local
selection state and calls the engine on every render; `ScoreEntryPanel` lets the
user switch between Manual and Card Builder (choice persisted in a prefs store).
Both entry modes funnel through the same `onSubmit(value)` the game screens
already use, so nothing downstream knows how the number was produced.

The **state machine** is `status: setup → playing → finished`, with rounds
advancing inside `playing` and `recordScore` auto-transitioning to `finished`
when a total reaches the target. Because transforms are pure, the whole flow is
tested without rendering.

Accessibility specifics for the game UI: custom radiogroups (colour + mode) use
the ARIA radio pattern with roving tabindex and arrow keys; drag-and-drop
(dnd-kit) announces reordering by player name; the Pass-the-Phone handoff moves
focus and announces via a polite live region.

## Archive, stats & sync-ready storage

- **Records are sync-ready.** Every game carries `createdAt` / `updatedAt` /
  `finishedAt`, a monotonic `rev` (bumped on every mutation), a `favorite`
  flag, and a `deletedAt` **soft-delete tombstone**. `touch()` centralises the
  updatedAt/rev/finishedAt lifecycle. The persisted store is versioned
  (`GAMES_SCHEMA_VERSION`) with a `migrate` that upgrades older saves in place —
  so a future backend can do last-write-wins / merge on `rev` without a data
  reshape. `deletedAt` means deletes are reconcilable rather than destructive.
- **Import/merge** (`domain/backup.ts`) validates an uploaded payload with Zod,
  normalises each game through the same `migrateGame`, and the store merges by
  `rev`/`updatedAt` (last-write-wins) — the exact operation a sync client needs.
- **Stats are derived, not stored.** `domain/stats.ts` is a pure engine that
  aggregates finished, non-deleted games by player name into per-player stats
  (win %, round extremes, averages, streaks) and cross-player records (highest
  round, longest streak, most Flip 7s / busts). The Stats page recomputes it
  with `useMemo` over the store, so it updates automatically after every game.
  Flip 7 / bust counts come from per-round `flags` recorded when a score is
  entered via the Card Builder.
- **Visualisations** are hand-built SVG/CSS (`components/stats/charts.tsx`) —
  win-rate rings, animated bars, stat tiles, record cards — theme-aware and
  dependency-free.

## Connected mode (cross-device, host-authoritative)

Connected mode lets everyone score from their own phone. The design keeps the
**game rules in one tested, transport-agnostic core** and treats the network as
a swappable detail.

- **Topology — host-authoritative star.** The host owns the one true `Game`
  (in the games store); guests hold a read-only replica and may only _request_
  their own score. Guests never talk to each other. This is the whole security
  model: a guest can't move another player, edit the past, or advance a round.
- **Pure session logic** (`src/net/host-session.ts`) decides every authority
  question — who may join, whether a score is legal, how a reconnect token maps
  to a seat — as pure functions, unit-tested without a network.
- **Controllers** (`host-controller.ts` / `guest-controller.ts`) drive the
  protocol over a `PeerLink` (a duplex string channel) and a `HostBridge`
  (the only seam to the store). Because both are abstract, the _same_ code runs
  over a real transport or the in-process mock link the tests use.
- **Protocol** (`src/net/protocol.ts`) is a small, **versioned**, Zod-validated
  JSON message set. Untrusted peer input is never trusted without parsing;
  snapshots are normalised through `migrateGame` exactly like an imported file.
- **Two transports, one interface** — the hybrid the app ships:
  - **Online: a Cloudflare Durable Object relay** (`worker/signal-room.ts`,
    one DO per room code). The host shows a QR of a join link; a guest opens it
    (a phone's camera does this natively) and the relay shuttles opaque
    messages between them. Robust reconnects/disconnects; needs internet. The
    room refuses a second `role=host` while a host is attached (so a party that
    knows the code can't supplant the authoritative host) and caps concurrent
    guests. The host only ever broadcasts to _seated_ peers, so a lurker that
    connects without joining sees no game state.
  - **Offline: serverless WebRTC over QR** (`src/net/webrtc-qr.ts`). A direct
    data channel whose offer/answer are exchanged as QR codes — **no server,
    no internet**, just a shared Wi-Fi/hotspot. ICE is gathered non-trickle so
    each SDP is a single scannable blob; scanning uses the native
    `BarcodeDetector` with a paste fallback.
- **Resilience.** Dropped sockets auto-reconnect with backoff, reusing a saved
  token so the guest reclaims its seat with scores intact; a full page reload
  auto-rejoins from the same token (`src/net/join-storage.ts`). Host-leaving,
  kicks, rejects (full / name-taken / started / version) and connection loss all
  surface as explicit guest states. A host reload ends the session; the host can
  keep scoring locally.
- **Orchestration** (`src/stores/net-store.ts`) wires transport → controllers →
  games store and mirrors just enough state into React. Non-serialisable refs
  (controllers, sockets, timers) live at module scope; only observable facts are
  in the store.

Both signaling paths were verified end-to-end in real browsers against a live
Durable Object (`wrangler dev`): join, live scoring, host receipt, round
advance, and reconnect-after-reload.

## Saved players (reusable roster)

`src/stores/roster-store.ts` is a small persisted address book. `startGame` — the
single choke point for every mode — upserts the game's (real-named) players into
it, skipping the seeded `Player N` placeholders. The setup screen then offers
one-tap re-add. Because stats aggregate by **name**, reusing saved players keeps
a person's history consistent across games.

## Camera Scoring (experimental, isolated, model-pluggable)

An opt-in feature that reads a round's cards from the device camera. It is
built to be **replaced**, not just used — the whole point is that a better model
drops in later without touching anything else.

- **Isolated module** — everything lives in `src/vision/` plus one component
  (`components/game/camera-scorer.tsx`). Nothing in the module imports UI, and
  the app depends only on the `CardRecognizer` interface and the pure mappers.
- **Pluggable recognizer** — `CardRecognizer` (`vision/types.ts`) is the single
  interface a model implements: `recognize(frame) → { cards }`, optional
  `dispose()`. `vision/recognizer.ts` is a registry; adding a new model is one
  entry with its own `create()`, and the scorer + settings pick it up. This is
  the **AI-upgrade seam** — swap the OCR for a trained detector or a hosted
  vision API with no caller changes.
- **Deterministic core is tested; the fuzzy model isn't** — `vision/parse.ts`
  (recognised text → de-duplicated card detections) and `vision/to-selection.ts`
  (detections → a `Flip7Selection`) are pure and exhaustively unit-tested. The
  only untestable part is the model itself, which is deliberately the thinnest
  possible adapter.
- **Initial model — on-device OCR** (`vision/ocr-recognizer.ts`, tesseract.js).
  It is **lazy-loaded** via a dynamic import, so the WASM engine never enters the
  main bundle and only downloads when the user first scans. The OCR engine is
  injected, so the recognizer is tested with a fake engine. Recognition is
  best-effort/experimental — number cards read as digits, modifiers as `+N`/`x2`;
  **Flip 7 is derived** from seven unique numbers by the scoring engine, and
  **Bust is a one-tap correction**.
- **Corrections guarantee accuracy** — detections seed the existing Card Builder
  (`initialSelection`), so the user confirms/edits with the same tiles, live
  total, and Save used everywhere else, and the score is computed by the same
  pure `scoreFlip7` engine. The camera is never the source of truth; the user is.
- **Off by default, user-controllable** — gated behind a `cameraScoringEnabled`
  pref (Settings → Experimental). Disabled, none of the module's code paths or
  the tesseract chunk are ever reached.

## Avatar engine (`src/avatar/`)

Players get a fun, deterministic SVG avatar generated from a tiny config.

- **Config is data, not pixels.** `AvatarConfig` (in `domain/types`) is just
  indices + hex colours. It serialises to JSON and rides inside the player
  record, so Connected mode synchronises avatars for free — **no image is ever
  transferred**, only config.
- **Deterministic pipeline.** `rng.ts` is a seeded PRNG (xmur3 → mulberry32);
  `generate.ts` turns a seed into a config with a fixed pick order, so the same
  seed always yields the same avatar and different seeds differ across many
  independent features. `normalizeAvatar` clamps every index and validates
  colours, so an untrusted synced/imported config can never break rendering.
- **Pure SVG parts.** `parts.tsx` holds one small component per feature
  (background, shirt, face, eyes, eyebrows, mouth, facial hair, glasses, hair,
  accessory, shadow, highlight, crown) on a shared 100×100 view box. Output is
  flat shapes with a shared dark outline — no gradients, filters, or raster —
  so it stays lightweight (< ~90 nodes) and cheap. `avatar.tsx` composes them,
  memoised, with a per-instance clip id.
- **Identity isn't colour-only.** Face shape, hair, and features differ by
  _form_; the avatar is `role="img"` labelled with the player's name and is
  self-contained (its own background circle) so it reads on either theme.
- **Minimal animation.** Framer Motion drives an occasional blink, a select
  bounce, a winner wiggle, a leader crown, and a bust expression — all gated on
  reduced-motion. `PlayerAvatar` renders the avatar when present and falls back
  to an initials chip otherwise, so the whole app adopts avatars incrementally.

## What's intentionally deferred

Known limitation — **host resume**: the seat table (playerId ↔ reconnect token)
lives in memory and the room code is minted per hosting session, so a host
_reload/crash_ ends the session (guests see "connection lost"); guest reconnects
survive host _disconnects_ but not host restarts. Persisting the seat table and
resuming the same room code would make host resume symmetric with guest resume.

Future work: host resume (above); token-based host authentication at the relay
(the current guard refuses a concurrent second host, which covers the common
case); a WebRTC upgrade on the online path (so play continues P2P/LAN even after
the relay is used for join); per-round history in the guest UI; richer stats; and
a configurable win rule (currently highest-total-at-target). The pure domain and
`PeerLink`/transport seams are where these slot in without touching the rest.
