-- Task & Project Management System — requirement roles and a data-driven permission matrix.
-- Applied on top of V8__enforce_project_owner_integrity.sql.
-- docs/adr/0014-requirement-roles-and-permission-matrix.md explains the decision.
--
-- What this does
--   1. roles gains scope / project_role / built_in, and the four roles named in
--      Role_Requirment.md become real rows: ADMINISTRATOR, PROJECT_MANAGER,
--      TEAM_LEADER, TEAM_MEMBER (plus VIEWER, a project-only role the app relies on).
--   2. role_permissions gains resource + scope, so a grant is "this role may do
--      this ACTION on this RESOURCE, at system scope or inside a project".
--      The backend now reads it (PermissionService); it is no longer decorative.
--   3. The full role x resource x action matrix is inserted.
--   4. Existing accounts are backfilled to a system role and the old USER role is dropped.
--
-- Project roles on project_members (OWNER / ADMIN / MEMBER / VIEWER) are NOT renamed.
-- roles.project_role maps each of them to a role row:
--     OWNER -> PROJECT_MANAGER, ADMIN -> TEAM_LEADER, MEMBER -> TEAM_MEMBER, VIEWER -> VIEWER.
--
-- Idempotent on purpose. A database created from the updated init/01-init.sql
-- already has this end state, and the Flyway service in docker-compose still
-- runs this file against it (baseline 8). Every step therefore checks first,
-- and nothing here overwrites grants an administrator has since edited.

-- ==================== 1. roles ====================

