-- Task & Project Management System - two task rules that every way of changing a status must obey.
-- Applied on top of V16__audit_log.sql.
--
-- Found while adding drag-and-drop to the Kanban board (checklist #35), which sets a status the
-- same way the task panel does:
--
-- 1. A prerequisite cannot be taken back out of COMPLETED while a task that depends on it is
--    running or finished. trg_tasks_dependencies_status_gate only looks at a task's OWN
--    prerequisites, so reopening (or cancelling) the prerequisite itself used to leave its
--    dependants IN_PROGRESS / IN_REVIEW / COMPLETED on an unfinished task - the state the
--    invariant check no. 2 exists to catch. New trigger trg_tasks_prerequisite_not_reopened.
--
-- 2. Progress follows the status when there are no subtasks or checklist items to derive it from:
--    a task entering COMPLETED is 100, and one leaving COMPLETED goes back to 0. (With subtasks
--    or items the number is still derived from them.) Before, only the quick-advance circle set
--    100, so a task completed from the panel kept its old number, and a reopened task stayed at 100.
--    The function behind trg_tasks_progress_derived_from_subtasks is extended; a backfill fixes
--    COMPLETED tasks that were left below 100.
--
-- Idempotent: functions are replaced, the trigger is dropped and re-created, and the backfill
-- touches only rows that are still wrong.

CREATE OR REPLACE FUNCTION check_prerequisite_not_reopened()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'COMPLETED' AND NEW.status <> 'COMPLETED' AND EXISTS (
        SELECT 1
        FROM task_dependencies td
        JOIN tasks dependant ON dependant.id = td.task_id
        WHERE td.depends_on_task_id = NEW.id
          AND dependant.status IN ('IN_PROGRESS', 'IN_REVIEW', 'COMPLETED')
    ) THEN
        RAISE EXCEPTION 'Task % is a prerequisite of tasks that have already started; move those back to To Do before taking it out of COMPLETED',
            NEW.id
            USING ERRCODE = '23514'; -- check_violation, cleaned for the client by GlobalExceptionHandler
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_prerequisite_not_reopened ON tasks;
CREATE TRIGGER trg_tasks_prerequisite_not_reopened
    BEFORE UPDATE OF status ON tasks
    FOR EACH ROW EXECUTE FUNCTION check_prerequisite_not_reopened();

CREATE OR REPLACE FUNCTION trg_fn_tasks_progress_derived_from_subtasks()
RETURNS TRIGGER AS $$
DECLARE
    v_progress NUMERIC;
BEGIN
    v_progress := fn_compute_task_progress_from_subtasks(NEW.id, NEW.status);
    IF v_progress IS NOT NULL THEN
        NEW.progress = v_progress;
    ELSIF NEW.status = 'COMPLETED' THEN
        NEW.progress = 100;
    ELSIF OLD.status = 'COMPLETED' THEN
        NEW.progress = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill: COMPLETED tasks with nothing to derive progress from are 100. The user triggers are
-- switched off (as V14 does) so the rewrite does not also move updated_at.
ALTER TABLE tasks DISABLE TRIGGER USER;
UPDATE tasks t SET progress = 100
WHERE t.status = 'COMPLETED' AND t.progress <> 100
  AND NOT EXISTS (SELECT 1 FROM subtasks s WHERE s.task_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM checklist_items c WHERE c.task_id = t.id);
ALTER TABLE tasks ENABLE TRIGGER USER;
