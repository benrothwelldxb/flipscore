-- Cloud Accounts — Phase C: friends & leaderboards.
--
-- Apply after 0002_sync.sql:
--   npx wrangler d1 execute flipscorer --local  --file=./migrations/0003_social.sql
--   npx wrangler d1 execute flipscorer --remote --file=./migrations/0003_social.sql

-- One public identity per account: a shareable friend code, a display name (the
-- player name they claim), and a JSON snapshot of their published stats that the
-- leaderboard ranks by. The account never publishes raw games here — only the
-- small aggregate it chooses to share.
CREATE TABLE IF NOT EXISTS identities (
  account_id   TEXT    PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  friend_code  TEXT    NOT NULL UNIQUE,
  display_name TEXT    NOT NULL DEFAULT '',
  stats        TEXT    NOT NULL DEFAULT '{}',
  updated_at   INTEGER NOT NULL
);

-- Mutual friendships, stored as two directed rows (a→b and b→a) so listing a
-- account's friends is a single indexed lookup.
CREATE TABLE IF NOT EXISTS friendships (
  account_id TEXT    NOT NULL,
  friend_id  TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, friend_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_account ON friendships(account_id);
