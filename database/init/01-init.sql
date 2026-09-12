-- Task & Project Management System — initial schema
-- Runs automatically when the Postgres container starts with an empty data
-- directory (mounted into /docker-entrypoint-initdb.d by docker-compose.yml).
--
-- Scope: the core tables for the main workflow — Register/Login -> Create
-- Project -> Add Team Members -> Create Milestones -> Create Tasks -> Assign
-- Tasks -> Track Progress — plus subtasks/checklists, comments, attachments,
-- work logs, notifications, and activity logs.

-- ==================== updated_at helper ==================== --

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==================== roles ==================== --

CREATE TABLE roles (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO roles (name, description) VALUES
    ('ADMINISTRATOR', 'Full access to users, roles, projects, and reports'),
    ('PROJECT_MANAGER', 'Creates and manages projects, teams, and milestones'),
    ('TEAM_LEADER', 'Manages tasks and team members within a project'),
    ('TEAM_MEMBER', 'Works on tasks assigned to them');

-- ==================== permissions / role_permissions ==================== --
-- Granular authorization on top of the 4 fixed roles. Role_Requirment.md's
-- "Available actions" list (View, Create, Edit, Delete, Assign, Approve,
-- Generate Reports) becomes a flat permission catalog; role_permissions is
-- the default matrix. Deliberately role-level only — no per-user override
-- table — since nothing in the app needs finer granularity yet (see the
-- README's Authorization section for the reasoning and the ADMIN/PM caveat).

CREATE TABLE permissions (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code        VARCHAR(30) NOT NULL UNIQUE,
    description VARCHAR(255)
);

INSERT INTO permissions (code, description) VALUES
    ('VIEW',             'View projects, tasks, and other records'),
    ('CREATE',           'Create new projects, tasks, and other records'),
    ('EDIT',             'Edit existing projects, tasks, and other records'),
    ('DELETE',           'Delete projects, tasks, and other records'),
    ('ASSIGN',           'Assign tasks or team members'),
    ('APPROVE',          'Approve task/milestone completion or other workflow steps'),
    ('GENERATE_REPORTS', 'Generate and view reports/KPIs');

CREATE TABLE role_permissions (
    role_id       BIGINT NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_permission_id ON role_permissions (permission_id);

-- Default matrix. ADMINISTRATOR and PROJECT_MANAGER share the same action
-- set at this flat, action-only granularity — Role_Requirment.md gives PMs
-- full lifecycle ownership (create/edit/delete/assign/approve/report) of
-- their own projects, and distinguishing "their projects" from "every
-- project" would need a resource-scoped permission model, not just more
-- action codes. That's flagged as a future enhancement in the README,
-- alongside the ownership-scoping gap already noted in backend/README.md.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('ADMINISTRATOR', 'PROJECT_MANAGER');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'TEAM_LEADER' AND p.code IN ('VIEW', 'CREATE', 'EDIT', 'ASSIGN', 'GENERATE_REPORTS');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'TEAM_MEMBER' AND p.code IN ('VIEW', 'EDIT');

-- ==================== users ==================== --

CREATE TABLE users (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name        VARCHAR(150) NOT NULL,
    username         VARCHAR(50) NOT NULL,
    email            VARCHAR(255) NOT NULL,
    password_hash    VARCHAR(255) NOT NULL,
    gender           VARCHAR(20),
    date_of_birth    DATE,
    phone_number     VARCHAR(30),
    profile_photo_url VARCHAR(500),
    position         VARCHAR(100),
    department       VARCHAR(100),
    role_id          BIGINT NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
    account_status   VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                     CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness: login accepts "Username or Email", so
-- 'Nikky' and 'nikky' (or 'Nikky@x.com' / 'nikky@x.com') must not collide.
-- This subsumes plain uniqueness, so there's no separate non-lower index.
CREATE UNIQUE INDEX idx_users_username_lower ON users (LOWER(username));
CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));
CREATE INDEX idx_users_role_id ON users (role_id);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==================== projects ==================== --

CREATE TABLE projects (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_code VARCHAR(30) NOT NULL UNIQUE,
    name         VARCHAR(200) NOT NULL,
    description  TEXT,
    start_date   DATE NOT NULL,
    end_date     DATE NOT NULL,
    manager_id   BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    priority     VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
                 CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status       VARCHAR(20) NOT NULL DEFAULT 'PLANNING'
                 CHECK (status IN ('PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
    progress     NUMERIC(5, 2) NOT NULL DEFAULT 0
                 CHECK (progress BETWEEN 0 AND 100),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);

CREATE INDEX idx_projects_manager_id ON projects (manager_id);
CREATE INDEX idx_projects_status ON projects (status);

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==================== project_members ==================== --

CREATE TABLE project_members (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id   BIGINT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_role VARCHAR(20) NOT NULL DEFAULT 'TEAM_MEMBER'
                 CHECK (project_role IN ('PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER')),
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_members_project_id ON project_members (project_id);
CREATE INDEX idx_project_members_user_id ON project_members (user_id);

-- ==================== milestones ==================== --

CREATE TABLE milestones (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id  BIGINT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    due_date    DATE NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
    progress    NUMERIC(5, 2) NOT NULL DEFAULT 0
                CHECK (progress BETWEEN 0 AND 100),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_milestones_project_id ON milestones (project_id);

CREATE TRIGGER trg_milestones_updated_at
    BEFORE UPDATE ON milestones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A milestone represents a phase *within* its project's timeline, so its
-- due date shouldn't fall outside the project's own start/end dates.
CREATE OR REPLACE FUNCTION check_milestone_due_date_within_project()
RETURNS TRIGGER AS $$
DECLARE
    v_start DATE;
    v_end   DATE;
BEGIN
    SELECT start_date, end_date INTO v_start, v_end FROM projects WHERE id = NEW.project_id;
    IF NEW.due_date < v_start OR NEW.due_date > v_end THEN
        RAISE EXCEPTION 'Milestone due_date (%) must fall within its project''s start_date (%) and end_date (%)',
            NEW.due_date, v_start, v_end
            USING ERRCODE = '23514'; -- check_violation, so it's classified as a
                                      -- constraint violation (not a generic
                                      -- error) by the JDBC/Hibernate layer
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_milestones_due_date_within_project
    BEFORE INSERT OR UPDATE ON milestones
    FOR EACH ROW EXECUTE FUNCTION check_milestone_due_date_within_project();

-- ==================== tasks ==================== --

CREATE TABLE tasks (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id      BIGINT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    milestone_id    BIGINT REFERENCES milestones (id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    priority        VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
                    CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status          VARCHAR(20) NOT NULL DEFAULT 'TO_DO'
                    CHECK (status IN ('TO_DO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED')),
    start_date      DATE NOT NULL,
    due_date        DATE NOT NULL,
    estimated_hours NUMERIC(6, 2),
    progress        NUMERIC(5, 2) NOT NULL DEFAULT 0
                    CHECK (progress BETWEEN 0 AND 100),
    completed_at    TIMESTAMPTZ,
    created_by      BIGINT REFERENCES users (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (due_date >= start_date)
);

CREATE INDEX idx_tasks_project_id ON tasks (project_id);
CREATE INDEX idx_tasks_milestone_id ON tasks (milestone_id);
CREATE INDEX idx_tasks_created_by ON tasks (created_by);
CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_due_date ON tasks (due_date);

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- "A Completed Task must have a Completion Date": auto-stamp completed_at
-- the moment status becomes COMPLETED, and clear it if the task is reopened,
-- so the two columns can never drift out of sync.
CREATE OR REPLACE FUNCTION set_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND NEW.completed_at IS NULL THEN
        NEW.completed_at = now();
    ELSIF NEW.status <> 'COMPLETED' THEN
        NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_completed_at
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_task_completed_at();

-- "A Task Due Date should not exceed the Project End Date."
CREATE OR REPLACE FUNCTION check_task_due_date_within_project()
RETURNS TRIGGER AS $$
DECLARE
    v_project_end_date DATE;
BEGIN
    IF NEW.due_date IS NOT NULL THEN
        SELECT end_date INTO v_project_end_date FROM projects WHERE id = NEW.project_id;
        IF NEW.due_date > v_project_end_date THEN
            RAISE EXCEPTION 'Task due_date (%) cannot be later than its project end_date (%)',
                NEW.due_date, v_project_end_date
                USING ERRCODE = '23514'; -- check_violation — see the milestone trigger above
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_due_date_within_project
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION check_task_due_date_within_project();

-- ==================== task_assignees ==================== --

CREATE TABLE task_assignees (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id     BIGINT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (task_id, user_id)
);

CREATE INDEX idx_task_assignees_task_id ON task_assignees (task_id);
CREATE INDEX idx_task_assignees_user_id ON task_assignees (user_id);

-- "Only project members should be assignable to tasks in that project."
CREATE OR REPLACE FUNCTION check_assignee_is_project_member()
RETURNS TRIGGER AS $$
DECLARE
    v_project_id BIGINT;
BEGIN
    SELECT project_id INTO v_project_id FROM tasks WHERE id = NEW.task_id;
    IF NOT EXISTS (
        SELECT 1 FROM project_members WHERE project_id = v_project_id AND user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'User % is not a member of project % and cannot be assigned to task %',
            NEW.user_id, v_project_id, NEW.task_id
            USING ERRCODE = '23514'; -- check_violation — see the milestone trigger above
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_assignees_project_member
    BEFORE INSERT OR UPDATE ON task_assignees
    FOR EACH ROW EXECUTE FUNCTION check_assignee_is_project_member();

-- "Inactive or suspended users should not receive active task assignments."
CREATE OR REPLACE FUNCTION check_assignee_not_suspended()
RETURNS TRIGGER AS $$
DECLARE
    v_account_status VARCHAR(20);
BEGIN
    SELECT account_status INTO v_account_status FROM users WHERE id = NEW.user_id;
    IF v_account_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'User % has account_status % and cannot be assigned to task %',
            NEW.user_id, v_account_status, NEW.task_id
            USING ERRCODE = '23514'; -- check_violation — see the milestone trigger above
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_assignees_not_suspended
    BEFORE INSERT OR UPDATE ON task_assignees
    FOR EACH ROW EXECUTE FUNCTION check_assignee_not_suspended();

-- ==================== task_dependencies ==================== --
-- A task cannot start until every task it depends on is COMPLETED. That
-- ordering rule is enforced in application business logic, not here — but
-- cycle prevention (below) is a DB-level invariant, since a cycle would make
-- the rule impossible to satisfy for every task caught in the loop.

CREATE TABLE task_dependencies (
    task_id            BIGINT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    depends_on_task_id BIGINT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_task_id),
    CHECK (task_id <> depends_on_task_id)
);

CREATE INDEX idx_task_dependencies_depends_on ON task_dependencies (depends_on_task_id);

-- The CHECK above only blocks a task depending on itself directly. Without
-- this, A -> B plus B -> A (or a longer chain) would deadlock every task in
-- the loop, since none of them could ever satisfy "depends-on is COMPLETED".
CREATE OR REPLACE FUNCTION check_task_dependency_cycle()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        WITH RECURSIVE chain AS (
            SELECT depends_on_task_id AS task_id
            FROM task_dependencies
            WHERE task_id = NEW.depends_on_task_id
            UNION
            SELECT td.depends_on_task_id
            FROM task_dependencies td
            JOIN chain c ON td.task_id = c.task_id
        )
        SELECT 1 FROM chain WHERE task_id = NEW.task_id
    ) THEN
        RAISE EXCEPTION 'Adding this dependency would create a cycle: task % already (transitively) depends on task %',
            NEW.depends_on_task_id, NEW.task_id
            USING ERRCODE = '23514'; -- check_violation — see the milestone trigger above
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_dependencies_no_cycle
    BEFORE INSERT OR UPDATE ON task_dependencies
    FOR EACH ROW EXECUTE FUNCTION check_task_dependency_cycle();

-- "A dependent task should not start until its required previous task has
-- been completed." Enforced from both directions, since either write path
-- can create the same invalid state:
--   1. A task's own status moving to IN_PROGRESS/IN_REVIEW/COMPLETED while a
--      dependency isn't COMPLETED yet (checked below, on tasks).
--   2. A new/updated task_dependencies row pointing an already-active task
--      at an incomplete prerequisite (checked further below, on
--      task_dependencies).
-- TO_DO and CANCELLED are always allowed — neither needs prerequisites done.
CREATE OR REPLACE FUNCTION check_task_dependencies_completed()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('IN_PROGRESS', 'IN_REVIEW', 'COMPLETED') AND EXISTS (
        SELECT 1
        FROM task_dependencies td
        JOIN tasks dep ON dep.id = td.depends_on_task_id
        WHERE td.task_id = NEW.id AND dep.status <> 'COMPLETED'
    ) THEN
        RAISE EXCEPTION 'Task % cannot move to status % while it has an incomplete dependency',
            NEW.id, NEW.status
            USING ERRCODE = '23514'; -- check_violation — see the milestone trigger above
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_dependencies_status_gate
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION check_task_dependencies_completed();

CREATE OR REPLACE FUNCTION check_new_dependency_against_task_status()
RETURNS TRIGGER AS $$
DECLARE
    v_task_status   VARCHAR(20);
    v_depends_on_status VARCHAR(20);
BEGIN
    SELECT status INTO v_task_status FROM tasks WHERE id = NEW.task_id;
    SELECT status INTO v_depends_on_status FROM tasks WHERE id = NEW.depends_on_task_id;
    IF v_task_status IN ('IN_PROGRESS', 'IN_REVIEW', 'COMPLETED') AND v_depends_on_status <> 'COMPLETED' THEN
        RAISE EXCEPTION 'Cannot add dependency: task % is already % but task % (its new dependency) is not COMPLETED',
            NEW.task_id, v_task_status, NEW.depends_on_task_id
            USING ERRCODE = '23514'; -- check_violation — see the milestone trigger above
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_dependencies_status_gate
    BEFORE INSERT OR UPDATE ON task_dependencies
    FOR EACH ROW EXECUTE FUNCTION check_new_dependency_against_task_status();

-- "A task under Project A should not be attachable to a milestone from
-- Project B."
CREATE OR REPLACE FUNCTION check_task_milestone_matches_project()
RETURNS TRIGGER AS $$
DECLARE
    v_milestone_project_id BIGINT;
BEGIN
    IF NEW.milestone_id IS NOT NULL THEN
        SELECT project_id INTO v_milestone_project_id FROM milestones WHERE id = NEW.milestone_id;
        IF v_milestone_project_id <> NEW.project_id THEN
            RAISE EXCEPTION 'Task''s milestone % belongs to project %, not the task''s project %',
                NEW.milestone_id, v_milestone_project_id, NEW.project_id
                USING ERRCODE = '23514'; -- check_violation — see the milestone trigger above
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_milestone_project_match
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION check_task_milestone_matches_project();

-- ==================== project/milestone progress (derived) ==================== --
-- "Project Progress should be calculated as a percentage based on completed
-- tasks compared with total tasks" (and the same rule for milestones).
-- CANCELLED tasks are excluded from both numerator and denominator — a
-- cancelled task isn't remaining project work, and shouldn't drag progress
-- down either. projects.progress/milestones.progress stay ordinary writable
-- columns (no API contract change) but are kept from ever going stale by two
-- enforcement points below: the AFTER trigger on tasks recomputes both
-- parents whenever a task changes, and the BEFORE UPDATE triggers on
-- projects/milestones themselves recompute on *any* direct update to that
-- row, silently overriding whatever value was sent — see the README's
-- Business Rules section for the "writable but not authoritative" framing.

CREATE OR REPLACE FUNCTION fn_compute_project_progress(p_project_id BIGINT)
RETURNS NUMERIC AS $$
DECLARE
    v_total     INTEGER;
    v_completed INTEGER;
BEGIN
    SELECT count(*) FILTER (WHERE status <> 'CANCELLED'),
           count(*) FILTER (WHERE status = 'COMPLETED')
    INTO v_total, v_completed
    FROM tasks WHERE project_id = p_project_id;

    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    RETURN round(100.0 * v_completed / v_total, 2);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION fn_compute_milestone_progress(p_milestone_id BIGINT)
RETURNS NUMERIC AS $$
DECLARE
    v_total     INTEGER;
    v_completed INTEGER;
BEGIN
    SELECT count(*) FILTER (WHERE status <> 'CANCELLED'),
           count(*) FILTER (WHERE status = 'COMPLETED')
    INTO v_total, v_completed
    FROM tasks WHERE milestone_id = p_milestone_id;

    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    RETURN round(100.0 * v_completed / v_total, 2);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION trg_fn_tasks_progress_sync()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE projects SET progress = fn_compute_project_progress(OLD.project_id) WHERE id = OLD.project_id;
        IF OLD.milestone_id IS NOT NULL THEN
            UPDATE milestones SET progress = fn_compute_milestone_progress(OLD.milestone_id) WHERE id = OLD.milestone_id;
        END IF;
        RETURN OLD;
    END IF;

    UPDATE projects SET progress = fn_compute_project_progress(NEW.project_id) WHERE id = NEW.project_id;
    IF NEW.milestone_id IS NOT NULL THEN
        UPDATE milestones SET progress = fn_compute_milestone_progress(NEW.milestone_id) WHERE id = NEW.milestone_id;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.project_id <> NEW.project_id THEN
            UPDATE projects SET progress = fn_compute_project_progress(OLD.project_id) WHERE id = OLD.project_id;
        END IF;
        IF OLD.milestone_id IS NOT NULL AND OLD.milestone_id IS DISTINCT FROM NEW.milestone_id THEN
            UPDATE milestones SET progress = fn_compute_milestone_progress(OLD.milestone_id) WHERE id = OLD.milestone_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_progress_sync
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW EXECUTE FUNCTION trg_fn_tasks_progress_sync();

CREATE OR REPLACE FUNCTION trg_fn_projects_progress_derived()
RETURNS TRIGGER AS $$
BEGIN
    NEW.progress = fn_compute_project_progress(OLD.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_progress_derived
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION trg_fn_projects_progress_derived();

CREATE OR REPLACE FUNCTION trg_fn_milestones_progress_derived()
RETURNS TRIGGER AS $$
BEGIN
    NEW.progress = fn_compute_milestone_progress(OLD.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_milestones_progress_derived
    BEFORE UPDATE ON milestones
    FOR EACH ROW EXECUTE FUNCTION trg_fn_milestones_progress_derived();

-- ==================== subtasks ==================== --

CREATE TABLE subtasks (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id     BIGINT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    assignee_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
    due_date    DATE,
    status      VARCHAR(20) NOT NULL DEFAULT 'TO_DO'
                CHECK (status IN ('TO_DO', 'IN_PROGRESS', 'COMPLETED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subtasks_task_id ON subtasks (task_id);
CREATE INDEX idx_subtasks_assignee_id ON subtasks (assignee_id);

CREATE TRIGGER trg_subtasks_updated_at
    BEFORE UPDATE ON subtasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==================== checklist_items ==================== --
-- Lightweight todo items inside a task, distinct from subtasks (no
-- assignee/due date of their own — just "done or not").

CREATE TABLE checklist_items (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id      BIGINT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    content      VARCHAR(300) NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_items_task_id ON checklist_items (task_id);

CREATE TRIGGER trg_checklist_items_updated_at
    BEFORE UPDATE ON checklist_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==================== comments ==================== --

CREATE TABLE comments (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id           BIGINT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    user_id           BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    parent_comment_id BIGINT REFERENCES comments (id) ON DELETE CASCADE,
    message           TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_task_id ON comments (task_id);
CREATE INDEX idx_comments_user_id ON comments (user_id);
CREATE INDEX idx_comments_parent_comment_id ON comments (parent_comment_id);

CREATE TRIGGER trg_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==================== attachments ==================== --
-- Attached to exactly one of a project or a task (not both, not neither).

CREATE TABLE attachments (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id  BIGINT REFERENCES projects (id) ON DELETE CASCADE,
    task_id     BIGINT REFERENCES tasks (id) ON DELETE CASCADE,
    uploaded_by BIGINT REFERENCES users (id) ON DELETE SET NULL,
    file_name   VARCHAR(255) NOT NULL,
    file_url    VARCHAR(500) NOT NULL,
    file_size   BIGINT,
    mime_type   VARCHAR(100),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(project_id, task_id) = 1)
);

CREATE INDEX idx_attachments_project_id ON attachments (project_id);
CREATE INDEX idx_attachments_task_id ON attachments (task_id);

-- ==================== work_logs ==================== --

CREATE TABLE work_logs (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id      BIGINT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    work_date    DATE NOT NULL,
    hours_worked NUMERIC(5, 2) NOT NULL CHECK (hours_worked > 0),
    description  VARCHAR(500),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_logs_task_id ON work_logs (task_id);
CREATE INDEX idx_work_logs_user_id ON work_logs (user_id);
CREATE INDEX idx_work_logs_work_date ON work_logs (work_date);

-- ==================== notifications ==================== --

CREATE TABLE notifications (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type       VARCHAR(30) NOT NULL
               CHECK (type IN ('TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'COMMENT_ADDED',
                                'PROJECT_UPDATED', 'DEADLINE_REMINDER', 'OVERDUE_TASK',
                                'MILESTONE_UPDATED')),
    title      VARCHAR(200) NOT NULL,
    message    VARCHAR(500),
    project_id BIGINT REFERENCES projects (id) ON DELETE CASCADE,
    task_id    BIGINT REFERENCES tasks (id) ON DELETE CASCADE,
    is_read    BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_user_id_is_read ON notifications (user_id, is_read);

-- ==================== overdue detection ==================== --
-- "A task whose Due Date has passed and whose status is not Completed
-- should be marked as Overdue automatically." Overdue is a *derived* state,
-- not a stored status or column — v_overdue_tasks computes it live from
-- due_date/status, so it's always current with no sync to maintain.
CREATE VIEW v_overdue_tasks AS
SELECT t.*
FROM tasks t
WHERE t.due_date < CURRENT_DATE
  AND t.status NOT IN ('COMPLETED', 'CANCELLED');

-- Generates an OVERDUE_TASK notification for every current assignee of
-- every overdue task. Dedupe is date-based, not read-status-based: at most
-- one OVERDUE_TASK notification per (user, task) per calendar day, so a
-- user who already read today's reminder doesn't get spammed by repeat runs
-- of this function today, but still gets a fresh one tomorrow if the task
-- is still overdue. Nothing calls this on a schedule yet — wiring a daily
-- caller (a Spring @Scheduled job, pg_cron, etc.) is a backend follow-up;
-- see the README.
CREATE OR REPLACE FUNCTION fn_generate_overdue_notifications()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO notifications (user_id, type, title, message, project_id, task_id)
    SELECT ta.user_id, 'OVERDUE_TASK', 'Task overdue',
           '"' || t.title || '" was due on ' || to_char(t.due_date, 'YYYY-MM-DD') || ' and is not yet completed',
           t.project_id, t.id
    FROM v_overdue_tasks t
    JOIN task_assignees ta ON ta.task_id = t.id
    WHERE NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = ta.user_id
          AND n.task_id = t.id
          AND n.type = 'OVERDUE_TASK'
          AND n.created_at::date = CURRENT_DATE
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ==================== activity_logs ==================== --

CREATE TABLE activity_logs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT REFERENCES users (id) ON DELETE SET NULL,
    action      VARCHAR(30) NOT NULL
                CHECK (action IN ('PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_COMPLETED',
                                   'TASK_CREATED', 'TASK_ASSIGNED', 'TASK_STATUS_CHANGED',
                                   'TASK_COMPLETED', 'COMMENT_ADDED', 'FILE_UPLOADED',
                                   'MILESTONE_CREATED', 'MILESTONE_COMPLETED')),
    project_id  BIGINT REFERENCES projects (id) ON DELETE CASCADE,
    task_id     BIGINT REFERENCES tasks (id) ON DELETE CASCADE,
    description VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs (user_id);
CREATE INDEX idx_activity_logs_project_id ON activity_logs (project_id);
CREATE INDEX idx_activity_logs_task_id ON activity_logs (task_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs (created_at DESC);

-- ==================== reporting views ==================== --
-- Most of Role_Requirment.md's Reports section (Project/Task/Status/
-- Completion/Overdue/Team Performance/Workload reports) is derived live
-- from existing tables rather than stored — these views are that
-- derivation layer. report_exports/kpi_snapshots below persist the parts
-- that genuinely need history (an exported file, a point-in-time KPI
-- snapshot), not a live-queryable report body.

-- Project Status Report: counts by status, plus a live "delayed" signal
-- (past end_date, not finished) independent of the status field itself.
CREATE VIEW v_project_status_summary AS
SELECT status,
       count(*) AS project_count,
       count(*) FILTER (
           WHERE end_date < CURRENT_DATE AND status NOT IN ('COMPLETED', 'CANCELLED')
       ) AS delayed_count
FROM projects
GROUP BY status;

-- Task Completion Report: completed tasks and completion % by project.
CREATE VIEW v_task_completion_by_project AS
SELECT p.id AS project_id,
       p.name AS project_name,
       count(t.id) AS total_tasks,
       count(t.id) FILTER (WHERE t.status = 'COMPLETED') AS completed_tasks,
       p.progress AS completion_percentage
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id
GROUP BY p.id, p.name, p.progress;

-- Team Performance Report: per-user assigned/completed/pending/overdue
-- counts and completion rate.
CREATE VIEW v_team_performance AS
SELECT u.id AS user_id,
       u.full_name,
       count(t.id) AS assigned_tasks,
       count(t.id) FILTER (WHERE t.status = 'COMPLETED') AS completed_tasks,
       count(t.id) FILTER (WHERE t.status NOT IN ('COMPLETED', 'CANCELLED')) AS pending_tasks,
       count(t.id) FILTER (
           WHERE t.due_date < CURRENT_DATE AND t.status NOT IN ('COMPLETED', 'CANCELLED')
       ) AS overdue_tasks,
       CASE WHEN count(t.id) = 0 THEN 0
            ELSE round(100.0 * count(t.id) FILTER (WHERE t.status = 'COMPLETED') / count(t.id), 2)
       END AS completion_rate
FROM users u
LEFT JOIN task_assignees ta ON ta.user_id = u.id
LEFT JOIN tasks t ON t.id = ta.task_id
GROUP BY u.id, u.full_name;

-- Workload Report: assigned/active/overdue task counts plus estimated vs.
-- actual (logged) hours per user. Task-assignment stats and work-log hours
-- are pre-aggregated in separate subqueries before joining to users — joining
-- tasks and work_logs directly in one query would fan out (a task with
-- several work_log rows would have its estimated_hours counted once per
-- row), inflating estimated_hours.
CREATE VIEW v_team_workload AS
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
           count(*) FILTER (WHERE t.status IN ('TO_DO', 'IN_PROGRESS', 'IN_REVIEW')) AS active_tasks,
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

-- ==================== report_exports / kpi_snapshots ==================== --

CREATE TABLE report_exports (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_type  VARCHAR(30) NOT NULL
                 CHECK (report_type IN ('PROJECT_REPORT', 'TASK_REPORT', 'PROJECT_STATUS_REPORT',
                                         'TASK_COMPLETION_REPORT', 'OVERDUE_TASK_REPORT',
                                         'TEAM_PERFORMANCE_REPORT', 'WORKLOAD_REPORT')),
    generated_by BIGINT REFERENCES users (id) ON DELETE SET NULL,
    filters      JSONB,
    file_format  VARCHAR(10) NOT NULL CHECK (file_format IN ('PDF', 'EXCEL')),
    file_url     VARCHAR(500),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_exports_generated_by ON report_exports (generated_by);
CREATE INDEX idx_report_exports_report_type ON report_exports (report_type);

-- Point-in-time KPI snapshots, so KPI trend charts have history instead of
-- only "right now". project_id NULL means an org-wide snapshot.
CREATE TABLE kpi_snapshots (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    snapshot_date               DATE NOT NULL,
    project_id                  BIGINT REFERENCES projects (id) ON DELETE CASCADE,
    project_completion_rate     NUMERIC(5, 2),
    task_completion_rate        NUMERIC(5, 2),
    overdue_rate                NUMERIC(5, 2),
    average_task_completion_time NUMERIC(10, 2),
    on_time_completion_rate     NUMERIC(5, 2),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (snapshot_date, project_id)
);

CREATE INDEX idx_kpi_snapshots_project_id ON kpi_snapshots (project_id);
CREATE INDEX idx_kpi_snapshots_snapshot_date ON kpi_snapshots (snapshot_date);
