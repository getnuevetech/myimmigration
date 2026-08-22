#!/usr/bin/env bash
# Idempotent Cloud Agent install for ImmigrationOnMe.
# Installs PostgreSQL, prepares a user-owned dev cluster + database, installs
# Node dependencies, generates the Prisma client, applies migrations, and seeds
# defaults. Safe to run repeatedly and against a cached/snapshotted VM.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

PGDATA="${PGDATA:-$HOME/pgdata}"
PGPORT="${PGPORT:-5432}"
DB_USER="${DB_USER:-myimmigration}"
DB_PASSWORD="${DB_PASSWORD:-myimmigration_dev_password}"
DB_NAME="${DB_NAME:-myimmigration}"

echo "==> Ensuring PostgreSQL is installed"
if ! ls /usr/lib/postgresql/*/bin/initdb >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql postgresql-contrib
fi
PG_BIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
export PATH="$PG_BIN:$PATH"

echo "==> Ensuring a local PostgreSQL cluster exists at $PGDATA"
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null
fi

echo "==> Starting PostgreSQL (idempotent, self-healing)"
PGDATA="$PGDATA" PGPORT="$PGPORT" bash "$REPO_DIR/.cursor/start.sh"

echo "==> Ensuring database role and database exist"
psql -h 127.0.0.1 -p "$PGPORT" -U postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
  || psql -h 127.0.0.1 -p "$PGPORT" -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD'"
psql -h 127.0.0.1 -p "$PGPORT" -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || psql -h 127.0.0.1 -p "$PGPORT" -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER"

echo "==> Ensuring .env points at the local database"
if [ ! -f "$REPO_DIR/.env" ]; then
  cat > "$REPO_DIR/.env" <<EOF
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@127.0.0.1:$PGPORT/$DB_NAME?schema=public"
EOF
fi

echo "==> Installing Node dependencies"
npm ci

echo "==> Generating Prisma client and applying schema"
npx prisma generate
npx prisma migrate deploy
npx prisma db seed

echo "==> Install complete"
