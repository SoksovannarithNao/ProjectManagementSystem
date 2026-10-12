-- Task & Project Management System - record when a project was completed.
-- Applied on top of V13__attachments_checklists.sql.
--
-- Part A and workflow flow 40 end with "Complete Project (with a date)": a task has had
-- completed_at since V1, a project only had its status. This adds projects.completed_at
-- and keeps it in step with the status the same way tasks do (trg_tasks_completed_at):
--   * status becomes COMPLETED  -> completed_at is stamped with now() (only if empty,
--     so editing a completed project keeps the original date),
--   * status is anything else   -> completed_at is cleared (a reopened project has none).
-- Projects that are already COMPLETED get their last update time as the best date
-- available (the real completion time was never recorded).
--
-- Idempotent: the column and trigger are created only when missing, and the backfill
-- touches only COMPLETED rows with no date, so a re-run (or a database built from the
-- new 01-init.sql) changes nothing.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION set_project_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND NEW.completed_at IS NULL THEN
        NEW.completed_at = now();
    ELSIF NEW.status <> 'COMPLETED' THEN
        NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_completed_at ON projects;
CREATE TRIGGER trg_projects_completed_at
    BEFORE INSERT OR UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_project_completed_at();

-- Backfill. The user triggers are switched off for it (as V11 does) so the rewrite
-- does not also move updated_at and re-run the progress calculation.
ALTER TABLE projects DISABLE TRIGGER USER;
UPDATE projects SET completed_at = updated_at WHERE status = 'COMPLETED' AND completed_at IS NULL;
ALTER TABLE projects ENABLE TRIGGER USER;
