-- Cloud Accounts — Phase 3: friend requests (accept/reject before befriending).
--
-- Apply after 0004_rate_limit.sql:
--   npx wrangler d1 execute flipscorer --local  --file=./migrations/0005_friend_requests.sql
--   npx wrangler d1 execute flipscorer --remote --file=./migrations/0005_friend_requests.sql
--
-- A pending request from one account to another. Accepting moves the pair into
-- `friendships` (both directions) and clears the request; existing friendships
-- are already-accepted, so no backfill is needed.
CREATE TABLE IF NOT EXISTS friend_requests (
  from_account TEXT    NOT NULL,
  to_account   TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (from_account, to_account)
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_account);
CREATE INDEX IF NOT EXISTS idx_friend_requests_created ON friend_requests(created_at);
