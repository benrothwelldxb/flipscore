// Apply every migration to the REMOTE (production) D1 database, in order.
//
//   node scripts/migrate-remote.mjs
//
// Run this ONCE, on first deploy (or whenever you add a new migration — then
// only the new file should be applied; see the note below). The migrations are
// not idempotent (0002 does an `ALTER TABLE … ADD COLUMN`, which SQLite can't
// guard with IF NOT EXISTS), so re-applying an already-applied migration errors.
// For an incremental change, run just the new file:
//
//   npx wrangler d1 execute flipscorer --remote --file=./migrations/000N_*.sql
//
// Requires wrangler to be authenticated (`wrangler login`) and wrangler.toml's
// database_id to point at your real D1 database.

import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'migrations')
const DB = 'flipscorer'

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

for (const file of files) {
  console.log(`[migrate-remote] applying ${file}`)
  execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      DB,
      '--remote',
      `--file=./migrations/${file}`,
    ],
    { cwd: root, stdio: 'inherit' },
  )
}

console.log('[migrate-remote] done')
