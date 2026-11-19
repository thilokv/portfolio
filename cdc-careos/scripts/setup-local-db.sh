#!/usr/bin/env bash
# Creates local PostgreSQL roles + databases for CDC CareOS development and
# writes .env.local / .env.test with freshly generated passwords.
# Usage:  bash scripts/setup-local-db.sh        (needs a local PostgreSQL 14+ and sudo/postgres access)
set -euo pipefail
PSQL=${PSQL:-"sudo -u postgres psql -v ON_ERROR_STOP=1"}
OWNER_PW=$(openssl rand -hex 16)
APP_PW=$(openssl rand -hex 16)

$PSQL <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'careos_owner') THEN CREATE ROLE careos_owner LOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'careos_app') THEN CREATE ROLE careos_app LOGIN NOSUPERUSER NOBYPASSRLS; END IF;
END \$\$;
ALTER ROLE careos_owner PASSWORD '${OWNER_PW}';
ALTER ROLE careos_app PASSWORD '${APP_PW}';
SQL
for DB in careos_dev careos_test; do
  $PSQL -tc "SELECT 1 FROM pg_database WHERE datname='${DB}'" | grep -q 1 || $PSQL -c "CREATE DATABASE ${DB} OWNER careos_owner"
  $PSQL -d "${DB}" -c "CREATE EXTENSION IF NOT EXISTS btree_gist"
done

write_env() {
  cat > "$1" <<ENV
DATABASE_URL=postgres://careos_app:${APP_PW}@localhost:5432/$2
DATABASE_OWNER_URL=postgres://careos_owner:${OWNER_PW}@localhost:5432/$2
DATABASE_APP_ROLE=careos_app
DATABASE_SSL=false
APP_URL=http://localhost:$3
SESSION_MAX_AGE_HOURS=12
SESSION_IDLE_TIMEOUT_MINUTES=60
STORAGE_DIR=$4
AI_PROVIDER=mock
MAIL_TRANSPORT=console
ENV
}
write_env .env.local careos_dev 3000 ./storage
write_env .env.test careos_test 3100 ./storage-test
echo "Databases ready. Wrote .env.local and .env.test (never commit these)."
echo "Next: npm run db:migrate && npm run db:seed && npm run dev"
