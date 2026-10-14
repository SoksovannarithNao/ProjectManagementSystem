#!/usr/bin/env bash
# Fails when a Flyway migration has not been folded into the init scripts.
#
# database/init/01-init.sql holds the END STATE of every migration up to the baseline recorded in
# 04-flyway-baseline.sql, so a database built from the init scripts has nothing left for Flyway to
# apply. Run against such a database (the CI job loads the init scripts into a throw-away one), this
# script runs `flyway migrate` and fails if
#   - Flyway applies anything: a migration newer than the baseline exists that 01-init.sql does not
#     contain (a fresh volume would not have it), or the baseline was not raised; or
#   - Flyway cannot run at all: the schema history is missing or damaged (04-flyway-baseline.sql was
#     not loaded).
# It does not check that an old migration was left unedited: an init-built database records everything
# up to the baseline as one baseline row, so Flyway has no checksum to compare for V1 to the baseline
# (a volume with real history, as `docker compose up` migrates, does validate them).
# A database cannot be built from the migrations alone (issue X-04), which is why the check is made
# this way round.
#
# Usage: database/check_migrations_folded.sh JDBC_URL USER PASSWORD [MIGRATIONS_DIR]
# Needs docker; FLYWAY_NETWORK (default "host") is the docker network the database is reachable on.
set -euo pipefail

url="${1:?usage: $0 JDBC_URL USER PASSWORD [MIGRATIONS_DIR]}"
user="${2:?usage: $0 JDBC_URL USER PASSWORD [MIGRATIONS_DIR]}"
password="${3:?usage: $0 JDBC_URL USER PASSWORD [MIGRATIONS_DIR]}"
dir="${4:-$(cd "$(dirname "$0")" && pwd)/taskmanager/migrations}"
network="${FLYWAY_NETWORK:-host}"

status=0
output=$(docker run --rm --network "$network" -v "$dir:/flyway/sql:ro" flyway/flyway:11 \
  -url="$url" -user="$user" -password="$password" -locations=filesystem:/flyway/sql migrate 2>&1) || status=$?
echo "$output"

if [ "$status" -ne 0 ]; then
  echo "::error::Flyway could not run against the database built from database/init (04-flyway-baseline.sql not loaded, or the schema history is damaged)"
  exit 1
fi
if grep -q "Successfully applied" <<<"$output"; then
  echo "::error::Flyway applied a migration to a database built from database/init: fold its end state into 01-init.sql and raise the baseline in 04-flyway-baseline.sql (and the version in its comment)"
  exit 1
fi
echo "Every migration is already part of the init scripts."
