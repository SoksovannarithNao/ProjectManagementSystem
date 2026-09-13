-- Task & Project Management System — team invitations, managed
-- position/department lookups, and real subtask/comment backend support.
-- Applied on top of V3__add_registration_otp_and_preferences.sql.
-- This is the versioned migration form of the same delta added to
-- database/init/01-init.sql for this change — see that file for the
-- authoritative, actually-executed SQL (Docker/CI run init/*.sql, not this
-- migrations folder — see database/README.md's Migrations section).

-- ==================== positions / departments ==================== --
-- Org-wide lookup lists, managed by a Team Admin — replaces the free-text
-- users.position/users.department columns below.

CREATE TABLE positions (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_positions_name_lower ON positions (LOWER(name));

CREATE TABLE departments (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_departments_name_lower ON departments (LOWER(name));

-- Backfill a lookup row for every distinct free-text value already in use,
-- point users at it, then drop the old text columns.
INSERT INTO positions (name)
SELECT DISTINCT position FROM users WHERE position IS NOT NULL AND position <> '';

INSERT INTO departments (name)
SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department <> '';

ALTER TABLE users ADD COLUMN position_id BIGINT REFERENCES positions (id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN department_id BIGINT REFERENCES departments (id) ON DELETE SET NULL;

UPDATE users u SET position_id = p.id FROM positions p WHERE p.name = u.position;
UPDATE users u SET department_id = d.id FROM departments d WHERE d.name = u.department;

ALTER TABLE users DROP COLUMN position;
ALTER TABLE users DROP COLUMN department;

CREATE INDEX idx_users_position_id ON users (position_id);
CREATE INDEX idx_users_department_id ON users (department_id);

-- ==================== team invitations ==================== --
-- A project's membership IS its team, so an invitation is just a
-- project_members row that hasn't been accepted yet, rather than a separate
-- table. Declining then being re-invited reuses the same row (the existing
-- (project_id, user_id) UNIQUE constraint already guarantees only one).

ALTER TABLE project_members ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('PENDING', 'ACTIVE', 'DECLINED'));
ALTER TABLE project_members ADD COLUMN invited_by BIGINT REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE project_members ADD COLUMN responded_at TIMESTAMPTZ;

CREATE INDEX idx_project_members_status ON project_members (status);

-- Only an ACTIVE membership grants task-assignment eligibility — a pending,
-- not-yet-accepted invitation must not.
CREATE OR REPLACE FUNCTION check_assignee_is_project_member()
RETURNS TRIGGER AS $$
DECLARE
    v_project_id BIGINT;
BEGIN
    SELECT project_id INTO v_project_id FROM tasks WHERE id = NEW.task_id;
    IF NOT EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = v_project_id AND user_id = NEW.user_id AND status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'User % is not a member of project % and cannot be assigned to task %',
            NEW.user_id, v_project_id, NEW.task_id
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- "notifications_type_check" is Postgres's auto-generated name for V1's
-- unnamed CHECK (type IN (...)) — add the two new invitation notification
-- types.
ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'COMMENT_ADDED',
                     'PROJECT_UPDATED', 'DEADLINE_REMINDER', 'OVERDUE_TASK',
                     'MILESTONE_UPDATED', 'TEAM_INVITATION', 'TEAM_INVITATION_RESPONDED'));

-- ==================== subtasks / comments ==================== --
-- Both tables already existed (V1) but had no backend entity/repository/
-- controller — this migration is schema-only; the new Java code is what
-- actually turns them from "DB-only" into a real feature. No column changes
-- needed here.
