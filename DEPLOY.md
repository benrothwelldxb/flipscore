# Deploying FlipScorer

FlipScorer deploys as a single Cloudflare Worker that serves the built SPA
(`dist/`) **and** hosts the API: the Connected-mode signaling relay (a Durable
Object), passwordless accounts, library sync, friends, and web push — all backed
by one D1 (SQLite) database.

## Option A — GitHub Actions (hands-off, recommended)

GitHub's runners can reach Cloudflare, so the whole thing runs in CI. Add these
under **Settings → Secrets and variables → Actions**, then run
**Actions → Deploy (Cloudflare Worker) → Run workflow**:

- Secrets: `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit + D1:Edit),
  `CLOUDFLARE_ACCOUNT_ID`, `AUTH_SECRET` (any long random string).
- Optional secrets: `RESEND_API_KEY` (real emails), `VAPID_PRIVATE_KEY` (push).
- Optional variables: `SITE_URL`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`.

The workflow finds/creates the `flipscorer` D1 database, applies migrations
(idempotently), sets whichever secrets you provided, and deploys. It's safe to
re-run for every release.

## Option B — from your machine

Runs against your Cloudflare account directly (needs an interactive
`wrangler login`).

### One-time setup

```bash
# 0. Authenticate wrangler with your Cloudflare account.
npx wrangler login

# 1. Create the D1 database, then paste the printed database_id into
#    wrangler.toml (replace REPLACE_WITH_D1_DATABASE_ID).
npx wrangler d1 create flipscorer

# 2. Create the schema on the REMOTE database (idempotent — tracks applied
#    migrations, so it's safe to re-run when you add new ones later).
npx wrangler d1 migrations apply flipscorer --remote

# 3. Set the one required secret — a long random string used to sign/verify
#    session tokens. Generate and store it:
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" \
  | npx wrangler secret put AUTH_SECRET
```

### Optional secrets/vars

- **Real sign-in emails** (otherwise codes are logged to the Worker console):
  ```bash
  npx wrangler secret put RESEND_API_KEY        # from resend.com
  # set EMAIL_FROM under [vars] in wrangler.toml to a verified sender
  ```
- **Web push notifications** (otherwise the app hides the toggle):
  ```bash
  node scripts/generate-vapid.mjs               # prints a keypair
  npx wrangler secret put VAPID_PRIVATE_KEY      # paste the JSON it printed
  # set VAPID_PUBLIC_KEY and VAPID_SUBJECT under [vars] in wrangler.toml
  ```

## Deploy

```bash
npm run deploy        # builds the SPA, then `wrangler deploy`
```

Re-run `npm run deploy` for every code change. Only the one-time steps above
(login, D1 create, schema, secrets) are needed once. When you add a **new**
migration later, re-run the idempotent apply — it runs only the new files:

```bash
npx wrangler d1 migrations apply flipscorer --remote
```

## Verify

```bash
npx wrangler deploy --dry-run     # bindings resolve, bundle builds (no upload)
npm run test:e2e:full             # exercises the live API against wrangler dev
```
