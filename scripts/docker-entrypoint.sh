#!/bin/sh
set -e

# Build DATABASE_URL from parts unless one was provided explicitly.
# Credentials are URL-encoded so passwords may contain any characters.
build_database_url() {
  DB_URL_USER="$1" DB_URL_DB="$2" node -e '
    const e = encodeURIComponent;
    const user = process.env.DB_URL_USER || "myimmigration";
    const pass = process.env.POSTGRES_PASSWORD || "";
    const host = process.env.DB_HOST || "db";
    const port = process.env.DB_PORT || "5432";
    const dbname = process.env.DB_URL_DB || "myimmigration";
    console.log(`postgresql://${e(user)}:${e(pass)}@${host}:${port}/${e(dbname)}?schema=public`);
  '
}

LEGACY_DATABASE_URL=""
if [ -z "$DATABASE_URL" ]; then
  DATABASE_URL="$(build_database_url "${POSTGRES_USER:-myimmigration}" "${POSTGRES_DB:-myimmigration}")"
  LEGACY_DATABASE_URL="$(build_database_url "myimmigration" "myimmigration")"
  export DATABASE_URL
fi

echo "Waiting for the database..."
i=0
until npx prisma migrate deploy > /tmp/migrate.log 2>&1; do
  if [ -n "$LEGACY_DATABASE_URL" ] && [ "$DATABASE_URL" != "$LEGACY_DATABASE_URL" ]; then
    if DATABASE_URL="$LEGACY_DATABASE_URL" npx prisma migrate deploy > /tmp/migrate.log 2>&1; then
      echo "Using existing myimmigration database defaults for compatibility."
      DATABASE_URL="$LEGACY_DATABASE_URL"
      export DATABASE_URL
      break
    fi
  fi
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "Database not reachable after 30 attempts:"
    cat /tmp/migrate.log
    exit 1
  fi
  sleep 2
done
cat /tmp/migrate.log

echo "Seeding defaults (idempotent)..."
node node_modules/tsx/dist/cli.mjs prisma/seed.ts

echo "Starting ImmigrationOnMe..."
exec npm run start
