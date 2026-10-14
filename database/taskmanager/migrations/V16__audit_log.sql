-- Task & Project Management System - the administrator audit log.
-- Applied on top of V15__project_lead.sql.
--
-- Part A lists an Audit Log ("which user did what, when, and on which project or task") as
-- optional, and the specification (assignment-brief.md B10, workflow A7, D-11) separates it
-- from the project activity feed: it is for the Administrator, records sensitive
-- administrative actions with the value before and after, and is append-only.
--
--   * audit_logs has NO foreign keys: an entry must outlive the user, role or project it
--     describes, so the actor and the target are stored as ids plus a readable name.
--   * It is append-only twice over: the application role is granted SELECT and INSERT only,
--     and a trigger refuses any UPDATE or DELETE (even for the table owner).
--
-- Idempotent: every step checks whether it is already done.

CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id     BIGINT,
    actor_name   VARCHAR(150) NOT NULL,
    action       VARCHAR(40) NOT NULL
                 CHECK (action IN ('USER_ROLE_CHANGED', 'PERMISSIONS_CHANGED', 'PROJECT_ROLE_CHANGED',
                                   'OWNERSHIP_TRANSFERRED', 'ACCOUNT_CREATED', 'ACCOUNT_STATUS_CHANGED',
                                   'ACCOUNT_DELETED', 'PROJECT_DELETED',
                                   'ROLE_CREATED', 'ROLE_UPDATED', 'ROLE_DELETED')),
    target_type  VARCHAR(20) NOT NULL CHECK (target_type IN ('USER', 'ROLE', 'PROJECT')),
    target_id    BIGINT,
    target_label VARCHAR(255),
    -- The project an entry belongs to, so its Owner can read the ownership entries (D-11).
    project_id   BIGINT,
    before_value TEXT,
    after_value  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON audit_logs (project_id) WHERE project_id IS NOT NULL;

CREATE OR REPLACE FUNCTION audit_logs_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'The audit log is append-only: entries cannot be changed or deleted'
        USING ERRCODE = '23514'; -- check_violation, cleaned for the client by GlobalExceptionHandler
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON audit_logs;
CREATE TRIGGER trg_audit_logs_append_only
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

-- The application role may add and read entries, never change or remove them.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taskmanager_app') THEN
        GRANT SELECT, INSERT ON audit_logs TO taskmanager_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO taskmanager_app;
    END IF;
END $$;
