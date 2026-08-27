#!/usr/bin/env bash
# Per-boot reconciliation for ImmigrationOnMe: ensure the local PostgreSQL
# cluster prepared by install.sh is running and accepting connections.
# Idempotent and self-healing: a no-op when already serving, and it clears
# stale pid/socket state left behind when a previous postgres process (e.g. one
# captured in a snapshot) is no longer alive.
set -euo pipefail

PGDATA="${PGDATA:-$HOME/pgdata}"
PGPORT="${PGPORT:-5432}"

PG_BIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
export PATH="$PG_BIN:$PATH"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "No PostgreSQL cluster found at $PGDATA. Run .cursor/install.sh first." >&2
  exit 1
fi

pg_serving() { pg_isready -h 127.0.0.1 -p "$PGPORT" -U postgres >/dev/null 2>&1; }

if pg_serving; then
  echo "PostgreSQL already accepting connections on port $PGPORT"
  exit 0
fi

# Nothing is accepting connections. Clear stale state so a fresh start succeeds.
if [ -f "$PGDATA/postmaster.pid" ]; then
  stale_pid="$(head -n 1 "$PGDATA/postmaster.pid" 2>/dev/null || true)"
  if [ -n "$stale_pid" ] && kill -0 "$stale_pid" 2>/dev/null \
     && grep -qi postgres "/proc/$stale_pid/comm" 2>/dev/null; then
    # A real postgres process exists but is not accepting connections; stop it.
    pg_ctl -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
  rm -f "$PGDATA/postmaster.pid"
fi
rm -f "/tmp/.s.PGSQL.${PGPORT}" "/tmp/.s.PGSQL.${PGPORT}.lock"

pg_ctl -D "$PGDATA" -o "-p $PGPORT -k /tmp" -l "$HOME/pg.log" -w start

for _ in $(seq 1 30); do
  if pg_serving; then
    echo "PostgreSQL is ready on port $PGPORT"
    exit 0
  fi
  sleep 1
done

echo "PostgreSQL did not become ready in time" >&2
exit 1
