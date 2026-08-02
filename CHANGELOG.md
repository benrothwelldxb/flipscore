# Changelog

All notable changes to FlipScorer are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] — Initial public release

The first public release: a mobile-first, installable scorekeeper for the card
game **Flip 7**.

### Game modes

- **Host Scorekeeper** — one device tracks every player's score.
- **Pass the Phone** — each player enters their own score, then passes on;
  one-handed, animated handoffs.
- **Connected** — everyone joins from their own phone and enters only their own
  score, with the host authoritative. Online via a Cloudflare Durable Object
  relay (scan a QR / open a link), or fully offline via serverless WebRTC over
  QR (no internet, same Wi-Fi). Handles reconnects, disconnects, host-leaving,
  and connection loss.

### Scoring

- **Flip 7 Card Builder** — pick number, modifier (`+N`/`×2`) cards, round
  bonus, and Bust, with a live total, calculation breakdown, and card colours
  that match the real deck. Pure, exhaustively-tested scoring engine.
- **Manual entry** — big numeric field, quick-adds, and a one-tap Bust (0).
- **Experimental Camera Scoring** (opt-in) — point the camera at your cards to
  detect numbers and modifiers; detections seed the Card Builder for correction.
  Built behind a pluggable recognizer interface for future model upgrades; the
  OCR engine is lazy-loaded.

### Around the game

- **Saved players** — games remember their roster for one-tap reuse next time.
- **Undo & round editing** — undo the last action; edit, delete, or replay any
  round.
- **Archive & backup** — every finished game is stored; search, favourite,
  replay, duplicate, delete, and export / import your history as JSON. Records
  are versioned and soft-deletable, ready for cloud sync.
- **Player statistics** — games played / won, win %, round extremes, averages,
  finishing position, win streaks, Flip 7s and busts, with hand-built charts
  that update automatically.

### Craft

- **Delightful** — animated leaderboards, count-up totals, a winner confetti
  burst + fanfare, and optional sound / haptics you control (reduced-motion
  respected throughout).
- **Installable PWA** — works offline, no account needed. Maskable icons,
  shortcuts, social sharing image, and iOS launch screens.
- **Accessible** — keyboard-navigable custom controls (ARIA radio patterns),
  live-region announcements, and labelled interactive elements.
- **Themed** — light / dark / system with no flash on load.

### Engineering

- React 19 + TypeScript 6 (strict), Vite 8, Tailwind v4, shadcn/ui, Zustand,
  React Router 8, Framer Motion, Zod.
- A framework-free, exhaustively unit-tested domain layer (scoring, state
  machine, Flip 7 engine, stats, networking protocol, card parsing).
- Full quality gate in CI: type-check, lint, format check, unit tests with
  coverage, build, and Playwright end-to-end tests.
