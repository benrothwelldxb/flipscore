-- Cloud Accounts — Phase A schema (accounts + passwordless email-code auth).
--
-- Apply locally:  npx wrangler d1 execute flipscorer --local  --file=./migrations/0001_auth.sql
-- Apply remote:   npx wrangler d1 execute flipscorer --remote --file=./migrations/0001_auth.sql
--
-- Everything secret is stored hashed: session tokens and one-time codes never
-- touch the database in plaintext, so a database leak cannot be replayed.

-- One row per verified email identity. `email` is normalized (trimmed +
-- lowercased) by the Worker before it is ever written or looked up.
CREATE TABLE IF NOT EXISTS accounts (
  id           TEXT    PRIMARY KEY,          -- opaque id, e.g. "acct_xxx"
  email        TEXT    NOT NULL UNIQUE,
  created_at   INTEGER NOT NULL,             -- epoch milliseconds
  last_seen_at INTEGER NOT NULL
);

-- Bearer session tokens. We store only the SHA-256 hash of the token; the raw
-- token is returned to the client once and never persisted server-side.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,
  account_id TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Pending one-time sign-in codes. One active code per email (the email is the
-- primary key, so a fresh request overwrites the previous code). The code is
-- stored hashed; short expiry + an attempt cap are the real protection.
CREATE TABLE IF NOT EXISTS email_codes (
  email      TEXT    PRIMARY KEY,
  code_hash  TEXT    NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
