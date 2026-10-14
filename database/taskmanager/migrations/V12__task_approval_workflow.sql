-- Task & Project Management System - task approval workflow (change-plan batch 2).
-- Applied on top of V11__rename_status_to_do_to_todo.sql.
--
-- The approved specification (assignment-brief.md B3.8, decision D-05) makes
-- approval a separate decision on a task: IN_REVIEW is only a status. This migration
--   1. adds tasks.approver_id - the optional approver named for one task,
--   2. adds task_approvals - one row per review request and its decision,
--   3. allows the new activity actions and notification types,
--   4. gives every task that is already IN_REVIEW an open (PENDING) request, so the
--      approvers have something to decide,
--   5. lets the application role use the new table.
--
-- Idempotent: every step checks whether it is already done.

-- ---- 1. the optional designated approver ----
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approver_id BIGINT REFERENCES users (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_approver_id ON tasks (approver_id);

-- ---- 2. the approval records ----
CREATE TABLE IF NOT EXISTS task_approvals (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id      BIGINT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    requested_by BIGINT REFERENCES users (id) ON DELETE SET NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_by   BIGINT REFERENCES users (id) ON DELETE SET NULL,
    decided_at   TIMESTAMPTZ,
    decision     VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                 CHECK (decision IN ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'WITHDRAWN')),
    comment      VARCHAR(1000),
    CONSTRAINT task_approvals_decided_check
        CHECK ((decision = 'PENDING' AND decided_at IS NULL) OR (decision <> 'PENDING' AND decided_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_task_approvals_task_id ON task_approvals (task_id);
CREATE INDEX IF NOT EXISTS idx_task_approvals_decision ON task_approvals (decision);
-- A task has at most one open request at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_approvals_one_pending ON task_approvals (task_id) WHERE decision = 'PENDING';

-- ---- 3. new activity actions and notification types ----
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conrelid::regclass AS tbl, conname
        FROM pg_constraint
        WHERE contype = 'c'
          AND ((conrelid = 'activity_logs'::regclass AND strpos(pg_get_constraintdef(oid), 'PROJECT_CREATED') > 0)
            OR (conrelid = 'notifications'::regclass AND strpos(pg_get_constraintdef(oid), 'TASK_ASSIGNED') > 0))
          AND strpos(pg_get_constraintdef(oid), 'APPROVAL') = 0
          AND strpos(pg_get_constraintdef(oid), 'TASK_APPROVED') = 0
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'activity_logs'::regclass AND conname = 'activity_logs_action_check') THEN
        ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_action_check
            CHECK (action IN ('PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_COMPLETED',
                              'TASK_CREATED', 'TASK_DELETED', 'TASK_ASSIGNED', 'TASK_UNASSIGNED',
                              'TASK_STATUS_CHANGED', 'TASK_PRIORITY_CHANGED', 'TASK_DUE_DATE_CHANGED',
                              'TASK_COMPLETED', 'SUBTASK_ADDED', 'SUBTASK_COMPLETED', 'SUBTASK_DELETED',
                              'COMMENT_ADDED', 'FILE_UPLOADED',
                              'MILESTONE_CREATED', 'MILESTONE_COMPLETED',
                              'TASK_APPROVAL_REQUESTED', 'TASK_APPROVED', 'TASK_CHANGES_REQUESTED',
                              'TASK_REJECTED', 'TASK_APPROVER_SET'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'notifications'::regclass AND conname = 'notifications_type_check') THEN
        ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
            CHECK (type IN ('TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'COMMENT_ADDED',
                            'PROJECT_UPDATED', 'DEADLINE_REMINDER', 'OVERDUE_TASK',
                            'MILESTONE_UPDATED', 'TEAM_INVITATION', 'TEAM_INVITATION_RESPONDED',
                            'APPROVAL_REQUESTED', 'APPROVAL_DECIDED'));
    END IF;
END $$;

-- ---- 4. open requests for tasks that are already waiting in review ----
-- Requested by the task's first assignee (else its creator), at the time it last changed.
INSERT INTO task_approvals (task_id, requested_by, requested_at)
SELECT t.id,
       COALESCE((SELECT ta.user_id FROM task_assignees ta WHERE ta.task_id = t.id ORDER BY ta.id LIMIT 1), t.created_by),
       t.updated_at
FROM tasks t
WHERE t.status = 'IN_REVIEW'
  AND NOT EXISTS (SELECT 1 FROM task_approvals a WHERE a.task_id = t.id AND a.decision = 'PENDING');

-- ---- 5. the application role ----
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taskmanager_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON task_approvals TO taskmanager_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO taskmanager_app;
    END IF;
END $$;
