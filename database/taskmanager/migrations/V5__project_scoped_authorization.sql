-- Task & Project Management System — project-scoped authorization.
-- Applied on top of V4__add_team_invitations_positions_departments_subtasks_comments.sql.
-- This is the versioned migration form of the same delta added to
-- database/init/01-init.sql for this change — see that file for the
-- authoritative, actually-executed SQL (Docker/CI run init/*.sql, not this
-- migrations folder — see database/README.md's Migrations section).
--
-- Problem: users.role_id (a GLOBAL role — ADMINISTRATOR/PROJECT_MANAGER/
-- TEAM_LEADER/TEAM_MEMBER) was being used to gate project/task creation and
-- editing. Every self-registered user was force-assigned TEAM_MEMBER, which
-- then failed those checks — a brand-new user could never create a project
-- or a task. Fix: authorization for project/task actions now comes entirely
-- from project_members.project_role (the table already existed and already
-- scoped read visibility — it just wasn't used for write authorization).
-- users.role_id is narrowed to a genuinely global, per-project-unrelated
-- concern: is this account a system ADMINISTRATOR (user/role management,
-- "sees everything" bypass)? Nothing else reads it anymore.

-- ==================== users.role_id becomes optional ==================== --
-- A normal user now has NO row here — their authority comes entirely from
-- which projects they belong to and their role there.
ALTER TABLE users ALTER COLUMN role_id DROP NOT NULL;

-- ==================== project_members.project_role vocabulary ==================== --
-- Was PROJECT_MANAGER/TEAM_LEADER/TEAM_MEMBER (mirroring the global roles,
-- confusingly) with default TEAM_MEMBER. Now OWNER/ADMIN/MEMBER/VIEWER —
-- OWNER is granted automatically to whoever creates a project.
ALTER TABLE project_members DROP CONSTRAINT project_members_project_role_check;
UPDATE project_members SET project_role = CASE project_role
    WHEN 'PROJECT_MANAGER' THEN 'OWNER'
    WHEN 'TEAM_LEADER' THEN 'ADMIN'
    WHEN 'TEAM_MEMBER' THEN 'MEMBER'
    ELSE project_role
END;
ALTER TABLE project_members ALTER COLUMN project_role SET DEFAULT 'MEMBER';
ALTER TABLE project_members ADD CONSTRAINT project_members_project_role_check
    CHECK (project_role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER'));

-- ==================== drop the obsolete global project-related roles ==================== --
-- Unreferenced once no backend code path checks for them (project/task
-- authorization moved to project_members.project_role above). Any existing
-- user holding one of these loses their global role entirely (NULL) — they
-- keep whatever project_members rows/roles they already had, which is the
-- only thing that ever should have controlled their project/task access.
UPDATE users SET role_id = NULL
WHERE role_id IN (SELECT id FROM roles WHERE name IN ('PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER'));

DELETE FROM roles WHERE name IN ('PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER');
-- (role_permissions rows for those roles cascade-delete automatically —
-- role_permissions.role_id is ON DELETE CASCADE.)
