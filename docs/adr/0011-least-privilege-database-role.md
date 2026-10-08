# ADR-0011: The backend connects as a least-privilege database role

- **Status:** Accepted
- **Date:** 2026-09-13 (`5f21740`, `03-app-role.sh`)
- **Area:** infrastructure / security

## Context

Docker Compose creates a PostgreSQL superuser (`POSTGRES_USER`). Letting the application use it would give a bug or compromise in the backend unlimited power over the database.

## Decision

`database/init/03-app-role.sh` creates a separate login role **`taskmanager_app`** (password from `TASKMANAGER_APP_PASSWORD`) with only:

- `CONNECT` on the database and `USAGE` on schema `public`;
- `SELECT, INSERT, UPDATE, DELETE` on the **15 tables that have JPA entities**;
- `USAGE, SELECT` on all sequences (needed because `GENERATED ALWAYS AS IDENTITY` keys use a sequence);
- explicit `EXECUTE` on three functions (redundant today, kept as documentation).

No `SUPERUSER`, `CREATEDB` or `CREATEROLE`. The backend's defaults and the compose file use this role; the superuser is reserved for container initialisation and migrations. The script is a shell script (not SQL) so the password comes from the environment instead of a committed file.

## Alternatives considered

- **Connect as the superuser** — avoided (stated in the script and READMEs).
- **Hard-code the role password in SQL** — avoided; hence the shell script with `psql -v` variables.

## Consequences

- A compromised application process cannot alter the schema, create roles or read tables it has no entity for.
- **Adding an entity for a new table requires adding a `GRANT`** to `03-app-role.sh` — and to the duplicated list in `.github/workflows/ci.yml`. These have drifted: CI grants 10 tables, the script 15 (issue X-05).
- The 7 tables without entities (and all views) are not granted, so a future reporting endpoint over the views needs new grants.
- The role only exists in databases initialised from an empty volume; an existing volume needs a reset (or a manual `CREATE ROLE`).
- The development default password (`taskmanager_app_password`) is in `.env.example` and `docker-compose.yml`; production must override it.

## Evidence

`database/init/03-app-role.sh`, `docker-compose.yml`, `.env.example`, `../database.md` (Least-privilege application role), `.github/workflows/ci.yml`.
