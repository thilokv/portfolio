# Unfinished Items & External Dependencies

## Requires your action / external accounts (not done)
| Item | Why | What to do |
|---|---|---|
| Hosting + domain + HTTPS | Production access from phones | Choose Option A (VPS) or B (Vercel + Supabase) in DEPLOYMENT.md |
| Production database | Real data must not live on a laptop | Create managed/VPS PostgreSQL in India (Mumbai) |
| E-mail sending | Self-service password reset in production | Pick a provider (Amazon SES, Zoho ZeptoMail…), implement transport in `src/server/mail.ts`, store keys as secrets. Until then admins reset passwords |
| Legal/privacy review | DPDP Act 2023, consent forms, retention | Engage an advisor; update consent wording; appoint a grievance officer |
| Telugu review | Accuracy for families | See TRANSLATION_REVIEW.md |
| AI provider (optional, paid) | Real drafting/translation | See AI_GOVERNANCE.md — approval, consent, key in secret store |
| Off-site backups | Disaster recovery | Second provider/region + quarterly restore test |
| Security review / pen-test | Before real child data | Independent reviewer |

## Not yet implemented (engineering backlog)
- Two-factor authentication (TOTP) for staff, especially administrators/coordinators.
- Supabase Storage / S3 driver for documents (needed for serverless hosting; local disk driver works on a VPS).
- SMS/WhatsApp appointment reminders (needs a paid provider and consent).
- Recurring appointment series editing (each weekly appointment is currently independent).
- Week/calendar grid view for the schedule (day list + filters exist).
- PDF export of approved reports (browser print works; `print` styles hide navigation).
- Standardized assessment scoring — intentionally **not** implemented; only add with validated scoring rules, licences and professional sign-off.
- Data retention automation (purge/anonymise after the legally required period).
- Antivirus scanning of uploads.
- Offline support / PWA install.
- Multi-center administration UI (the data model already isolates organizations).

## Known limitations
- Dashboard "staff availability" counts appointments per therapist for today; partial-day availability is informational only.
- `npm audit` lists advisories in development tooling (drizzle-kit/esbuild), not in the production runtime.
