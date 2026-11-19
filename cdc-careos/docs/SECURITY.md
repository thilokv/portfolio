# Security & Privacy Checklist

CDC CareOS stores sensitive information about young children. This checklist shows what is implemented and verified, and what must be completed **before any real child's data is entered**.

Legend: ✅ implemented & tested · 🟡 implemented, needs configuration at deployment · ⛔ required before go-live (your action)

## Authentication & sessions
- ✅ Individual accounts for every staff member and parent (no shared logins).
- ✅ Passwords hashed with scrypt (N=2^15, random salt); never stored or logged in plain text. Policy: ≥10 chars, letters + digits.
- ✅ Opaque session tokens in `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookies; only SHA-256 hashes stored.
- ✅ Session expiry: 12 h absolute, 60 min idle (configurable). Revocation on logout, password change/reset, staff deactivation; "sign out other devices".
- ✅ Account lockout (5 failures → 15 min) and DB-backed rate limits (login per e-mail/IP, password reset, uploads, AI, parent feedback).
- ✅ Temporary passwords force a change at first sign-in. Reset links are single-use, expire in 30 min, and do not reveal whether an account exists.
- ⛔ Configure a real e-mail transport for password resets (currently prints the link to the server log in development).
- 🟡 Consider adding TOTP two-factor authentication for administrators/coordinators (see ROADMAP).

## Authorization
- ✅ Role-based permissions (8 roles, multiple per person) checked **on the server** in every service call.
- ✅ Care-team based child access; unassigned staff receive "not found".
- ✅ Administrators do not see clinical notes unless they also hold a clinical role.
- ✅ Psychological assessments, reports, sessions and documents restricted to psychologists on the care team and coordinators; restricted views are audited.
- ✅ Only the authoring professional can edit their assessment drafts and session notes; signed/finalized records are locked by database triggers.
- ✅ Four-eyes approval for reports (author cannot approve own, except psychologists' own psychological reports); sharing requires parent-portal consent and reviewed Telugu text.

## Data isolation (PostgreSQL)
- ✅ Row Level Security on every tenant table; runtime role has no BYPASSRLS and owns no tables.
- ✅ Parent sessions are filtered in the database to their own portal-enabled child; no access to assessments, sessions, goals, observations, consents, staff roles, AI drafts or audit logs (tested).
- ✅ Composite foreign keys prevent cross-organization references; with no org context the app role sees zero rows (tested).
- ✅ Audit log is append-only (trigger + no UPDATE/DELETE grant).

## Input, output and transport
- ✅ Zod validation on client and server for every mutation; parameterized SQL only (Drizzle).
- ✅ Errors shown to users are generic translated messages; internals are logged server-side only.
- ✅ Security headers: CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS (production), `Cache-Control: private, no-store`.
- ✅ Server Actions have built-in origin checks (CSRF protection).
- ✅ CSV exports neutralize spreadsheet formulas.
- 🟡 HTTPS: terminate TLS at your host (Vercel/Render/Nginx + Let's Encrypt). Set `DATABASE_SSL=true` for managed databases.

## Files
- ✅ Uploads stored outside the web root with random names, 0600 permissions; type detected from file contents (PDF/JPG/PNG/WEBP only), 10 MB limit, SHA-256 recorded.
- ✅ Downloads only through an authorized route; every download audited.
- 🟡 For serverless hosting use a **private** bucket (Supabase Storage/S3) — see DEPLOYMENT.md. Consider antivirus scanning of uploads.

## Consent & records
- ✅ Consent records per type (registration, assessment, therapy, photo/video, sharing, portal, AI) with history; registration consent mandatory; therapy consent required to schedule; portal consent required to share; withdrawing portal consent removes access immediately.
- ✅ Children are archived, never deleted; goal revisions keep history; record history tab shows field-level changes.

## Backups
- ✅ `npm run db:backup`: encrypted (AES-256, PBKDF2) database + documents backup; restore verified in testing.
- ⛔ Schedule daily backups, store copies off-site, test a restore every quarter.

## AI
- ✅ Disabled for external providers by default (mock provider). De-identification of names, IDs, phones, e-mails, ID numbers and PIN codes before any provider call; child context only with AI-assistance consent; drafts never modify records.
- ⛔ Before enabling an external AI provider: management approval, privacy review, parent consent wording, provider data-processing terms. See AI_GOVERNANCE.md.

## Legal & organizational (India) — ⛔ before go-live
- Review obligations under the **Digital Personal Data Protection Act, 2023** and the DPDP Rules: verifiable parental consent for children's data, purpose limitation, data minimisation, retention limits, breach notification to the Data Protection Board and affected parents, grievance officer contact.
- **Rights of Persons with Disabilities Act, 2016** and **RCI** professional record-keeping expectations; confirm retention periods for clinical records with a qualified advisor.
- If the center connects to national health systems, review **ABDM** health data management guidance.
- Choose data residency (e.g. Supabase/AWS Mumbai `ap-south-1`) consistent with your legal advice.
- Write and train staff on: acceptable use, device security (screen locks on phones), incident response, access reviews (quarterly), leaver process (deactivate same day).
- Independent security review / penetration test before storing real data.

## Known limitations
- No 2FA yet; no automated malware scanning; no field-level encryption beyond disk/database encryption provided by the host.
- `npm audit` reports advisories in development-only tooling (drizzle-kit's bundled esbuild); not shipped in the production server.
