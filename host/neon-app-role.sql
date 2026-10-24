-- Least-privilege application role for a hosted database (Neon).
--
-- Same grants as database/init/03-app-role.sh, written as plain SQL so it can run with
-- `psql -f` where there is no Docker entrypoint. Run it AFTER 01-init.sql, 02-seed.sql and
-- 04-flyway-baseline.sql (see host/README.md). The password is passed in on the command
-- line (psql -v app_password=...), never stored in this file.
--
-- Keep the table list in step with database/init/03-app-role.sh.

\set ON_ERROR_STOP on

SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taskmanager_app') AS need_role \gset
\if :need_role
    CREATE ROLE taskmanager_app LOGIN;
\endif

ALTER ROLE taskmanager_app LOGIN PASSWORD :'app_password';

GRANT CONNECT ON DATABASE :"app_db" TO taskmanager_app;
GRANT USAGE ON SCHEMA public TO taskmanager_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    roles, users, projects, project_members, milestones,
    tasks, task_assignees, task_dependencies, notifications,
    otp_verifications, positions, departments, subtasks, comments,
    activity_logs, work_logs, role_permissions, task_approvals,
    attachments, attachment_contents, checklist_items, refresh_tokens, user_identities
    TO taskmanager_app;

GRANT SELECT ON permissions TO taskmanager_app;

-- The audit log is append-only: the backend may add and read entries, never change or remove them.
GRANT SELECT, INSERT ON audit_logs TO taskmanager_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO taskmanager_app;

GRANT EXECUTE ON FUNCTION fn_compute_project_progress(BIGINT) TO taskmanager_app;
GRANT EXECUTE ON FUNCTION fn_compute_milestone_progress(BIGINT) TO taskmanager_app;
GRANT EXECUTE ON FUNCTION fn_generate_overdue_notifications() TO taskmanager_app;
