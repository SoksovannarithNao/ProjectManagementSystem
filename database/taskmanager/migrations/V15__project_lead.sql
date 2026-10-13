-- Task & Project Management System - a Team Leader can be named the project's lead.
-- Applied on top of V14__project_completed_at.sql.
--
-- Part A says the application designates "the Project Manager or Team Leader responsible
-- for each project". The specification keeps one responsible person per project, the
-- Owner (D-09), and lets a Team Leader be listed beside the Owner as the project's lead.
-- This adds projects.lead_id for that, with two rules kept by the database:
--   * the lead must be an ACTIVE Team Leader (project role ADMIN) of that project
--     (trg_projects_lead_is_team_leader);
--   * when that person stops being one - demoted, made the Owner, set aside or removed
--     from the project - the lead is cleared (trg_project_members_clear_lead).
-- Deleting the user clears it too (ON DELETE SET NULL). The new activity action
-- PROJECT_LEAD_CHANGED is added to the allowed list.
--
-- Idempotent: every step checks whether it is already done.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS lead_id BIGINT REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_lead_id ON projects (lead_id);

CREATE OR REPLACE FUNCTION check_project_lead_is_team_leader()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lead_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = NEW.id AND user_id = NEW.lead_id
          AND project_role = 'ADMIN' AND status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'The project lead must be an active Team Leader of the project'
            USING ERRCODE = '23514'; -- check_violation, cleaned for the client by GlobalExceptionHandler
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_lead_is_team_leader ON projects;
CREATE TRIGGER trg_projects_lead_is_team_leader
    BEFORE INSERT OR UPDATE OF lead_id ON projects
    FOR EACH ROW EXECUTE FUNCTION check_project_lead_is_team_leader();

CREATE OR REPLACE FUNCTION clear_project_lead_when_not_team_leader()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE projects SET lead_id = NULL WHERE id = OLD.project_id AND lead_id = OLD.user_id;
    ELSIF NEW.project_role <> 'ADMIN' OR NEW.status <> 'ACTIVE' THEN
        UPDATE projects SET lead_id = NULL WHERE id = NEW.project_id AND lead_id = NEW.user_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_members_clear_lead ON project_members;
CREATE TRIGGER trg_project_members_clear_lead
    AFTER UPDATE OF project_role, status OR DELETE ON project_members
    FOR EACH ROW EXECUTE FUNCTION clear_project_lead_when_not_team_leader();

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint
               WHERE conrelid = 'activity_logs'::regclass AND conname = 'activity_logs_action_check'
                 AND strpos(pg_get_constraintdef(oid), 'PROJECT_LEAD_CHANGED') = 0) THEN
        ALTER TABLE activity_logs DROP CONSTRAINT activity_logs_action_check;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'activity_logs'::regclass AND conname = 'activity_logs_action_check') THEN
        ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_action_check
            CHECK (action IN ('PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_COMPLETED', 'PROJECT_LEAD_CHANGED',
                              'TASK_CREATED', 'TASK_DELETED', 'TASK_ASSIGNED', 'TASK_UNASSIGNED',
                              'TASK_STATUS_CHANGED', 'TASK_PRIORITY_CHANGED', 'TASK_DUE_DATE_CHANGED',
                              'TASK_COMPLETED', 'SUBTASK_ADDED', 'SUBTASK_COMPLETED', 'SUBTASK_DELETED',
                              'COMMENT_ADDED', 'FILE_UPLOADED',
                              'MILESTONE_CREATED', 'MILESTONE_COMPLETED',
                              'TASK_APPROVAL_REQUESTED', 'TASK_APPROVED', 'TASK_CHANGES_REQUESTED',
                              'TASK_REJECTED', 'TASK_APPROVER_SET'));
    END IF;
END $$;
