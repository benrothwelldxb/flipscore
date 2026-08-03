-- Cloud Accounts — Phase 1 hardening: abuse throttling for sign-in codes.
--
-- Apply after 0003_social.sql:
--   npx wrangler d1 execute flipscorer --local  --file=./migrations/0004_rate_limit.sql
--   npx wrangler d1 execute flipscorer --remote --file=./migrations/0004_rate_limit.sql
--
-- A small fixed-window counter keyed by a hashed identifier (e.g. the requester
-- IP). Raw IPs are never stored — only their SHA-256. Rows are cleaned up
-- opportunistically on write, so no scheduled job is needed.
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT    PRIMARY KEY,   -- e.g. "reqcode:<sha256(ip)>"
  window_start INTEGER NOT NULL,      -- epoch ms when the current window began
  count        INTEGER NOT NULL       -- requests seen in the current window
);
