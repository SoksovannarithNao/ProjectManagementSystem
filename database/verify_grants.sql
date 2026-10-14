-- Task & Project Management System - application-role grant check.
--
-- Run it AFTER the taskmanager_app role exists (03-app-role.sh locally, the same script in CI):
--   psql -t -A -d <database> -f database/verify_grants.sql
-- It must print NOTHING. A row means a table the backend role cannot read: a new table was
-- added without a GRANT in database/init/03-app-role.sh (and, for a database that already
-- exists, in the migration that creates the table), which shows up at run time as a 500 on the
-- first request that touches it.
--
-- A table that really has no entity (so the backend must not touch it) goes on the list below
-- instead, which makes leaving it ungranted a decision rather than an oversight:
--   flyway_schema_history  Flyway's own bookkeeping
--   kpi_snapshots          designed for stored KPI values; the KPIs are calculated live
--   report_exports         designed for export metadata; exports are made in the browser

SELECT c.relname AS table_the_app_role_cannot_read
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname NOT IN ('flyway_schema_history', 'kpi_snapshots', 'report_exports')
  AND NOT has_table_privilege('taskmanager_app', c.oid, 'SELECT')
ORDER BY c.relname;
