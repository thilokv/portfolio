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

## Option B: Vercel (app) + Supabase (PostgreSQL)

Free/low tiers are available, but check current pricing and data-residency terms first.

1. **Supabase**: create a project in the Mumbai region. In SQL editor create the two roles exactly as above (`careos_app` with `NOBYPASSRLS`). Use the *direct* or *session pooler* connection string (port 5432) for migrations and the *transaction pooler* for the app if needed. Set `DATABASE_SSL=true`.
2. Run migrations from your computer: `DATABASE_OWNER_URL=… DATABASE_APP_ROLE=careos_app node --conditions=react-server --import tsx scripts/migrate.ts`.
3. **Do not** expose the Supabase anon/service keys to the browser — CareOS does not use the Supabase client SDK; only the server connects with `DATABASE_URL`.
4. **File storage**: Vercel's filesystem is not persistent. Before using documents on Vercel, implement a Supabase Storage/S3 driver in `src/server/storage.ts` (same three functions: `putObject`, `getObject`, validation) using a **private** bucket and the service key **server-side only**. (Listed in ROADMAP.)
5. **Vercel**: import the repo, set root directory `cdc-careos`, add environment variables (Production only), deploy. Set the region to `bom1` (Mumbai).
6. Backups: Supabase daily backups (paid tier) **plus** your own `pg_dump` via `scripts/backup.sh` from a trusted machine.

## Environment variables

See `.env.example`. Secrets (`DATABASE_*`, `ANTHROPIC_API_KEY`) must only be set in the host's secret store, never committed, never prefixed with `NEXT_PUBLIC_`.

## E-mail (password reset)

`MAIL_TRANSPORT=console` only logs links. For production implement an SMTP/API transport in `src/server/mail.ts` (e.g. Amazon SES Mumbai, Zoho ZeptoMail) and set its credentials as secrets. Until then, administrators reset passwords from **Administration → Staff → Reset password**.

## Health check

`GET /api/health` → `{"status":"ok"}` when the database is reachable (no data exposed). Use it for uptime monitoring.

## Updating

```bash
git pull && npm ci && <run migrate as above> && npm run build && sudo systemctl restart careos
```
Always back up before migrating.
