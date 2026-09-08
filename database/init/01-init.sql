-- Task & Project Management System — initial schema
-- Runs automatically when the Postgres container starts with an empty data
-- directory (mounted into /docker-entrypoint-initdb.d by docker-compose.yml).
--
-- Scope: the core tables needed for the main workflow — Register/Login ->
-- Create Project -> Add Team Members -> Create Milestones -> Create Tasks ->
-- Assign Tasks -> Track Progress. Comments, attachments, notifications, work
-- logs, and activity logs are intentionally left out for a later migration.

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
    username         VARCHAR(50) NOT NULL UNIQUE,
    email            VARCHAR(255) NOT NULL UNIQUE,
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
-- A task cannot start until every task it depends on is COMPLETED.
-- Enforced in application business logic, not by a DB trigger.

CREATE TABLE task_dependencies (
    task_id            BIGINT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    depends_on_task_id BIGINT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_task_id),
    CHECK (task_id <> depends_on_task_id)
);

CREATE INDEX idx_task_dependencies_depends_on ON task_dependencies (depends_on_task_id);
