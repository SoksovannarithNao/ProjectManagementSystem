-- Task & Project Management System - file attachments and checklists (change-plan batch 3a).
-- Applied on top of V12__task_approval_workflow.sql.
--
-- Part A requires file attachments and checklists (assignment-brief.md B1.6, D-07, D-17).
-- Both tables already existed but nothing used them. This migration
--   1. adds the permission resources ATTACHMENT and CHECKLIST_ITEM and their grants,
--   2. stores the bytes of an attachment in the database (attachment_contents),
--      like profile photos, so they travel with a pg_dump,
--   3. records who created a checklist item (an author may delete their own),
--   4. makes a task's progress count checklist items together with subtasks (D-07),
--   5. lets the application role use the tables.
--
-- Idempotent: every step checks whether it is already done.

-- ---- 1. permission resources and their grants ----
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'role_permissions'::regclass AND contype = 'c'
          AND strpos(pg_get_constraintdef(oid), 'WORK_LOG') > 0
          AND strpos(pg_get_constraintdef(oid), 'ATTACHMENT') = 0
    LOOP
        EXECUTE format('ALTER TABLE role_permissions DROP CONSTRAINT %I', c.conname);
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'role_permissions'::regclass
                   AND conname = 'role_permissions_resource_check') THEN
        ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_resource_check
            CHECK (resource IN ('PROJECT', 'MILESTONE', 'MEMBER', 'TASK', 'TASK_STATUS', 'SUBTASK',
                                'COMMENT', 'WORK_LOG', 'ATTACHMENT', 'CHECKLIST_ITEM',
                                'REPORT', 'USER', 'ROLE', 'LOOKUP'));
    END IF;
END $$;

-- Same shape as the matrix in V10. ATTACHMENT follows COMMENT (everyone who works in the
-- project uploads; the Owner and Team Leader delete; the uploader deletes their own);
-- CHECKLIST_ITEM follows SUBTASK (a Team Member edits the checklist of tasks assigned to them).
INSERT INTO role_permissions (role_id, permission_id, resource, scope)
SELECT r.id, p.id, g.resource, g.scope
FROM (VALUES
    ('ADMINISTRATOR', 'SYSTEM', 'ATTACHMENT',     ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE','GENERATE_REPORTS']),
    ('ADMINISTRATOR', 'SYSTEM', 'CHECKLIST_ITEM', ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE','GENERATE_REPORTS']),

    ('OWNER',  'PROJECT', 'ATTACHMENT',     ARRAY['VIEW','CREATE','DELETE']),
    ('OWNER',  'PROJECT', 'CHECKLIST_ITEM', ARRAY['VIEW','CREATE','EDIT','DELETE']),
    ('ADMIN',  'PROJECT', 'ATTACHMENT',     ARRAY['VIEW','CREATE','DELETE']),
    ('ADMIN',  'PROJECT', 'CHECKLIST_ITEM', ARRAY['VIEW','CREATE','EDIT','DELETE']),
    ('MEMBER', 'PROJECT', 'ATTACHMENT',     ARRAY['VIEW','CREATE']),
    ('MEMBER', 'PROJECT', 'CHECKLIST_ITEM', ARRAY['VIEW','CREATE','EDIT']),
    ('VIEWER', 'PROJECT', 'ATTACHMENT',     ARRAY['VIEW']),
    ('VIEWER', 'PROJECT', 'CHECKLIST_ITEM', ARRAY['VIEW'])
) AS g(role_name, scope, resource, perms)
JOIN roles r ON r.name = g.role_name
CROSS JOIN LATERAL unnest(g.perms) AS u(perm_code)
JOIN permissions p ON p.code = u.perm_code
ON CONFLICT DO NOTHING;

-- ---- 2. attachment bytes ----
-- file_url was meant for an external location; the bytes now live in attachment_contents.
ALTER TABLE attachments ALTER COLUMN file_url DROP NOT NULL;

CREATE TABLE IF NOT EXISTS attachment_contents (
    attachment_id BIGINT PRIMARY KEY REFERENCES attachments (id) ON DELETE CASCADE,
    data          BYTEA NOT NULL
);

-- ---- 3. who created a checklist item ----
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_checklist_items_created_by ON checklist_items (created_by);

-- ---- 4. progress counts subtasks and checklist items together (D-07) ----
-- progress = (completed subtasks + completed checklist items) / (all subtasks + all items).
-- A COMPLETED task whose subtasks are all done is 100 even if some checklist items are
-- still open (B1.5: "a COMPLETED task is 100"; only subtasks gate completion).
-- p_status is passed by the BEFORE UPDATE trigger, which must see the NEW status.
DROP FUNCTION IF EXISTS fn_compute_task_progress_from_subtasks(BIGINT);

CREATE OR REPLACE FUNCTION fn_compute_task_progress_from_subtasks(p_task_id BIGINT, p_status VARCHAR DEFAULT NULL)
RETURNS NUMERIC AS $$
DECLARE
    v_total      INTEGER;
    v_completed  INTEGER;
    v_items      INTEGER;
    v_items_done INTEGER;
    v_status     VARCHAR(20);
BEGIN
    SELECT count(*), count(*) FILTER (WHERE status = 'COMPLETED')
    INTO v_total, v_completed
    FROM subtasks WHERE task_id = p_task_id;

    SELECT count(*), count(*) FILTER (WHERE is_completed)
    INTO v_items, v_items_done
    FROM checklist_items WHERE task_id = p_task_id;

    IF v_total + v_items = 0 THEN
        RETURN NULL; -- nothing to derive from: progress stays as it is
    END IF;

    v_status := COALESCE(p_status, (SELECT status FROM tasks WHERE id = p_task_id));
    IF v_status = 'COMPLETED' AND v_completed = v_total THEN
        RETURN 100;
    END IF;
    RETURN round(100.0 * (v_completed + v_items_done) / (v_total + v_items), 2);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION trg_fn_tasks_progress_derived_from_subtasks()
RETURNS TRIGGER AS $$
DECLARE
    v_progress NUMERIC;
BEGIN
    v_progress := fn_compute_task_progress_from_subtasks(NEW.id, NEW.status);
    IF v_progress IS NOT NULL THEN
        NEW.progress = v_progress;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The same AFTER trigger function that follows subtasks (it reads task_id from the row).
DROP TRIGGER IF EXISTS trg_checklist_items_sync_parent_task ON checklist_items;
CREATE TRIGGER trg_checklist_items_sync_parent_task
    AFTER INSERT OR UPDATE OR DELETE ON checklist_items
    FOR EACH ROW EXECUTE FUNCTION trg_fn_subtasks_sync_parent_task();

-- ---- 5. the application role ----
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taskmanager_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON attachments, attachment_contents, checklist_items TO taskmanager_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO taskmanager_app;
    END IF;
END $$;
