-- Task & Project Management System — permissions, derived progress, and
-- integrity rules
-- Applied on top of V1__initial_schema.sql. This is the versioned migration
-- form of the same delta added to database/init/01-init.sql for this change
-- — see that file for the authoritative, actually-executed SQL (Docker/CI
-- run init/*.sql, not this migrations folder — see database/README.md's
-- Migrations section) and database/README.md for the design rationale
-- behind each rule below.

-- ==================== permissions / role_permissions ==================== --

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

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('ADMINISTRATOR', 'PROJECT_MANAGER');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'TEAM_LEADER' AND p.code IN ('VIEW', 'CREATE', 'EDIT', 'ASSIGN', 'GENERATE_REPORTS');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'TEAM_MEMBER' AND p.code IN ('VIEW', 'EDIT');

-- ==================== tasks: required dates ==================== --
-- Migration form of the init script's inline NOT NULL — an ALTER here
-- assumes an existing database already has every task's dates populated;
-- a fresh V1+V2 install never has this problem since no task rows exist yet.

ALTER TABLE tasks ALTER COLUMN start_date SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN due_date SET NOT NULL;
-- "tasks_check" is Postgres's auto-generated name for V1's unnamed
-- table-level CHECK (due_date IS NULL OR start_date IS NULL OR due_date >=
-- start_date) — verified against a throwaway instance of the V1 baseline.
ALTER TABLE tasks DROP CONSTRAINT tasks_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_check CHECK (due_date >= start_date);

-- ==================== dependency status gate ==================== --

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
            USING ERRCODE = '23514';
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
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_dependencies_status_gate
    BEFORE INSERT OR UPDATE ON task_dependencies
    FOR EACH ROW EXECUTE FUNCTION check_new_dependency_against_task_status();

-- ==================== task/milestone/project consistency ==================== --

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
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_milestone_project_match
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION check_task_milestone_matches_project();

-- ==================== task assignee integrity ==================== --

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
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_assignees_project_member
    BEFORE INSERT OR UPDATE ON task_assignees
    FOR EACH ROW EXECUTE FUNCTION check_assignee_is_project_member();

CREATE OR REPLACE FUNCTION check_assignee_not_suspended()
RETURNS TRIGGER AS $$
DECLARE
    v_account_status VARCHAR(20);
BEGIN
    SELECT account_status INTO v_account_status FROM users WHERE id = NEW.user_id;
    IF v_account_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'User % has account_status % and cannot be assigned to task %',
            NEW.user_id, v_account_status, NEW.task_id
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_assignees_not_suspended
    BEFORE INSERT OR UPDATE ON task_assignees
    FOR EACH ROW EXECUTE FUNCTION check_assignee_not_suspended();

-- ==================== project/milestone progress (derived) ==================== --

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

-- Backfill: bring existing rows' stored progress in line with the derived
-- value immediately, rather than waiting for the next task mutation.
UPDATE projects SET progress = fn_compute_project_progress(id);
UPDATE milestones SET progress = fn_compute_milestone_progress(id);

-- ==================== overdue detection ==================== --

CREATE VIEW v_overdue_tasks AS
SELECT t.*
FROM tasks t
WHERE t.due_date < CURRENT_DATE
  AND t.status NOT IN ('COMPLETED', 'CANCELLED');

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

-- ==================== reporting views ==================== --

CREATE VIEW v_project_status_summary AS
SELECT status,
       count(*) AS project_count,
       count(*) FILTER (
           WHERE end_date < CURRENT_DATE AND status NOT IN ('COMPLETED', 'CANCELLED')
       ) AS delayed_count
FROM projects
GROUP BY status;

CREATE VIEW v_task_completion_by_project AS
SELECT p.id AS project_id,
       p.name AS project_name,
       count(t.id) AS total_tasks,
       count(t.id) FILTER (WHERE t.status = 'COMPLETED') AS completed_tasks,
       p.progress AS completion_percentage
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id
GROUP BY p.id, p.name, p.progress;

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
