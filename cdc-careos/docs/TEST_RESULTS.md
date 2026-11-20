# Test Results

Last recorded on 2026-11-20 (Linux container, Node 22, PostgreSQL 16, Chromium via Playwright 1.63). All commands were actually run; output summarised below.

| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | ✅ no errors |
| ESLint | `npm run lint` | ✅ 0 problems |
| Unit + integration | `npm test` | ✅ 10 files, **90 / 90 passed** |
| Production build | `npm run build` (run by the E2E suite) | ✅ compiled, all routes dynamic |
| End-to-end | `npm run test:e2e` | ✅ **14 / 14 passed** (desktop Chrome + Android Pixel 7 emulation) |
| Hosted deployment (Vercel + Neon), simulated | see below | ✅ all checks passed |
| Backup round-trip (2026-11-19) | `npm run db:backup` + decrypt + `pg_restore --list` | ✅ encrypted dump readable |

Integration tests run against a real PostgreSQL test database **as the restricted runtime role**, so Row Level Security, triggers, exclusion constraints and composite foreign keys are exercised for real.

## Bugs found by the tests and fixed
1. `parent_messages.direction` was `varchar(12)` but `"from_guardian"` is 13 characters — parent feedback and contact updates would have failed. Fixed by migration `0003` (policies dropped/re-created around the type change).
2. AI de-identification replaced names before e-mail addresses, leaving `[NAME]@example.com`. E-mails are now redacted first.
3. The sign-in page always said "Demo environment — all records are fictional", even on a real installation. It now appears only in development and in demo mode.

## Hosted deployment simulation (2026-11-20)

Vercel and Neon cannot be reached from the test machine, so their behaviour was reproduced locally: a clean copy of the committed code (`git archive` + `npm ci`, no `.env` files), `VERCEL=1`, the Neon integration's variable names, a non-superuser database owner with `CREATEROLE` (like Neon's), and a PostgreSQL server that requires a certificate signed by a test CA (so TLS verification is genuinely exercised).

| Step | Result |
|---|---|
| `npm run vercel-build` with **no database** | ✅ build succeeds; every page redirects to `/setup` with the instructions; `/api/health` → 503 |
| `npm run vercel-build` with the database connected | ✅ restricted role created, migrations + grants applied, role guard passed, fictional demo center loaded; owner name/password absent from the log |
| Running app, phone emulation (Pixel 7) — 11 checks | ✅ demo accounts + banner on sign-in, one-tap coordinator sign-in, dashboard (10 children, 8 appointments today), no sideways scrolling, children list, demo password change refused, one-tap parent sign-in to the portal |
| Database view of the running app | ✅ connections use the restricted role over TLS 1.3; with no organization context it sees 0 children; it cannot update the audit log, drop/create tables or delete children |
| Second build (like a redeploy) | ✅ idempotent: role password re-set to the same value, no duplicate demo data (1 organization) |
| Role guard refusal cases | ✅ refuses the table owner and a role that is a member of the owner; accepts `careos_app` (also covered by `tests/integration/deployment.test.ts`) |

Afterwards the simulation database, roles and certificates were removed and the server's TLS settings restored.

## Unit & integration tests (Vitest)

