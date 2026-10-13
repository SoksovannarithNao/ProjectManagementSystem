-- Task & Project Management System - time-log events in the activity feed.
-- Applied on top of V18__mention_notification.sql.
--
-- Logging, changing and deleting a time entry is now written to the activity feed (checklist
-- items #9 and #15), so the action list gains WORK_LOGGED, WORK_LOG_UPDATED and WORK_LOG_DELETED.
--
-- Idempotent: the constraint is replaced only while it does not already allow WORK_LOGGED.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint
               WHERE conrelid = 'activity_logs'::regclass AND conname = 'activity_logs_action_check'
                 AND strpos(pg_get_constraintdef(oid), 'WORK_LOGGED') = 0) THEN
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
                              'TASK_REJECTED', 'TASK_APPROVER_SET',
                              'WORK_LOGGED', 'WORK_LOG_UPDATED', 'WORK_LOG_DELETED'));
    END IF;
END $$;
