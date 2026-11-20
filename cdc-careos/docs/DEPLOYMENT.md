# Deployment

CareOS is a standard Next.js server + PostgreSQL. Two low-cost options are described. **Do not deploy with real data until the ⛔ items in SECURITY.md are done.**

## Option A (recommended for a single center): one small VPS

Cost: ~₹500–1,500/month (e.g. a 2 GB VPS in Mumbai). Simplest for private file storage.

1. Ubuntu 24.04 VPS, create a non-root user, enable `ufw` (allow 22, 80, 443).
2. Install Node.js 22, PostgreSQL 16, Nginx, certbot.
3. Database:
   ```bash
   sudo -u postgres psql -c "CREATE ROLE careos_owner LOGIN PASSWORD '<strong>'"
   sudo -u postgres psql -c "CREATE ROLE careos_app LOGIN PASSWORD '<strong>' NOSUPERUSER NOBYPASSRLS"
   sudo -u postgres psql -c "CREATE DATABASE careos OWNER careos_owner"
   sudo -u postgres psql -d careos -c "CREATE EXTENSION IF NOT EXISTS btree_gist"
   ```
4. Code: `git clone …`, `cd cdc-careos`, `npm ci`, create `.env.production.local` from `.env.example`:
   - `DATABASE_URL=postgres://careos_app:…@localhost:5432/careos`
   - `DATABASE_OWNER_URL=postgres://careos_owner:…@localhost:5432/careos`
   - `APP_URL=https://careos.your-center.in`
   - `STORAGE_DIR=/var/lib/careos/storage` (create it, owned by the app user, mode 700)
5. `NODE_ENV=production node --env-file=.env.production.local --conditions=react-server --import tsx scripts/migrate.ts`
6. Create the organization and first administrator (see ADMIN_GUIDE.md → "First administrator"). **Do not run the demo seed in production** (it refuses to).
7. `npm run build`, run `npm start` under systemd (`Restart=always`, `Environment=NODE_ENV=production`, `EnvironmentFile=…`).
8. Nginx reverse proxy to `localhost:3000`, `client_max_body_size 12m;`, then `certbot --nginx` for HTTPS.
9. Cron a daily `npm run db:backup` (with `ENV_FILE`, `BACKUP_PASSPHRASE_FILE`, `BACKUP_DIR`) and copy to off-site storage.

## Option B: Vercel (app) + Neon Postgres (automatic setup)

Everything is done in the Vercel website; no keys or connection strings are typed by hand. Free tiers are available (check current pricing). **Vercel's free Hobby plan is for non-commercial use**: fine for a demo or evaluation, but a center using CareOS for real needs a paid plan or Option A.

1. **Create the project.** In Vercel choose *Add New → Project*, import the Git repository and set **Root Directory** to `cdc-careos` (skip this when the repository contains only CareOS). For a public demo with the fictional demo center, add the environment variable `CAREOS_DEMO_MODE` = `true` (leave it out for a real center). Press **Deploy**. The first deployment has no database yet, so the site opens on a *Finish setup* page; that is expected.
2. **Add the database.** In the project open **Storage → Create Database → Neon**, choose the free plan, keep the suggested region and connect it to the project (all environments).
3. **Redeploy.** *Deployments* → ⋯ on the newest deployment → **Redeploy**.

What the build does (`npm run vercel-build` → `scripts/vercel-build.ts`):
- Uses the database **owner** connection that the Neon integration provides (`DATABASE_URL_UNPOOLED`) only for setup: it creates the restricted runtime role `careos_app` (no `BYPASSRLS`, owns nothing), applies migrations and grants, and **refuses to finish** if that role could bypass Row Level Security.
- The running app always signs in as `careos_app`, never as the owner. Its password is derived from the owner password (HMAC-SHA256), so there is no extra secret to store.
- All database connections use TLS with certificate verification.
- With `CAREOS_DEMO_MODE=true`, loads the fictional demo center **only if the database has no organizations**. Demo mode also shows a "fictional data" banner on every page, offers the demo accounts on the sign-in page, and stops anyone changing the shared demo accounts' e-mail, password or active status.
- Safe to repeat on every deployment (migrations are versioned; concurrent builds are serialized with an advisory lock).

Limitations on Vercel (serverless):
- **Uploaded documents are not kept**: they go to a temporary folder. Before using documents for real, implement a private object-storage driver in `src/server/storage.ts` (see ROADMAP).
- Requests are limited to about 4.5 MB, so larger uploads fail even though CareOS allows 10 MB.
- The Neon integration also places the owner connection string in the app's runtime environment (Vercel cannot limit it to the build). For a real center prefer Option A, or set `DATABASE_URL` (runtime role) and `DATABASE_OWNER_URL` yourself and run migrations from a trusted machine.
- Data location: pick a region that matches your legal advice (DPDP). The demo uses fictional data only.

**Supabase instead of Neon:** CareOS is plain PostgreSQL, so Supabase works with explicit settings (`DATABASE_URL` for `careos_app`, `DATABASE_OWNER_URL`, `DATABASE_SSL=true`). Supabase's certificates are signed by Supabase's own certificate authority, so the server needs that CA certificate (for example via `NODE_EXTRA_CA_CERTS`). Migrations revoke the Supabase HTTP-API roles (`anon`, `authenticated`) from CareOS tables. Never expose Supabase keys to the browser; CareOS does not use the Supabase client SDK.

## Environment variables

See `.env.example`. Secrets (`DATABASE_*`, `ANTHROPIC_API_KEY`) must only be set in the host's secret store, never committed, never prefixed with `NEXT_PUBLIC_`. On Vercel with the Neon integration, no database variables need to be set by hand; `APP_URL` defaults to the project's production address.

## E-mail (password reset)

`MAIL_TRANSPORT=console` only logs links. For production implement an SMTP/API transport in `src/server/mail.ts` (e.g. Amazon SES Mumbai, Zoho ZeptoMail) and set its credentials as secrets. Until then, administrators reset passwords from **Administration → Staff → Reset password**.

## Health check

`GET /api/health` → `{"status":"ok"}` when the database is reachable (no data exposed). Use it for uptime monitoring.

## Updating

```bash
git pull && npm ci && <run migrate as above> && npm run build && sudo systemctl restart careos
```
Always back up before migrating.
