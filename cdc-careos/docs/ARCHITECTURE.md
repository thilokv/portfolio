# Architecture

## Overview

```
Browser (Android Chrome / desktop)
   │  HTTPS, HttpOnly session cookie
   ▼
Next.js 16 server (App Router)
   ├─ proxy.ts ............... optimistic redirect when no session cookie
   ├─ Server Components ....... read data through services
   ├─ Server Actions .......... Zod-validated mutations → services
   ├─ Route handlers .......... /api/documents/[id], /api/export/[dataset], /api/health
   └─ src/server
        auth/actor.ts ......... Data Access Layer: session → actor (org, staff, roles, permissions)
        authz.ts .............. child-level access (care team, restricted records)
        services/*.ts ......... domain logic + permission checks + audit (framework-free, unit/integration tested)
        audit.ts .............. append-only audit entries in the same transaction
   │  pg (pool) as role careos_app (no ownership, no BYPASSRLS)
   ▼
PostgreSQL 16
   ├─ Row Level Security: app.current_org / app.guardian_id set per transaction (withOrg)
   ├─ Composite FKs (organization_id, id) prevent cross-organization references
   ├─ Triggers: audit log append-only; signed sessions, finalized assessments and superseded goal versions locked
   └─ Exclusion constraints: no overlapping appointments per therapist or per child
```

## Key decisions

**Fully dynamic rendering.** `cacheComponents` is disabled and every route renders per request with `Cache-Control: private, no-store`. Clinical data is personal and must never be cached by the framework or a CDN.

**Built-in authentication instead of Supabase Auth.** Sessions are opaque random tokens; only their SHA-256 is stored, enabling immediate revocation (logout, password change, deactivation) and idle timeouts. Passwords use scrypt (N=2^15). This keeps the app portable across any PostgreSQL host (Supabase, Neon, RDS, self-hosted) and avoids a hard dependency on a paid tier. Supabase can still host the database and storage.

**Defense in depth for authorization.**
1. Services check permissions and child access on every call (`assertChildAccess`).
2. PostgreSQL RLS isolates organizations, blocks guardians from clinical tables and filters parent rows to their own portal-enabled children.
3. Triggers protect signed/finalized records even from buggy application code.
4. UI hides controls the user cannot use (convenience only).

**Two database roles.** `careos_owner` owns the schema and runs migrations; `careos_app` (runtime) gets only `SELECT/INSERT/UPDATE` (+ `DELETE` on a handful of join/ephemeral tables) and is subject to RLS. Grants are reapplied by `npm run db:migrate`.

**Clinical integrity.** Records are never hard-deleted through the UI: children are archived, goals are versioned (`goal_group_id`, `version`, `previous_goal_id`), session notes are signed and locked, assessments are finalized and locked. Measurements are nullable — missing data is never stored or displayed as zero.

**Access model.**

| Role | Children visible | Clinical records | Restricted (psychological) | Admin functions |
|---|---|---|---|---|
| Administrator | all (demographics, consents, documents, scheduling) | no | no | staff, services, audit, exports, consents |
| Clinical coordinator | all | read/write | yes | consents, care teams, approvals, audit, reports |
| Therapists / educator / behaviour | care team only | read/write; edit only own records | no | — |
| Psychologist | care team only | read/write | own care-team children | report approval (psychological) |
| Parent | own portal-enabled child | approved reports, home activities, messages only | never | own contact details |

Staff may hold several roles; permissions are the union.

**Internationalization.** `src/i18n/en.ts` defines the message tree; `te.ts` is typed as `Messages`, so a missing Telugu key fails the TypeScript build, and a unit test checks key and placeholder parity. Locale is a cookie (and the user's saved preference). Telugu *content* (reports, messages) has its own fields and is only shown to families after a staff member ticks the translation-review box.

**Time zone.** The center runs on IST (UTC+05:30, no DST). Local times from forms are converted with a fixed offset (`src/lib/dates.ts`).

**AI.** `src/server/ai/providers.ts` defines a provider interface; the default mock provider is deterministic and offline. The Anthropic provider uses the official SDK (`claude-opus-5-5` by default via `AI_MODEL`) and is only used when `AI_PROVIDER=anthropic` and a key is configured. All prompts pass through `redact()` first; drafts are logged in `ai_drafts` with status `pending_review`.

## Data model (main tables)

`organizations`, `user_accounts`, `auth_sessions`, `password_reset_tokens`, `rate_limit_events`, `staff`, `staff_roles`, `staff_availability`, `services`, `children`, `child_assignments` (care team), `guardians`, `child_guardians`, `consents`, `assessments`, `assessment_domains`, `development_plans`, `development_goals`, `goal_reviews`, `goal_observations`, `appointments`, `therapy_sessions`, `session_goals`, `session_observations`, `documents`, `parent_messages`, `reports`, `ai_drafts`, `audit_logs`, `org_counters`.

Schema source: `src/db/schema.ts`. Security SQL: `drizzle/0001_security.sql`, `drizzle/0002_session_child_locks.sql`.

## Extending

- New table: add to `schema.ts`, `npm run db:generate`, then add an RLS policy in a custom migration (`npx drizzle-kit generate --custom --name …`) and include it in the composite-FK list if it references children/staff.
- New permission: add to `PERMISSIONS` / `ROLE_PERMISSIONS` in `src/lib/permissions.ts` and cover it in `tests/unit/permissions.test.ts`.
- New UI text: add to `en.ts`; TypeScript will then require the Telugu entry in `te.ts`.