ALTER TABLE roles ADD COLUMN IF NOT EXISTS scope        VARCHAR(10) NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE roles ADD COLUMN IF NOT EXISTS project_role VARCHAR(20);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS built_in     BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_scope_check') THEN
        ALTER TABLE roles ADD CONSTRAINT roles_scope_check
            CHECK (scope IN ('SYSTEM', 'PROJECT', 'BOTH'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_project_role_check') THEN
        ALTER TABLE roles ADD CONSTRAINT roles_project_role_check
            CHECK (project_role IS NULL OR project_role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER'));
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_project_role ON roles (project_role) WHERE project_role IS NOT NULL;

INSERT INTO roles (name, description, scope, project_role, built_in) VALUES
    ('ADMINISTRATOR',   'Full access to users, roles, permissions, reports and every project',                   'SYSTEM',  NULL,     TRUE),
    ('PROJECT_MANAGER', 'Creates and runs projects: team, milestones, tasks, assignment, approval, reports',     'BOTH',    'OWNER',  TRUE),
    ('TEAM_LEADER',     'Plans and assigns work inside a project, approves task completion, views reports',     'BOTH',    'ADMIN',  TRUE),
    ('TEAM_MEMBER',     'Works on assigned tasks, updates status, adds subtasks, comments and time',           'BOTH',    'MEMBER', TRUE),
    ('VIEWER',          'Read-only access inside a project (project role only, not a system role)',             'PROJECT', 'VIEWER', TRUE)
ON CONFLICT (name) DO UPDATE
    SET scope = EXCLUDED.scope,
        project_role = EXCLUDED.project_role,
        built_in = TRUE;

-- ==================== 2. role_permissions ====================
-- Added columns need a value for existing rows, and the old rows (every
-- permission for ADMINISTRATOR) carry no resource, so they are replaced by the
-- matrix below. Guarded so a re-run never wipes edited grants.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'role_permissions' AND column_name = 'resource') THEN
        DELETE FROM role_permissions;
        ALTER TABLE role_permissions ADD COLUMN resource VARCHAR(30) NOT NULL;
        ALTER TABLE role_permissions ADD COLUMN scope    VARCHAR(10) NOT NULL;
        ALTER TABLE role_permissions DROP CONSTRAINT role_permissions_pkey;
        ALTER TABLE role_permissions ADD PRIMARY KEY (role_id, permission_id, resource, scope);
        ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_scope_check
            CHECK (scope IN ('SYSTEM', 'PROJECT'));
        ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_resource_check
            CHECK (resource IN ('PROJECT', 'MILESTONE', 'MEMBER', 'TASK', 'TASK_STATUS', 'SUBTASK',
                                'COMMENT', 'WORK_LOG', 'REPORT', 'USER', 'ROLE', 'LOOKUP'));
    END IF;
END
$$;

-- ==================== 3. the matrix ====================
-- scope SYSTEM  = applies everywhere, independent of any project
-- scope PROJECT = applies inside a project where the user is an ACTIVE member
--                 with the role's project_role (OWNER/ADMIN/MEMBER/VIEWER)
-- ADMINISTRATOR holds every action on every resource at SYSTEM scope and also
-- bypasses project membership in code (ProjectAccessGuard.isAdmin).

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

    -- System scope for the other roles: only the things that are not tied to one project
    ('PROJECT_MANAGER', 'SYSTEM', 'PROJECT', ARRAY['CREATE']),
    ('PROJECT_MANAGER', 'SYSTEM', 'REPORT',  ARRAY['GENERATE_REPORTS']),
    ('TEAM_LEADER',     'SYSTEM', 'REPORT',  ARRAY['GENERATE_REPORTS']),

    -- Project scope: Project Manager (project role OWNER)
    ('PROJECT_MANAGER', 'PROJECT', 'PROJECT',     ARRAY['VIEW','EDIT','DELETE','ASSIGN']),
    ('PROJECT_MANAGER', 'PROJECT', 'MILESTONE',   ARRAY['VIEW','CREATE','EDIT','DELETE']),
    ('PROJECT_MANAGER', 'PROJECT', 'MEMBER',      ARRAY['VIEW','CREATE','EDIT','DELETE']),
    ('PROJECT_MANAGER', 'PROJECT', 'TASK',        ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE']),
    ('PROJECT_MANAGER', 'PROJECT', 'TASK_STATUS', ARRAY['EDIT']),
    ('PROJECT_MANAGER', 'PROJECT', 'SUBTASK',     ARRAY['VIEW','CREATE','EDIT','DELETE']),
    ('PROJECT_MANAGER', 'PROJECT', 'COMMENT',     ARRAY['VIEW','CREATE','DELETE']),
    ('PROJECT_MANAGER', 'PROJECT', 'WORK_LOG',    ARRAY['VIEW','CREATE','DELETE']),

    -- Project scope: Team Leader (project role ADMIN)
    ('TEAM_LEADER', 'PROJECT', 'PROJECT',     ARRAY['VIEW','EDIT']),
    ('TEAM_LEADER', 'PROJECT', 'MILESTONE',   ARRAY['VIEW','CREATE','EDIT','DELETE']),
    ('TEAM_LEADER', 'PROJECT', 'MEMBER',      ARRAY['VIEW','CREATE','EDIT','DELETE']),
    ('TEAM_LEADER', 'PROJECT', 'TASK',        ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','APPROVE']),
    ('TEAM_LEADER', 'PROJECT', 'TASK_STATUS', ARRAY['EDIT']),
    ('TEAM_LEADER', 'PROJECT', 'SUBTASK',     ARRAY['VIEW','CREATE','EDIT','DELETE']),
    ('TEAM_LEADER', 'PROJECT', 'COMMENT',     ARRAY['VIEW','CREATE','DELETE']),
    ('TEAM_LEADER', 'PROJECT', 'WORK_LOG',    ARRAY['VIEW','CREATE','DELETE']),

    -- Project scope: Team Member (project role MEMBER)
    ('TEAM_MEMBER', 'PROJECT', 'PROJECT',     ARRAY['VIEW']),
    ('TEAM_MEMBER', 'PROJECT', 'MILESTONE',   ARRAY['VIEW']),
    ('TEAM_MEMBER', 'PROJECT', 'MEMBER',      ARRAY['VIEW']),
    ('TEAM_MEMBER', 'PROJECT', 'TASK',        ARRAY['VIEW','CREATE']),
    ('TEAM_MEMBER', 'PROJECT', 'TASK_STATUS', ARRAY['EDIT']),
    ('TEAM_MEMBER', 'PROJECT', 'SUBTASK',     ARRAY['VIEW','CREATE','EDIT','DELETE']),
    ('TEAM_MEMBER', 'PROJECT', 'COMMENT',     ARRAY['VIEW','CREATE']),
    ('TEAM_MEMBER', 'PROJECT', 'WORK_LOG',    ARRAY['VIEW','CREATE']),

    -- Project scope: Viewer (project role VIEWER) - read only
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

-- ==================== 4. accounts ====================
-- Every account gets a system role. Highest project responsibility wins:
-- an ACTIVE OWNER somewhere -> PROJECT_MANAGER, else an ACTIVE ADMIN ->
-- TEAM_LEADER, else TEAM_MEMBER. Only accounts with no role (NULL) or the old
-- USER label are touched; ADMINISTRATOR and any role an administrator has
-- already chosen are left alone.

UPDATE users u
SET role_id = (SELECT id FROM roles WHERE name = 'PROJECT_MANAGER')
WHERE (u.role_id IS NULL OR u.role_id IN (SELECT id FROM roles WHERE name = 'USER'))
  AND EXISTS (SELECT 1 FROM project_members pm
              WHERE pm.user_id = u.id AND pm.status = 'ACTIVE' AND pm.project_role = 'OWNER');

UPDATE users u
SET role_id = (SELECT id FROM roles WHERE name = 'TEAM_LEADER')
WHERE (u.role_id IS NULL OR u.role_id IN (SELECT id FROM roles WHERE name = 'USER'))
  AND EXISTS (SELECT 1 FROM project_members pm
              WHERE pm.user_id = u.id AND pm.status = 'ACTIVE' AND pm.project_role = 'ADMIN');

UPDATE users u
SET role_id = (SELECT id FROM roles WHERE name = 'TEAM_MEMBER')
WHERE u.role_id IS NULL OR u.role_id IN (SELECT id FROM roles WHERE name = 'USER');

DELETE FROM roles r
WHERE r.name = 'USER'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.role_id = r.id);

-- ==================== 5. privileges for the application role ====================
-- The backend reads the catalog and edits grants. Skipped when the role does
-- not exist (a developer database without 03-app-role.sh).

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taskmanager_app') THEN
        GRANT SELECT ON permissions TO taskmanager_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON role_permissions TO taskmanager_app;
    END IF;
END
$$;