```
✓ tests/integration/clinical.test.ts > developmental assessments > creates, edits and finalizes; finalized records are locked in app and database
✓ tests/integration/clinical.test.ts > developmental assessments > rejects an assessor role the user does not hold or a service outside their profession
✓ tests/integration/clinical.test.ts > developmental assessments > psychological assessments are restricted from other clinicians
✓ tests/integration/clinical.test.ts > individual development plans > creates a plan with measurable goals and keeps revision history
✓ tests/integration/clinical.test.ts > appointments and sessions > schedules, prevents double booking and enforces role/team/consent rules
✓ tests/integration/clinical.test.ts > appointments and sessions > requires therapy consent
✓ tests/integration/clinical.test.ts > appointments and sessions > only the assigned therapist can run and document the session
✓ tests/integration/clinical.test.ts > appointments and sessions > progress uses only recorded observations across goal versions
✓ tests/integration/clinical.test.ts > reports and approval > requires four-eyes approval and portal consent before sharing
✓ tests/integration/clinical.test.ts > reports and approval > only psychologists author psychological reports
✓ tests/integration/clinical.test.ts > AI drafting safeguards > de-identifies input, logs a pending-review draft and never edits records
✓ tests/integration/security.test.ts > organization isolation (RLS) > the runtime role sees nothing without an organization context
✓ tests/integration/security.test.ts > organization isolation (RLS) > an org B administrator cannot see or open org A children
✓ tests/integration/security.test.ts > organization isolation (RLS) > cannot write rows into another organization
✓ tests/integration/security.test.ts > organization isolation (RLS) > cannot reference another organization's child even with its own org id (composite FK)
✓ tests/integration/security.test.ts > organization isolation (RLS) > cannot update another organization's rows
✓ tests/integration/security.test.ts > organization isolation (RLS) > audit logs are scoped to the organization and append-only
✓ tests/integration/security.test.ts > unauthorized access attempts by staff > therapists cannot read the audit log, manage staff or export data
✓ tests/integration/security.test.ts > unauthorized access attempts by staff > protects the last administrator and self-deactivation
✓ tests/integration/security.test.ts > unauthorized access attempts by staff > creates staff with multiple roles and a temporary password
✓ tests/integration/security.test.ts > unauthorized access attempts by staff > deactivating a staff member revokes their sessions
✓ tests/integration/security.test.ts > parent portal isolation > a parent sees only their own child and appointments
✓ tests/integration/security.test.ts > parent portal isolation > a parent can never read clinical notes, assessments, goals, staff roles or audit logs
✓ tests/integration/security.test.ts > parent portal isolation > unshared reports are invisible; shared reports are visible
✓ tests/integration/security.test.ts > parent portal isolation > a parent cannot post a message about another child or impersonate staff
✓ tests/integration/security.test.ts > parent portal isolation > a parent can update only their own contact details
✓ tests/integration/security.test.ts > parent portal isolation > a parent from another organization sees nothing
✓ tests/integration/security.test.ts > parent portal isolation > maps a missing-org context error to a safe message
✓ tests/unit/misc.test.ts > AI de-identification > removes names, IDs, phones and e-mails
✓ tests/unit/misc.test.ts > CSV export > escapes quotes and neutralises spreadsheet formulas
✓ tests/unit/misc.test.ts > upload validation > detects real file types from magic bytes
✓ tests/unit/misc.test.ts > upload validation > rejects disguised and oversized files
✓ tests/unit/misc.test.ts > dates (IST) > round-trips local datetime values
✓ tests/unit/misc.test.ts > dates (IST) > computes IST day bounds and ages
✓ tests/unit/misc.test.ts > passwords > hashes with salt and verifies
✓ tests/unit/misc.test.ts > reporting & errors > returns no attendance rate without data
✓ tests/unit/misc.test.ts > reporting & errors > maps database errors to safe messages
✓ tests/integration/children.test.ts > child registration > creates sequential child IDs, a guardian link and registration consent
✓ tests/integration/children.test.ts > child registration > refuses registration by a therapist
✓ tests/integration/children.test.ts > child editing, history and archive > records field-level changes in the audit trail
✓ tests/integration/children.test.ts > child editing, history and archive > archives without deleting and can restore
✓ tests/integration/children.test.ts > child editing, history and archive > supports search by name and child ID
✓ tests/integration/children.test.ts > care-team based visibility > therapists only see children on their care team
✓ tests/integration/children.test.ts > care-team based visibility > filters by service
✓ tests/integration/children.test.ts > consent and parent portal accounts > requires portal consent before creating a guardian login and withdrawing consent removes access
✓ tests/unit/i18n.test.ts > English + Telugu translations > Telugu covers every English key
✓ tests/unit/i18n.test.ts > English + Telugu translations > has no empty strings
✓ tests/unit/i18n.test.ts > English + Telugu translations > keeps the same placeholders in both languages
✓ tests/unit/i18n.test.ts > English + Telugu translations > actually contains Telugu script for user-facing navigation
✓ tests/unit/i18n.test.ts > English + Telugu translations > interpolates variables and falls back to the key for unknown entries
✓ tests/unit/progress.test.ts > progress calculations > never treats missing trial data as zero
✓ tests/unit/progress.test.ts > progress calculations > computes independent rate only when recorded
✓ tests/unit/progress.test.ts > progress calculations > excludes unmeasured observations from charts (gaps are not filled)
✓ tests/unit/progress.test.ts > progress calculations > requires at least 3 measured observations before describing a trend
✓ tests/unit/progress.test.ts > progress calculations > describes trends conservatively
✓ tests/unit/validation.test.ts > child registration validation > accepts a valid registration
✓ tests/unit/validation.test.ts > child registration validation > requires recorded registration consent
✓ tests/unit/validation.test.ts > child registration validation > rejects future or out-of-range dates of birth
✓ tests/unit/validation.test.ts > child registration validation > validates Indian mobile numbers
✓ tests/unit/validation.test.ts > session measurement validation > allows no trial data at all (missing is not zero)
✓ tests/unit/validation.test.ts > session measurement validation > requires both trial counts together
✓ tests/unit/validation.test.ts > session measurement validation > rejects successes greater than trials
✓ tests/unit/validation.test.ts > session measurement validation > rejects independent trials greater than successes
✓ tests/unit/validation.test.ts > other validation > enforces the password policy
✓ tests/unit/validation.test.ts > other validation > requires plan review date on/after start date
✓ tests/unit/permissions.test.ts > role permissions > administrators manage staff but cannot write clinical records
✓ tests/unit/permissions.test.ts > role permissions > therapists cannot manage staff or view all children
✓ tests/unit/permissions.test.ts > role permissions > combines permissions across multiple roles
✓ tests/unit/permissions.test.ts > role permissions > restricts service delivery to matching professions
✓ tests/unit/permissions.test.ts > child-level access > unassigned therapist has no access at all
✓ tests/unit/permissions.test.ts > child-level access > assigned therapist can view and write clinical records but not restricted ones
✓ tests/unit/permissions.test.ts > child-level access > administrator sees demographics only
✓ tests/unit/permissions.test.ts > child-level access > coordinator sees everything including restricted records
✓ tests/unit/permissions.test.ts > child-level access > psychologist sees restricted records only for assigned children
```

