#!/usr/bin/env bash
# Encrypted logical backup of the CareOS database + uploaded documents.
#   BACKUP_PASSPHRASE_FILE=/secure/path/passphrase npm run db:backup
# Restore: see docs/ADMIN_GUIDE.md ("Restoring a backup").
set -euo pipefail
ENV_FILE=${ENV_FILE:-.env.local}
set -a; source "$ENV_FILE"; set +a
: "${DATABASE_OWNER_URL:?DATABASE_OWNER_URL not set}"
: "${BACKUP_PASSPHRASE_FILE:?Set BACKUP_PASSPHRASE_FILE to a file containing the encryption passphrase}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT=${BACKUP_DIR:-./backups}
mkdir -p "$OUT"; chmod 700 "$OUT"
pg_dump --format=custom --no-owner "$DATABASE_OWNER_URL" \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:${BACKUP_PASSPHRASE_FILE}" > "$OUT/careos-db-$STAMP.dump.enc"
if [ -d "${STORAGE_DIR:-./storage}" ]; then
  tar -C "${STORAGE_DIR:-./storage}" -czf - . \
    | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:${BACKUP_PASSPHRASE_FILE}" > "$OUT/careos-files-$STAMP.tgz.enc"
fi
chmod 600 "$OUT"/*-"$STAMP".*
echo "Encrypted backup written to $OUT (timestamp $STAMP). Copy it off-site."
