-- Task & Project Management System — Flyway baseline
-- This is the versioned starting point for schema history going forward.
-- Content matches database/init/01-init.sql as of the migration folder's
-- introduction — from here on, schema changes are new V2__*.sql files, not
-- edits to this one (Flyway checksums applied migrations and refuses to
-- re-run a file whose content changed underneath it).

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
    start_date      DATE,
    due_date        DATE,
    estimated_hours NUMERIC(6, 2),
    progress        NUMERIC(5, 2) NOT NULL DEFAULT 0
                    CHECK (progress BETWEEN 0 AND 100),
    completed_at    TIMESTAMPTZ,
    created_by      BIGINT REFERENCES users (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date)
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