## End-to-end tests (Playwright, production build)

```
✓ Running next.config.ts took 24ms
✓ Compiled successfully in 2.8s
✓ Generating static pages using 3 workers (29/29) in 226ms
✓   1 [desktop] › tests/e2e/critical.spec.ts:5:7 › authentication › rejects wrong passwords and protects routes
✓   2 [desktop] › tests/e2e/critical.spec.ts:15:7 › authentication › signs in, shows a live dashboard and signs out
✓   3 [desktop] › tests/e2e/critical.spec.ts:28:7 › child management › registers, finds and edits a child
✓   4 [desktop] › tests/e2e/critical.spec.ts:54:7 › child management › administrators cannot open clinical sections
✓   5 [desktop] › tests/e2e/critical.spec.ts:67:7 › therapy workflow › therapist starts, documents, completes and signs a session
✓   6 [desktop] › tests/e2e/critical.spec.ts:87:7 › therapy workflow › schedules a new appointment
✓   7 [desktop] › tests/e2e/critical.spec.ts:99:7 › therapy workflow › unassigned therapists cannot open another child's record
✓   8 [desktop] › tests/e2e/critical.spec.ts:112:7 › therapy workflow › progress charts and plans render from recorded data
✓   9 [desktop] › tests/e2e/critical.spec.ts:125:7 › language switching › switches the interface between English and Telugu
✓  10 [desktop] › tests/e2e/critical.spec.ts:140:7 › parent portal › parents cannot download staff exports
✓  11 [desktop] › tests/e2e/critical.spec.ts:146:7 › parent portal › @mobile parent sees only approved information for their own child
✓  12 [desktop] › tests/e2e/critical.spec.ts:166:7 › parent portal › staff downloads require authorization
✓  13 [desktop] › tests/e2e/critical.spec.ts:175:5 › password is never sent back in pages
✓  14 [android] › tests/e2e/critical.spec.ts:146:7 › parent portal › @mobile parent sees only approved information for their own child
```

## Coverage by requirement
| Requirement | Where tested |
|---|---|
| Authentication | e2e: wrong password, sign-in/out, route protection; unit: password hashing & policy |
| Authorization / unauthorized access | unit: permission matrix; integration: therapist/admin limits, restricted records, last-admin, self-deactivation; e2e: unassigned therapist gets "not found", admin blocked from clinical tabs, parent blocked from staff routes/exports |
| Child registration & editing | integration (codes, consent, audit diff, archive/restore, search, filters); e2e (form validation, register, search, edit) |
| Assessment creation | integration (create/edit/finalize/lock, role & service checks, psychological restriction) |
| Development plans | integration (plan approval, measurable goals, responsible on team, versioned revision, lock of old versions, reviews); e2e render |
| Appointment scheduling | integration (weekly repeat, therapist & child double-booking, consent, service role, team, own-only); e2e scheduling form |
| Session creation | integration (assigned-therapist only, notes, workflow field whitelist, goal measurements, complete, sign, DB lock); e2e full flow |
| Progress tracking | unit (no zero-filling, trend rules); integration (versions aggregated, period summary); e2e charts |
| Parent access | integration (RLS: own child only, no clinical tables, shared reports only, cannot post for other child/impersonate staff, own contact only, cross-org); e2e portal on Android |
| Language switching | unit (key/placeholder parity, Telugu script present); e2e switch + persistence |
| Database relationships / org isolation | integration (no-context zero rows, cross-org read/write/update blocked, composite FK, audit append-only) |
