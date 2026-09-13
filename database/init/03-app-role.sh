#!/usr/bin/env bash
# Task & Project Management System — least-privilege application role.
#
# Runs after 01-init.sql/02-seed.sql (docker-entrypoint-initdb.d executes
# every .sql/.sh file in this folder in filename order, against an empty data
# directory). The backend connects as this role instead of the Postgres
# superuser (${POSTGRES_USER}) from here on — see docker-compose.yml and
# .env.example for how SPRING_DATASOURCE_USERNAME/PASSWORD are wired to it.
#
# A shell script (not plain SQL) because the role's password has to come from
# an environment variable rather than being hardcoded in a committed file.
#
# The heredoc delimiter below is quoted ('EOSQL', not EOSQL) so bash performs
# zero expansion or quote-parsing inside it — the password/db name are passed
# in as psql -v variables and interpolated by psql itself (:'var' for a safely
# quoted SQL string literal, :"var" for a quoted identifier). This avoids a
# real bash gotcha: an unquoted heredoc still tracks single-quote balance for
# the whole body, so an English contraction in a comment (e.g. "role's") can
# pair up with unrelated SQL string-literal quotes and break parsing.
set -euo pipefail

: "${TASKMANAGER_APP_PASSWORD:?TASKMANAGER_APP_PASSWORD must be set for the app role password}"

psql -v ON_ERROR_STOP=1 \
     -v app_password="$TASKMANAGER_APP_PASSWORD" \
     -v app_db="$POSTGRES_DB" \
     --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-'EOSQL'
    -- psql's :'var' interpolation only applies to top-level statement text,
    -- not inside a DO $$ ... $$ block (a dollar-quoted string is opaque to
    -- it, same as a regular '...' string) — so the DO block below only
    -- handles the conditional CREATE, and the password is set immediately
    -- after via a plain top-level ALTER ROLE, which runs every time and so
    -- also keeps the password in sync if this script is ever re-run by hand.
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taskmanager_app') THEN
            CREATE ROLE taskmanager_app LOGIN;
        END IF;
    END
    $$;

    ALTER ROLE taskmanager_app LOGIN PASSWORD :'app_password';

    GRANT CONNECT ON DATABASE :"app_db" TO taskmanager_app;
    GRANT USAGE ON SCHEMA public TO taskmanager_app;

    -- Only the tables the backend's JPA entities actually touch today.
    -- Add a matching line here when a new table gets a real entity/repository
    -- (see database/README.md).
    GRANT SELECT, INSERT, UPDATE, DELETE ON
        roles, users, projects, project_members, milestones,
        tasks, task_assignees, task_dependencies, notifications
        TO taskmanager_app;

    -- GENERATED ALWAYS AS IDENTITY columns still back onto a real sequence;
    -- a non-owner role needs USAGE on it to INSERT (the implicit nextval()
    -- call during identity generation is subject to the same ACL check as an
    -- explicit one — a well-known "permission denied for sequence ..._id_seq"
    -- gotcha if this is skipped).
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO taskmanager_app;

    -- Not currently required — Postgres grants EXECUTE on new functions to
    -- PUBLIC by default and nothing in this schema revokes it, so triggers
    -- (which run with the invoking role's privileges; none of these
    -- functions are SECURITY DEFINER) already fire correctly under this role
    -- via the table grants above. Kept explicit anyway as documentation and
    -- in case default privileges are ever locked down later.
    GRANT EXECUTE ON FUNCTION fn_compute_project_progress(BIGINT) TO taskmanager_app;
    GRANT EXECUTE ON FUNCTION fn_compute_milestone_progress(BIGINT) TO taskmanager_app;
    GRANT EXECUTE ON FUNCTION fn_generate_overdue_notifications() TO taskmanager_app;
EOSQL
