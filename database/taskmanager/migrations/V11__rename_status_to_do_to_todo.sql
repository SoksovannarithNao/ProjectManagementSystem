-- Task & Project Management System - rename the stored task status TO_DO to TODO.
-- Applied on top of V10__two_level_roles.sql.
--
-- The approved specification (assignment-brief.md Part B, B1.2 and decision D-15)
-- names the first task status TODO; the label shown to people stays "To Do". This
-- migration changes only the stored value, in tasks.status and subtasks.status:
--   1. drops the two CHECK constraints that still list TO_DO,
--   2. makes TODO the column default,
--   3. rewrites existing rows,
--   4. adds the CHECK constraints back with TODO,
--   5. re-creates v_team_workload, whose "active" count names the status.
-- No other function, trigger or view refers to the old value.
--
-- Idempotent: constraints are found by their definition, so a re-run (or a database
-- built from the new 01-init.sql) finds nothing to drop and nothing to rewrite.

-- ---- 1. drop the constraints that list TO_DO ----
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conrelid::regclass AS tbl, conname
        FROM pg_constraint
        WHERE contype = 'c'
          AND conrelid IN ('tasks'::regclass, 'subtasks'::regclass)
          AND strpos(pg_get_constraintdef(oid), 'TO_DO') > 0
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
    END LOOP;
END $$;

-- ---- 2. new column defaults ----
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'TODO';
ALTER TABLE subtasks ALTER COLUMN status SET DEFAULT 'TODO';

-- ---- 3. rewrite the existing rows ----
-- The user triggers on these two tables are switched off for the rewrite (the
-- value is renamed, not changed): otherwise every renamed row would also get a new
-- updated_at and re-run the progress calculation.
ALTER TABLE tasks DISABLE TRIGGER USER;
ALTER TABLE subtasks DISABLE TRIGGER USER;
UPDATE tasks SET status = 'TODO' WHERE status = 'TO_DO';
UPDATE subtasks SET status = 'TODO' WHERE status = 'TO_DO';
ALTER TABLE tasks ENABLE TRIGGER USER;
ALTER TABLE subtasks ENABLE TRIGGER USER;

-- ---- 4. constraints with the new value ----
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'tasks'::regclass AND conname = 'tasks_status_check') THEN
        ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
            CHECK (status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'subtasks'::regclass AND conname = 'subtasks_status_check') THEN
        ALTER TABLE subtasks ADD CONSTRAINT subtasks_status_check
            CHECK (status IN ('TODO', 'IN_PROGRESS', 'COMPLETED'));
    END IF;
END $$;

-- ---- 5. v_team_workload (same columns as before) ----
CREATE OR REPLACE VIEW v_team_workload AS
SELECT u.id AS user_id,
       u.full_name,
       coalesce(ta_stats.assigned_tasks, 0) AS assigned_tasks,
       coalesce(ta_stats.active_tasks, 0) AS active_tasks,
       coalesce(ta_stats.overdue_tasks, 0) AS overdue_tasks,
       coalesce(ta_stats.estimated_hours, 0) AS estimated_hours,
       coalesce(wl_stats.actual_hours, 0) AS actual_hours
FROM users u
LEFT JOIN (
    SELECT ta.user_id,
           count(*) AS assigned_tasks,
           count(*) FILTER (WHERE t.status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW')) AS active_tasks,
           count(*) FILTER (
               WHERE t.due_date < CURRENT_DATE AND t.status NOT IN ('COMPLETED', 'CANCELLED')
           ) AS overdue_tasks,
           sum(t.estimated_hours) AS estimated_hours
    FROM task_assignees ta
    JOIN tasks t ON t.id = ta.task_id
    GROUP BY ta.user_id
) ta_stats ON ta_stats.user_id = u.id
LEFT JOIN (
    SELECT user_id, sum(hours_worked) AS actual_hours
    FROM work_logs
    GROUP BY user_id
) wl_stats ON wl_stats.user_id = u.id;
