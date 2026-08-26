#!/bin/sh
# Restore a backup produced by backup.sh
#
# Usage (run from the host, in the project directory):
#   ./deploy/restore.sh /path/to/btg_billing_20260101_020000.sql.gz
#
# WARNING: this drops and recreates the target database. Take a fresh backup
# of the current state first if you might need to roll back this restore.

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
COMPOSE="docker compose"

echo "This will DROP and recreate the database inside the 'db' container."
read -p "Type 'restore' to continue: " CONFIRM
if [ "$CONFIRM" != "restore" ]; then
  echo "Aborted."
  exit 1
fi

echo "Stopping app and worker so nothing writes during restore..."
$COMPOSE stop app worker

echo "Recreating database..."
$COMPOSE exec -T db psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB:-btg_billing};"
$COMPOSE exec -T db psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE ${POSTGRES_DB:-btg_billing};"

echo "Restoring from $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | $COMPOSE exec -T db psql -U "$POSTGRES_USER" -d "${POSTGRES_DB:-btg_billing}"

echo "Restarting app and worker..."
$COMPOSE start app worker

echo "Restore complete. Verify data in the app before resuming normal use."
