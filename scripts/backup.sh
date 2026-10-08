#!/usr/bin/env bash
# Dumps the public schema (structure and data) to backups/pms-<timestamp>.sql
# Usage: DATABASE_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres' ./scripts/backup.sh
# Get the connection string from Supabase > Project Settings > Database. Never commit it.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to your Supabase connection string}"
command -v pg_dump >/dev/null || { echo "pg_dump is not installed (install PostgreSQL client tools)"; exit 1; }
mkdir -p backups
out="backups/pms-$(date +%Y%m%d-%H%M%S).sql"
pg_dump "$DATABASE_URL" --schema=public --no-owner --no-privileges --file="$out"
echo "Backup written to $out"
