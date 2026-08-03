-- Cloud Accounts — Phase B: library sync storage.
--
-- Apply after 0001_auth.sql:
--   npx wrangler d1 execute flipscorer --local  --file=./migrations/0002_sync.sql
--   npx wrangler d1 execute flipscorer --remote --file=./migrations/0002_sync.sql
--
-- Sync is per-item, last-write-wins by (rev, updatedAt), with soft-delete
-- tombstones — the same model the client already uses for games and nights.

-- One row per (account, collection, item). `data` is the item's JSON payload;
-- `seq` is a per-account monotonic sequence stamped on every accepted write so
-- a client can pull "everything since my last seq".
CREATE TABLE IF NOT EXISTS documents (
  account_id TEXT    NOT NULL,
  collection TEXT    NOT NULL,
  item_id    TEXT    NOT NULL,
  rev        INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  data       TEXT    NOT NULL,
  seq        INTEGER NOT NULL,
  PRIMARY KEY (account_id, collection, item_id)
);
CREATE INDEX IF NOT EXISTS idx_documents_seq ON documents(account_id, seq);

-- Per-account monotonic counter that stamps `documents.seq`. Reserved in atomic
-- blocks (UPDATE … RETURNING) so two devices syncing at once can't collide.
ALTER TABLE accounts ADD COLUMN sync_seq INTEGER NOT NULL DEFAULT 0;
