# Administrator Guide

For the center administrator and clinical coordinator.

## First administrator (new installation)

On the server, after migrations:
```bash
node --env-file=.env.production.local --conditions=react-server --import tsx scripts/create-admin.ts \
  --org-name "Your Center Name" --org-code YOURCODE --name "Your Name" --email you@yourcenter.in
```
The temporary password is printed once. Sign in and set a new password. This also creates the seven default services (English + Telugu names).

## Staff accounts (Administration → Staff)

- **Add staff member**: name, login e-mail, professional details (registration no., e.g. RCI) and one or more **roles**. A 12-character temporary password is shown once — give it privately (in person/phone, not a group chat). The person must change it at first sign-in.
- **Edit**: change details or roles. At least one active administrator must always remain.
- **Deactivate** when someone leaves — the same day. Their sessions end immediately; their records stay.
- **Reset password**: issues a new temporary password and signs the person out everywhere.
- **Availability**: mark leave/training days. Unavailable therapists cannot be booked; the dashboard shows availability.

Role summary:

| Role | Can do |
|---|---|
| Administrator | Register/edit/archive children, scheduling for everyone, consents, care teams, documents, staff, services, audit log, exports. **No clinical notes.** |
| Clinical coordinator | Everything clinical for all children incl. restricted records, approve plans and reports, care teams, consents, reports, audit log |
| Speech / Occupational / Physio / Behaviour / Special educator | Their care-team children: assessments, plans, sessions, progress, messages, documents; schedule their own appointments |
| Psychologist | As above, plus restricted psychological records and approving psychological reports |

A person can hold several roles (e.g. special educator + behaviour professional).

## Children
- **Register** (Children → Register child) requires the guardian's consent for registration and data processing. IDs (`CDC-0001`) are assigned automatically.
- **Care team** (child Overview → Assign professional): therapists only see children on their care team. Remove people when they stop working with a child.
- **Consents** (child Overview → Record consent). Required: *Therapy services* before scheduling; *Parent portal access* before creating a parent login or sharing reports; *AI-assisted drafting* before AI tools may use a child's age/goals. Recording "Withdrawn" for portal consent removes portal access immediately.
- **Parent portal login** (Guardians tab → Create portal login): needs the guardian's e-mail and portal consent. Give the temporary password privately.
- **Archive** instead of deleting. Archived records are read-only and can be restored. Nothing is ever deleted from the UI.

## Services (Administration → Services)
Edit names (English/Telugu), descriptions and default session lengths, or deactivate a service.

## Reports
- **Reports** page: monthly attendance and operational summary by service and therapist. Attendance rate = completed ÷ (completed + no-show + family cancellations); shown only when there is data.
- **Consents** page: latest consent status for every child, with gaps marked "Missing".
- **Audit log**: every important action (sign-ins, registrations, edits with before/after values, consents, sessions, downloads, exports). Entries cannot be edited or deleted.

## Data export (Administration → Data export)
CSV exports of children, appointments, sessions, goals, consents and staff. Restricted psychological content and free-text clinical notes are excluded. Exports are audited. Store exported files securely and delete them when no longer needed.

## Backups

Run daily (cron) on a trusted machine:
```bash
ENV_FILE=.env.production.local BACKUP_PASSPHRASE_FILE=/root/careos-backup-passphrase \
BACKUP_DIR=/var/backups/careos npm run db:backup
```
- Produces `careos-db-<timestamp>.dump.enc` and `careos-files-<timestamp>.tgz.enc` (AES-256).
- Keep the passphrase file separate from the backups (e.g. a sealed envelope + password manager). **Without it backups cannot be restored.**
- Copy backups off-site daily (another region/provider). Keep 30 daily + 12 monthly copies (adjust to your legal retention advice).

### Restoring a backup
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -pass file:/path/passphrase -in careos-db-XXXX.dump.enc > restore.dump
pg_restore --clean --if-exists --no-owner -d "$DATABASE_OWNER_URL" restore.dump
openssl enc -d -aes-256-cbc -pbkdf2 -pass file:/path/passphrase -in careos-files-XXXX.tgz.enc | tar -xzf - -C "$STORAGE_DIR"
npm run db:migrate   # re-applies grants for the app role
shred -u restore.dump
```
Test a restore into a separate database every quarter.

## Routine checklist
- Daily: check dashboard for pending session notes; confirm backup ran.
- Weekly: review new family messages are acknowledged; consents overview for gaps.
- Monthly: review audit log for unusual activity (failed logins, exports); review reports.
- Quarterly: access review (deactivate leavers, remove stale care-team assignments), restore test.

## Language
Everyone can switch English/తెలుగు from the sidebar or Settings. The choice is remembered for their account.
