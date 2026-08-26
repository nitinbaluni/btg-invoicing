#!/bin/sh
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups
FILE="$BACKUP_DIR/btg_billing_$TIMESTAMP.sql.gz"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup -> $FILE"
pg_dump -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$FILE"
echo "[$(date)] Backup complete: $(du -h "$FILE" | cut -f1)"

# Local retention cleanup
find "$BACKUP_DIR" -name "btg_billing_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

# --- Optional offsite copy ---
# Uncomment and configure once you've provisioned S3 / Backblaze B2 / another VPS.
# Requires the `aws` CLI (S3-compatible) baked into this image or mounted in.
#
# aws s3 cp "$FILE" "s3://${OFFSITE_BUCKET}/btg-billing-backups/" \
#   --endpoint-url "${OFFSITE_ENDPOINT}"
#
# Until offsite storage is configured, treat this container's `backups` volume
# as your ONLY copy and manually copy it off the host periodically.
