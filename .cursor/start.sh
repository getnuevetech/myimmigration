#!/usr/bin/env bash
# Per-boot reconciliation for ImmigrationOnMe: start the local PostgreSQL
# cluster prepared by install.sh and wait until it accepts connections.
# Idempotent: a no-op if PostgreSQL is already running.
set -euo pipefail

PGDATA="${PGDATA:-$HOME/pgdata}"
PGPORT="${PGPORT:-5432}"

PG_BIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
export PATH="$PG_BIN:$PATH"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "No PostgreSQL cluster found at $PGDATA. Run .cursor/install.sh first." >&2
  exit 1
fi

if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  pg_ctl -D "$PGDATA" -o "-p $PGPORT -k /tmp" -l "$HOME/pg.log" -w start
fi

for _ in $(seq 1 30); do
  if pg_isready -h 127.0.0.1 -p "$PGPORT" -U postgres >/dev/null 2>&1; then
    echo "PostgreSQL is ready on port $PGPORT"
    exit 0
  fi
  sleep 1
done

echo "PostgreSQL did not become ready in time" >&2
exit 1
