-- Task & Project Management System — invariant verification
--
-- Standalone sanity-check script: every query below is expected to return
-- ZERO ROWS on a healthy database. Re-run this after any schema or seed
-- change (`psql -f database/verify_invariants.sql`) — a non-empty result
-- means one of the business rules documented in database/README.md is
-- being violated by the current data.

-- 1. Tasks missing required dates (Role_Requirment.md: every task needs a
--    Start Date and Due Date). Should be structurally impossible once
--    tasks.start_date/due_date are NOT NULL, but this remains a useful
--    check against a database that predates that constraint.
SELECT id, title
FROM tasks
WHERE start_date IS NULL OR due_date IS NULL;

-- 2. Active/completed tasks with an incomplete dependency — the invariant
--    both trg_tasks_dependencies_status_gate (on tasks) and
--    trg_task_dependencies_status_gate (on task_dependencies) exist to
--    prevent.
SELECT t.id, t.title, t.status,
       dep.id AS blocking_task_id, dep.status AS blocking_status
FROM tasks t
JOIN task_dependencies td ON td.task_id = t.id
JOIN tasks dep ON dep.id = td.depends_on_task_id
WHERE t.status IN ('IN_PROGRESS', 'IN_REVIEW', 'COMPLETED')
  AND dep.status <> 'COMPLETED';

-- 3. Task assignees who aren't members of the task's project (should be
--    prevented by trg_task_assignees_project_member).
SELECT ta.task_id, ta.user_id
FROM task_assignees ta
JOIN tasks t ON t.id = ta.task_id
WHERE NOT EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = t.project_id AND pm.user_id = ta.user_id
);

-- 4. Task assignees whose account isn't ACTIVE (should be prevented by
--    trg_task_assignees_not_suspended).
SELECT ta.task_id, u.id AS user_id, u.username, u.account_status
FROM task_assignees ta
JOIN users u ON u.id = ta.user_id
WHERE u.account_status <> 'ACTIVE';

-- 5. Tasks linked to a milestone that belongs to a different project
--    (should be prevented by trg_tasks_milestone_project_match).
SELECT t.id, t.project_id, m.id AS milestone_id, m.project_id AS milestone_project_id
FROM tasks t
JOIN milestones m ON m.id = t.milestone_id
WHERE t.milestone_id IS NOT NULL
  AND m.project_id <> t.project_id;

-- 6. Stale project progress — stored value disagrees with what's actually
--    computable from current task completion (should be prevented by
--    trg_tasks_progress_sync / trg_projects_progress_derived).
SELECT id, progress, fn_compute_project_progress(id) AS computed
FROM projects
WHERE progress IS DISTINCT FROM fn_compute_project_progress(id);

-- 7. Stale milestone progress — same check for milestones (should be
--    prevented by trg_tasks_progress_sync / trg_milestones_progress_derived).
SELECT id, progress, fn_compute_milestone_progress(id) AS computed
FROM milestones
WHERE progress IS DISTINCT FROM fn_compute_milestone_progress(id);
