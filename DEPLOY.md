# Deploying FlipScorer

FlipScorer deploys as a single Cloudflare Worker that serves the built SPA
(`dist/`) **and** hosts the API: the Connected-mode signaling relay (a Durable
Object), passwordless accounts, library sync, friends, and web push — all backed
by one D1 (SQLite) database.

Everything below runs from your own machine with your Cloudflare account. The
CI sandbox can't do it: `wrangler` needs an interactive `wrangler login` (or a
`CLOUDFLARE_API_TOKEN`) that isn't available there.

## One-time setup

```bash
# 0. Authenticate wrangler with your Cloudflare account.
npx wrangler login

# 1. Create the D1 database, then paste the printed database_id into
#    wrangler.toml (replace REPLACE_WITH_D1_DATABASE_ID).
npx wrangler d1 create flipscorer

# 2. Create the schema on the REMOTE database (first deploy only).
node scripts/migrate-remote.mjs

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
migration later, apply just that file to remote:

```bash
npx wrangler d1 execute flipscorer --remote --file=./migrations/000N_name.sql
```

## Verify

```bash
npx wrangler deploy --dry-run     # bindings resolve, bundle builds (no upload)
npm run test:e2e:full             # exercises the live API against wrangler dev
```
