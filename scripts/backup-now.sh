#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/backups}"
mkdir -p "$BACKUP_DIR"

DB_HOST="${DB_HOST:-postgres}"
DB_NAME="${DB_NAME:-lounge}"
DB_USER="${DB_USER:-lounge}"
DB_PASSWORD="${DB_PASSWORD:-}"

BACKUP_FILE="$BACKUP_DIR/db_${DB_NAME}_${TIMESTAMP}.sql.gz"
ENCRYPTED_FILE="$BACKUP_FILE.enc"

log() { echo "[$(date -Iseconds)] $*"; }

log "🔵 Backup started for database: $DB_NAME"

# 1. pg_dump + gzip
log "📦 Dumping database..."
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=plain \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    | gzip -9 > "$BACKUP_FILE" 2>/dev/null || {
        # Fallback if running outside docker container or without direct pg_dump
        docker exec -t lounge_postgres pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip -9 > "$BACKUP_FILE"
    }

log "✅ Dump complete"

# 2. Encrypt if key provided
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    log "🔒 Encrypting..."
    openssl enc -aes-256-cbc -salt -pbkdf2 \
        -in "$BACKUP_FILE" \
        -out "$ENCRYPTED_FILE" \
        -pass pass:"$BACKUP_ENCRYPTION_KEY"
    rm "$BACKUP_FILE"
    FINAL_FILE="$ENCRYPTED_FILE"
    log "✅ Encrypted: $FINAL_FILE"
else
    FINAL_FILE="$BACKUP_FILE"
fi

log "✅ Backup completed successfully: $FINAL_FILE"
