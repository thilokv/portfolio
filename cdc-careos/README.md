# CDC CareOS

A secure, bilingual (English + Telugu) management platform for a small **Child Development Center** (children 0–7 years) in Andhra Pradesh, India. It coordinates therapy, keeps professional documentation, tracks development goals with transparent measurements, and gives families a separate, safe parent portal.

> **Fictional data only.** Until the production security and privacy review in [`docs/SECURITY.md`](docs/SECURITY.md) is complete, use only fictional records. The demo seed contains invented people and notes.

## What it does

| Area | Highlights |
|---|---|
| Authentication | Individual staff/parent accounts, scrypt password hashing, server-side sessions (12 h max, 60 min idle), lockout after 5 failures, rate limits, password reset, forced password change for temporary passwords |
| Authorization | 8 professional roles (multiple per person), care-team based child access, restricted psychological records, PostgreSQL Row Level Security for organization and parent isolation |
| Dashboard | Live counts: registered/active children, today's appointments, completed sessions, pending notes, reviews due, staff availability, recent activity, weekly attendance |
| Children | Registration with IDs `CDC-0001…`, guardians, emergency contact, histories, consents, search/filter, edit with field-level history, archive/restore (no deletion) |
| Assessments | Structured 9-domain forms, assessor/role/qualifications/tool+version, lock on finalize, no diagnosis or score calculation |
| Development plans | Plans with measurable goals (baseline, target, method, strategies, responsible professional, review date, status), versioned revisions, review history |
| Therapy & sessions | Scheduling with double-booking prevention, check-in, start/complete/sign sessions, service-specific workflows (speech, OT, special education, behaviour, physio, early intervention, psychology), goals addressed with trial data, observations, signed notes locked |
| Progress | Goal charts from recorded trials only (missing data never shown as 0), cautious trend statements, weekly/monthly summaries, factual report drafts |
| Parent portal | Own child only (enforced in the database), approved reports, appointments, home activities, messages/feedback, contact updates |
| Telugu | Complete UI translation, Telugu content fields with mandatory staff review before families see them |
| AI (optional) | Mock provider by default (offline, free). Optional Claude integration — de-identified prompts, consent-gated child context, drafts require professional review and never change records |
| Administration | Staff & roles, availability, services, consent overview, attendance/operational reports, audit log, CSV export, encrypted backups |

## Tech stack

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · shadcn-style components on Radix · Lucide · Recharts · PostgreSQL 16 · Drizzle ORM + SQL migrations · Zod · React Hook Form · Vitest · Playwright.

The database is plain PostgreSQL, so it runs on **Supabase Postgres**, Neon, Amazon RDS or a self-managed server. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for why authentication is built in rather than using Supabase Auth.

## Quick start (local)

Prerequisites: **Node.js 22+**, **PostgreSQL 14+** (16 recommended), `openssl`.

```bash
cd cdc-careos
npm install
bash scripts/setup-local-db.sh   # creates roles + databases, writes .env.local and .env.test
npm run db:migrate               # schema, Row Level Security, triggers
npm run db:seed                  # FICTIONAL demo center
npm run dev                      # http://localhost:3000
```

Demo accounts (password `CareOS-Demo-2026`, local demo only):
`admin@`, `coordinator@`, `speech@`, `ot@`, `sped@` (special educator + behaviour professional), `physio@`, `psych@`, `behaviour@` and `parent@` — all `…demo.careos.local`.

If you cannot use the setup script, copy `.env.example` to `.env.local` and fill in the values yourself (see comments in the file).

## Put it online (Vercel + Neon)

Import the repository in Vercel with Root Directory `cdc-careos`, add a Neon database from the project's Storage tab and redeploy. The build creates the tables, security rules and restricted database role by itself. For a public demo set `CAREOS_DEMO_MODE=true` (fictional data only). Step-by-step instructions and limitations: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#option-b-vercel-app--neon-postgres-automatic-setup).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop / production build / run production server |
| `npm run vercel-build` | Hosted build: database setup (`scripts/vercel-build.ts`), then `next build` |
| `npm run typecheck` · `npm run lint` | TypeScript and ESLint |
| `npm test` | Unit + database integration tests (uses `.env.test`) |
| `npm run test:e2e` | Playwright end-to-end tests against a production build (resets the **test** DB) |
| `npm run check` | typecheck + lint + tests + build |
| `npm run db:migrate` · `db:seed` · `db:reset` | Migrations, demo seed, local reset |
| `npm run db:migrate:test` · `db:reset:test` | Same for the test database |
| `npm run db:backup` | Encrypted database + documents backup |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Security & privacy checklist](docs/SECURITY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Staff user guide](docs/STAFF_GUIDE.md)
- [Administrator guide](docs/ADMIN_GUIDE.md) (incl. backups & restore)
- [AI governance](docs/AI_GOVERNANCE.md)
- [Telugu translation review](docs/TRANSLATION_REVIEW.md)
- [Test results](docs/TEST_RESULTS.md)
- [Unfinished items & external dependencies](docs/ROADMAP.md)

## Project layout

```
src/
  app/            routes: (auth) sign-in, (staff) staff app, portal/ parent portal, api/ downloads, exports, health
  components/     design system (ui/), feature components, charts
  db/             Drizzle schema + RLS-scoped client (withOrg)
  i18n/           en.ts, te.ts (type-checked parity), server/client helpers
  lib/            constants, permissions matrix, validation (Zod), dates (IST), progress maths, AI redaction
  server/         auth (sessions, rate limit, actor), authz, audit, services/ (domain logic), actions/ (server actions)
drizzle/          SQL migrations (0001_security.sql = RLS, triggers, constraints)
scripts/          migrate, seed, reset, setup-local-db, backup
tests/            unit/, integration/ (real Postgres, app role), e2e/ (Playwright)
docs/             guides listed above
```
