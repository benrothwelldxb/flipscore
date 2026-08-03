// Prepare a FRESH local D1 database for the wrangler-dev-backed E2E project
// (playwright.full.config.ts). Each run starts from an empty database so tests
// are deterministic and migrations apply cleanly.
//
//   node scripts/migrate-local.mjs
//
// The migrations aren't idempotent (0002 does an `ALTER TABLE … ADD COLUMN`,
// which SQLite can't guard with IF NOT EXISTS), so re-applying them onto an
// existing DB fails. We instead delete wrangler's local state and re-migrate.
// This only ever touches the LOCAL `--local` D1 that `wrangler dev` uses — it
// never talks to a remote database.

import { execFileSync } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'migrations')
const DB = 'flipscorer'

// Drop wrangler's local dev state (D1/KV/DO) for a clean slate.
console.log('[migrate-local] clearing .wrangler/state')
rmSync(join(root, '.wrangler', 'state'), { recursive: true, force: true })

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

for (const file of files) {
  console.log(`[migrate-local] applying ${file}`)
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB, '--local', `--file=./migrations/${file}`],
    { cwd: root, stdio: 'inherit' },
  )
}

console.log('[migrate-local] done')
