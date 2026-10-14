-- Task & Project Management System - the MENTION notification type.
-- Applied on top of V17__task_status_integrity.sql.
--
-- A person @mentioned in a comment is told so with their own notification (change-plan G-14,
-- decision D-21) instead of the generic "new comment" one, so the type list gains MENTION.
--
-- Idempotent: the constraint is replaced only while it does not already allow MENTION.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint
               WHERE conrelid = 'notifications'::regclass AND conname = 'notifications_type_check'
                 AND strpos(pg_get_constraintdef(oid), 'MENTION') = 0) THEN
        ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'notifications'::regclass AND conname = 'notifications_type_check') THEN
        ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
            CHECK (type IN ('TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'COMMENT_ADDED',
                            'PROJECT_UPDATED', 'DEADLINE_REMINDER', 'OVERDUE_TASK',
                            'MILESTONE_UPDATED', 'TEAM_INVITATION', 'TEAM_INVITATION_RESPONDED',
                            'APPROVAL_REQUESTED', 'APPROVAL_DECIDED', 'MENTION'));
    END IF;
END $$;
