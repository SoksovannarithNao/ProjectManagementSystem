-- Task & Project Management System - two-level roles (ADR-0015).
-- Applied on top of V9__requirement_roles_and_permissions.sql.
--
-- V9 gave the four requirement roles to BOTH levels (TEAM_LEADER and TEAM_MEMBER
-- were system roles *and* project roles). The approved specification
-- (assignment-brief.md Part B, docs/adr/0015-two-level-roles-system-and-project.md)
-- separates the levels:
--
--   system roles   (users.role_id)               ADMINISTRATOR, PROJECT_MANAGER, USER
--   project roles  (project_members.project_role) OWNER, ADMIN, MEMBER, VIEWER
--
-- Team Leader and Team Member become business labels for the project roles ADMIN
-- and MEMBER. This migration:
--   1. adds the roles USER, OWNER, ADMIN, MEMBER and removes TEAM_LEADER and
--      TEAM_MEMBER (their accounts become USER);
--   2. makes PROJECT_MANAGER a system-only role;
--   3. rewrites the permission matrix (Team Member can no longer create tasks or
--      delete subtasks; report access for Team Leader moves to the project role);
--   4. gives every project exactly one active OWNER and replaces the V8 trigger
--      with a deferred "exactly one owner" check (which also lets a project that
--      has a single owner be deleted).
--
-- Idempotent: the data and matrix changes run only while the old model is still
-- present (the TEAM_LEADER role exists), so a re-run, or a database built from
-- the new 01-init.sql, is left alone. Edited grants are never wiped.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'TEAM_LEADER') THEN
        RAISE NOTICE 'V10: two-level roles already in place, nothing to do';
        RETURN;
    END IF;

    -- ---- 1. system role USER; move the accounts off the retired roles ----
    INSERT INTO roles (name, description, scope, project_role, built_in)
    VALUES ('USER', 'A registered person with no global management rights; works through the role held in each project', 'SYSTEM', NULL, TRUE)
    ON CONFLICT (name) DO NOTHING;

    UPDATE users
    SET role_id = (SELECT id FROM roles WHERE name = 'USER')
    WHERE role_id IN (SELECT id FROM roles WHERE name IN ('TEAM_LEADER', 'TEAM_MEMBER'));

    -- ---- 2. free the project_role values, drop the retired roles ----
    DELETE FROM role_permissions
    WHERE role_id IN (SELECT id FROM roles WHERE name IN ('PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER'));

    DELETE FROM roles WHERE name IN ('TEAM_LEADER', 'TEAM_MEMBER');

    UPDATE roles
    SET scope = 'SYSTEM',
        project_role = NULL,
        description = 'Creates projects and generates reports across the projects they belong to; owns the projects they create'
    WHERE name = 'PROJECT_MANAGER';

    UPDATE roles
    SET description = 'Full access to users, roles, permissions, reports and every project'
    WHERE name = 'ADMINISTRATOR';

    -- ---- 3. the four project roles ----
    INSERT INTO roles (name, description, scope, project_role, built_in) VALUES
        ('OWNER',  'Project owner (the Project Manager of this project): full authority inside it',            'PROJECT', 'OWNER',  TRUE),
        ('ADMIN',  'Team Leader: plans, assigns and approves inside one project; cannot delete it',            'PROJECT', 'ADMIN',  TRUE),
        ('MEMBER', 'Team Member: works on assigned tasks, subtasks, comments and time',                        'PROJECT', 'MEMBER', TRUE)
    ON CONFLICT (name) DO UPDATE
        SET scope = EXCLUDED.scope, project_role = EXCLUDED.project_role, built_in = TRUE;

    UPDATE roles SET scope = 'PROJECT', project_role = 'VIEWER', built_in = TRUE WHERE name = 'VIEWER';

    -- ---- 4. exactly one active owner per project ----
    -- Keep the project's manager as owner (else the earliest membership); the
    -- others become ADMIN. Runs before the new check exists.
    UPDATE project_members pm
    SET project_role = 'ADMIN'
    WHERE pm.project_role = 'OWNER' AND pm.status = 'ACTIVE'
      AND pm.id <> (SELECT m.id
                    FROM project_members m JOIN projects p ON p.id = m.project_id
                    WHERE m.project_id = pm.project_id AND m.project_role = 'OWNER' AND m.status = 'ACTIVE'
                    ORDER BY (m.user_id = p.manager_id) DESC, m.id
                    LIMIT 1);

    -- Whoever owns a project must be able to own projects (D-04).
    UPDATE users u
    SET role_id = (SELECT id FROM roles WHERE name = 'PROJECT_MANAGER')
    WHERE EXISTS (SELECT 1 FROM project_members pm
                  WHERE pm.user_id = u.id AND pm.project_role = 'OWNER' AND pm.status = 'ACTIVE')
      AND u.role_id IN (SELECT id FROM roles WHERE name = 'USER');

    -- ---- 5. the permission matrix ----
    -- scope SYSTEM  = applies anywhere, independent of any project
    -- scope PROJECT = applies inside a project where the user is an ACTIVE member
    --                 with that project role
    -- ADMINISTRATOR holds every action on every resource and also bypasses
    -- project membership in code (ProjectAccessGuard.isAdmin).
    INSERT INTO role_permissions (role_id, permission_id, resource, scope)
    SELECT r.id, p.id, g.resource, g.scope
    FROM (VALUES
        -- Administrator: everything, system-wide
        ('ADMINISTRATOR', 'SYSTEM', 'PROJECT',     ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE','GENERATE_REPORTS']),
        ('ADMINISTRATOR', 'SYSTEM', 'MILESTONE',   ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE','GENERATE_REPORTS']),
        ('ADMINISTRATOR', 'SYSTEM', 'MEMBER',      ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE','GENERATE_REPORTS']),
        ('ADMINISTRATOR', 'SYSTEM', 'TASK',        ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE','GENERATE_REPORTS']),
        ('ADMINISTRATOR', 'SYSTEM', 'TASK_STATUS', ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE','GENERATE_REPORTS']),
        ('ADMINISTRATOR', 'SYSTEM', 'SUBTASK',     ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE','GENERATE_REPORTS']),
        ('ADMINISTRATOR', 'SYSTEM', 'COMMENT',     ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE','GENERATE_REPORTS']),
        ('ADMINISTRATOR', 'SYSTEM', 'WORK_LOG',    ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE','GENERATE_REPORTS']),
        ('ADMINISTRATOR', 'SYSTEM', 'REPORT',      ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE','GENERATE_REPORTS']),
        ('ADMINISTRATOR', 'SYSTEM', 'USER',        ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE','GENERATE_REPORTS']),
        ('ADMINISTRATOR', 'SYSTEM', 'ROLE',        ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE','GENERATE_REPORTS']),
        ('ADMINISTRATOR', 'SYSTEM', 'LOOKUP',      ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE','GENERATE_REPORTS']),

        -- System scope of Project Manager: create projects, cross-project reports.
        -- USER holds nothing at system scope.
        ('PROJECT_MANAGER', 'SYSTEM', 'PROJECT', ARRAY['CREATE']),
        ('PROJECT_MANAGER', 'SYSTEM', 'REPORT',  ARRAY['GENERATE_REPORTS']),

        -- Project scope: OWNER (the Project Manager of this project)
        ('OWNER', 'PROJECT', 'PROJECT',     ARRAY['VIEW','EDIT','DELETE','ASSIGN']),
        ('OWNER', 'PROJECT', 'MILESTONE',   ARRAY['VIEW','CREATE','EDIT','DELETE']),
        ('OWNER', 'PROJECT', 'MEMBER',      ARRAY['VIEW','CREATE','EDIT','DELETE']),
        ('OWNER', 'PROJECT', 'TASK',        ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE']),
        ('OWNER', 'PROJECT', 'TASK_STATUS', ARRAY['EDIT']),
        ('OWNER', 'PROJECT', 'SUBTASK',     ARRAY['VIEW','CREATE','EDIT','DELETE']),
        ('OWNER', 'PROJECT', 'COMMENT',     ARRAY['VIEW','CREATE','DELETE']),
        ('OWNER', 'PROJECT', 'WORK_LOG',    ARRAY['VIEW','CREATE','DELETE']),
        ('OWNER', 'PROJECT', 'REPORT',      ARRAY['GENERATE_REPORTS']),

        -- Project scope: ADMIN (Team Leader). May delete work items and remove
        -- members, never the project or the owner (D-01).
        ('ADMIN', 'PROJECT', 'PROJECT',     ARRAY['VIEW','EDIT']),
        ('ADMIN', 'PROJECT', 'MILESTONE',   ARRAY['VIEW','CREATE','EDIT','DELETE']),
        ('ADMIN', 'PROJECT', 'MEMBER',      ARRAY['VIEW','CREATE','EDIT','DELETE']),
        ('ADMIN', 'PROJECT', 'TASK',        ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE']),
        ('ADMIN', 'PROJECT', 'TASK_STATUS', ARRAY['EDIT']),
        ('ADMIN', 'PROJECT', 'SUBTASK',     ARRAY['VIEW','CREATE','EDIT','DELETE']),
        ('ADMIN', 'PROJECT', 'COMMENT',     ARRAY['VIEW','CREATE','DELETE']),
        ('ADMIN', 'PROJECT', 'WORK_LOG',    ARRAY['VIEW','CREATE','DELETE']),
        ('ADMIN', 'PROJECT', 'REPORT',      ARRAY['GENERATE_REPORTS']),

        -- Project scope: MEMBER (Team Member). Limited create/edit; no task
        -- creation, no deletes (authors may still delete their own content).
        ('MEMBER', 'PROJECT', 'PROJECT',     ARRAY['VIEW']),
        ('MEMBER', 'PROJECT', 'MILESTONE',   ARRAY['VIEW']),
        ('MEMBER', 'PROJECT', 'MEMBER',      ARRAY['VIEW']),
        ('MEMBER', 'PROJECT', 'TASK',        ARRAY['VIEW']),
        ('MEMBER', 'PROJECT', 'TASK_STATUS', ARRAY['EDIT']),
        ('MEMBER', 'PROJECT', 'SUBTASK',     ARRAY['VIEW','CREATE','EDIT']),
        ('MEMBER', 'PROJECT', 'COMMENT',     ARRAY['VIEW','CREATE']),
        ('MEMBER', 'PROJECT', 'WORK_LOG',    ARRAY['VIEW','CREATE']),

        -- Project scope: VIEWER - read only
        ('VIEWER', 'PROJECT', 'PROJECT',   ARRAY['VIEW']),
        ('VIEWER', 'PROJECT', 'MILESTONE', ARRAY['VIEW']),
        ('VIEWER', 'PROJECT', 'MEMBER',    ARRAY['VIEW']),
        ('VIEWER', 'PROJECT', 'TASK',      ARRAY['VIEW']),
        ('VIEWER', 'PROJECT', 'SUBTASK',   ARRAY['VIEW']),
        ('VIEWER', 'PROJECT', 'COMMENT',   ARRAY['VIEW']),
        ('VIEWER', 'PROJECT', 'WORK_LOG',  ARRAY['VIEW'])
    ) AS g(role_name, scope, resource, perms)
    JOIN roles r ON r.name = g.role_name
    CROSS JOIN LATERAL unnest(g.perms) AS u(perm_code)
    JOIN permissions p ON p.code = u.perm_code
    ON CONFLICT DO NOTHING;
END
$$;

-- ==================== exactly one active owner per project ====================
-- Replaces V8's trg_project_members_owner_integrity ("at least one owner").
-- DEFERRED to the end of the transaction so ownership can move in one step
-- (demote the old owner and promote the new one in the same transaction), and
-- skipped when the project itself is being deleted - which lets a project with
-- a single owner be deleted (the V8 trigger blocked that cascade).
-- Backed by ProjectOwnership / ProjectMemberService, which give friendly errors first.

DROP TRIGGER IF EXISTS trg_project_members_owner_integrity ON project_members;
DROP FUNCTION IF EXISTS check_project_has_active_owner();

CREATE OR REPLACE FUNCTION check_project_has_single_owner()
RETURNS TRIGGER AS $$
DECLARE
    v_project_id BIGINT;
    v_owners     INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.project_role <> 'OWNER' OR OLD.status <> 'ACTIVE' THEN RETURN NULL; END IF;
        v_project_id := OLD.project_id;
    ELSIF TG_OP = 'INSERT' THEN
        IF NEW.project_role <> 'OWNER' OR NEW.status <> 'ACTIVE' THEN RETURN NULL; END IF;
        v_project_id := NEW.project_id;
    ELSE
        IF NOT ((OLD.project_role = 'OWNER' AND OLD.status = 'ACTIVE')
                OR (NEW.project_role = 'OWNER' AND NEW.status = 'ACTIVE')) THEN
            RETURN NULL;
        END IF;
        v_project_id := NEW.project_id;
    END IF;

    -- The project is gone (it is being deleted): nothing to protect.
    IF NOT EXISTS (SELECT 1 FROM projects WHERE id = v_project_id) THEN
        RETURN NULL;
    END IF;

    SELECT COUNT(*) INTO v_owners
    FROM project_members
    WHERE project_id = v_project_id AND project_role = 'OWNER' AND status = 'ACTIVE';

    IF v_owners <> 1 THEN
        RAISE EXCEPTION 'Project % must have exactly one active owner (it would have %) - transfer ownership instead of adding or removing an owner',
            v_project_id, v_owners
            USING ERRCODE = '23514'; -- check_violation, cleaned for the client by GlobalExceptionHandler
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_members_single_owner ON project_members;
CREATE CONSTRAINT TRIGGER trg_project_members_single_owner
    AFTER INSERT OR UPDATE OR DELETE ON project_members
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_project_has_single_owner();
