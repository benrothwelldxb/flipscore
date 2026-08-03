-- Cloud Accounts — Phase 4: web push subscriptions.
--
-- Apply after 0005_friend_requests.sql:
--   npx wrangler d1 execute flipscorer --local  --file=./migrations/0006_push.sql
--   npx wrangler d1 execute flipscorer --remote --file=./migrations/0006_push.sql
--
-- One row per browser push subscription. `p256dh` and `auth` are the subscription
-- keys used to encrypt payloads (RFC 8291). `topics` is a JSON object of per-topic
-- opt-ins. Dead subscriptions are pruned when the push service returns 404/410.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   TEXT    PRIMARY KEY,
  account_id TEXT    NOT NULL,
  p256dh     TEXT    NOT NULL,
  auth       TEXT    NOT NULL,
  topics     TEXT    NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_account ON push_subscriptions(account_id);
