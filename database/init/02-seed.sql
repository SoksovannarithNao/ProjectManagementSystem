-- Task & Project Management System — demo/placeholder data
-- Runs after 01-init.sql (docker-entrypoint-initdb.d executes every .sql
-- file in this folder in filename order, against an empty data directory).
--
-- Purpose: give the app enough realistic-looking data to demo the main
-- workflow end to end. Not meant as a fixture set for automated tests.
--
-- Note: password_hash below is a bcrypt hash (cost 10) of the plaintext
-- "secret", generated fresh for this file and verified to actually match —
-- the hash previously here was a commonly-copied "sample" value that does
-- NOT verify against "secret" (confirmed independently with bcryptjs), so
-- none of these seed accounts could log in. All seeded users share it.

-- ==================== users ====================

INSERT INTO users (full_name, username, email, password_hash, gender, date_of_birth, phone_number, position, department, role_id, account_status) VALUES
('Alex Morgan',   'alex.admin',    'alex.morgan@taskflow.dev',  '$2b$10$RK7GKnRPd9BXyVwFe0VSdeLKPt6spo2pBsbDD.KKo.8cFZQN21eW6', 'Female', '1988-03-14', '+1-555-0101', 'System Administrator', 'IT Operations', (SELECT id FROM roles WHERE name = 'ADMINISTRATOR'),   'ACTIVE'),
('Nikky Sharma',  'nikky.sharma',  'nikky@taskflow.dev',        '$2b$10$RK7GKnRPd9BXyVwFe0VSdeLKPt6spo2pBsbDD.KKo.8cFZQN21eW6', 'Female', '1990-07-22', '+1-555-0102', 'Product Manager',       'Product',       (SELECT id FROM roles WHERE name = 'PROJECT_MANAGER'), 'ACTIVE'),
('Ana Torres',    'ana.torres',    'ana.torres@taskflow.dev',   '$2b$10$RK7GKnRPd9BXyVwFe0VSdeLKPt6spo2pBsbDD.KKo.8cFZQN21eW6', 'Female', '1985-11-02', '+1-555-0103', 'Program Manager',       'Product',       (SELECT id FROM roles WHERE name = 'PROJECT_MANAGER'), 'ACTIVE'),
('Owen Blake',    'owen.blake',    'owen@taskflow.dev',         '$2b$10$RK7GKnRPd9BXyVwFe0VSdeLKPt6spo2pBsbDD.KKo.8cFZQN21eW6', 'Male',   '1993-05-18', '+1-555-0104', 'Frontend Team Lead',    'Engineering',   (SELECT id FROM roles WHERE name = 'TEAM_LEADER'),     'ACTIVE'),
('Ben Carter',    'ben.carter',    'ben.carter@taskflow.dev',   '$2b$10$RK7GKnRPd9BXyVwFe0VSdeLKPt6spo2pBsbDD.KKo.8cFZQN21eW6', 'Male',   '1991-09-09', '+1-555-0105', 'Backend Team Lead',     'Engineering',   (SELECT id FROM roles WHERE name = 'TEAM_LEADER'),     'ACTIVE'),
('Maya Chen',     'maya.chen',     'maya@taskflow.dev',         '$2b$10$RK7GKnRPd9BXyVwFe0VSdeLKPt6spo2pBsbDD.KKo.8cFZQN21eW6', 'Female', '1996-01-30', '+1-555-0106', 'UI / UX Designer',      'Design',        (SELECT id FROM roles WHERE name = 'TEAM_MEMBER'),     'ACTIVE'),
('Ravi Patel',    'ravi.patel',    'ravi@taskflow.dev',         '$2b$10$RK7GKnRPd9BXyVwFe0VSdeLKPt6spo2pBsbDD.KKo.8cFZQN21eW6', 'Male',   '1994-06-11', '+1-555-0107', 'Backend Engineer',      'Engineering',   (SELECT id FROM roles WHERE name = 'TEAM_MEMBER'),     'ACTIVE'),
('Sofia Ruiz',    'sofia.ruiz',    'sofia@taskflow.dev',        '$2b$10$RK7GKnRPd9BXyVwFe0VSdeLKPt6spo2pBsbDD.KKo.8cFZQN21eW6', 'Female', '1995-12-25', '+1-555-0108', 'QA Engineer',           'Engineering',   (SELECT id FROM roles WHERE name = 'TEAM_MEMBER'),     'ACTIVE'),
('Leo Nguyen',    'leo.nguyen',    'leo@taskflow.dev',          '$2b$10$RK7GKnRPd9BXyVwFe0VSdeLKPt6spo2pBsbDD.KKo.8cFZQN21eW6', 'Male',   '1992-08-08', '+1-555-0109', 'DevOps Engineer',       'Engineering',   (SELECT id FROM roles WHERE name = 'TEAM_MEMBER'),     'ACTIVE'),
('Chloe Kim',     'chloe.kim',     'chloe@taskflow.dev',        '$2b$10$RK7GKnRPd9BXyVwFe0VSdeLKPt6spo2pBsbDD.KKo.8cFZQN21eW6', 'Female', '1997-04-17', '+1-555-0110', 'Frontend Engineer',     'Engineering',   (SELECT id FROM roles WHERE name = 'TEAM_MEMBER'),     'ACTIVE'),
('Daniel Osei',   'daniel.osei',   'daniel@taskflow.dev',       '$2b$10$RK7GKnRPd9BXyVwFe0VSdeLKPt6spo2pBsbDD.KKo.8cFZQN21eW6', 'Male',   '1990-02-27', '+1-555-0111', 'Backend Engineer',      'Engineering',   (SELECT id FROM roles WHERE name = 'TEAM_MEMBER'),     'ACTIVE'),
('Emma Silva',    'emma.silva',    'emma@taskflow.dev',         '$2b$10$RK7GKnRPd9BXyVwFe0VSdeLKPt6spo2pBsbDD.KKo.8cFZQN21eW6', 'Female', '1998-10-05', '+1-555-0112', 'Marketing Specialist',  'Marketing',     (SELECT id FROM roles WHERE name = 'TEAM_MEMBER'),     'INACTIVE'),
('Frank Lee',     'frank.lee',     'frank@taskflow.dev',        '$2b$10$RK7GKnRPd9BXyVwFe0VSdeLKPt6spo2pBsbDD.KKo.8cFZQN21eW6', 'Male',   '1989-01-19', '+1-555-0113', 'Support Engineer',      'Engineering',   (SELECT id FROM roles WHERE name = 'TEAM_MEMBER'),     'SUSPENDED');

-- ==================== projects ====================
-- progress is intentionally omitted here (defaults to 0) — it's now fully
-- derived from task completion by a DB trigger (see 01-init.sql), and
-- self-corrects as tasks are seeded below.

INSERT INTO projects (project_code, name, description, start_date, end_date, manager_id, priority, status) VALUES
('PRJ-1001', 'Website Redesign',           'Marketing website redesign and rebrand',        '2026-06-01', '2026-10-15', (SELECT id FROM users WHERE username = 'nikky.sharma'), 'HIGH',     'IN_PROGRESS'),
('PRJ-1002', 'Mobile Application',         'Build the new mobile customer experience',       '2026-05-15', '2026-11-30', (SELECT id FROM users WHERE username = 'ana.torres'),   'HIGH',     'IN_PROGRESS'),
('PRJ-1003', 'Backend System Migration',   'Migrate the core API platform to v2',            '2026-04-01', '2026-09-30', (SELECT id FROM users WHERE username = 'nikky.sharma'), 'CRITICAL', 'IN_PROGRESS'),
('PRJ-1004', 'Design System Unification',  'Unify UI components across every product',       '2026-03-01', '2026-07-01', (SELECT id FROM users WHERE username = 'ana.torres'),   'MEDIUM',   'COMPLETED'),
('PRJ-1005', 'Internal Ops Dashboard',     'Internal reporting and operations tooling',      '2026-07-01', '2026-12-15', (SELECT id FROM users WHERE username = 'nikky.sharma'), 'MEDIUM',   'PLANNING'),
('PRJ-1006', 'Customer Support Portal',    'Self-service support portal for customers',      '2026-02-01', '2026-09-30', (SELECT id FROM users WHERE username = 'ana.torres'),   'LOW',      'ON_HOLD');
-- end_date pushed out from the original 2026-08-01 — being on hold slipped
-- the timeline, and both of this project's tasks (below) are due after that
-- date. Kept in sync with the new "task due_date <= project end_date" trigger.

-- ==================== project_members ====================

INSERT INTO project_members (project_id, user_id, project_role) VALUES
((SELECT id FROM projects WHERE project_code = 'PRJ-1001'), (SELECT id FROM users WHERE username = 'nikky.sharma'), 'PROJECT_MANAGER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1001'), (SELECT id FROM users WHERE username = 'owen.blake'),   'TEAM_LEADER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1001'), (SELECT id FROM users WHERE username = 'maya.chen'),    'TEAM_MEMBER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1001'), (SELECT id FROM users WHERE username = 'chloe.kim'),    'TEAM_MEMBER'),

((SELECT id FROM projects WHERE project_code = 'PRJ-1002'), (SELECT id FROM users WHERE username = 'ana.torres'),   'PROJECT_MANAGER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1002'), (SELECT id FROM users WHERE username = 'ben.carter'),   'TEAM_LEADER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1002'), (SELECT id FROM users WHERE username = 'sofia.ruiz'),   'TEAM_MEMBER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1002'), (SELECT id FROM users WHERE username = 'chloe.kim'),    'TEAM_MEMBER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1002'), (SELECT id FROM users WHERE username = 'owen.blake'),   'TEAM_MEMBER'),

((SELECT id FROM projects WHERE project_code = 'PRJ-1003'), (SELECT id FROM users WHERE username = 'nikky.sharma'), 'PROJECT_MANAGER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1003'), (SELECT id FROM users WHERE username = 'ben.carter'),   'TEAM_LEADER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1003'), (SELECT id FROM users WHERE username = 'ravi.patel'),   'TEAM_MEMBER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1003'), (SELECT id FROM users WHERE username = 'daniel.osei'),  'TEAM_MEMBER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1003'), (SELECT id FROM users WHERE username = 'leo.nguyen'),   'TEAM_MEMBER'),

((SELECT id FROM projects WHERE project_code = 'PRJ-1004'), (SELECT id FROM users WHERE username = 'ana.torres'),   'PROJECT_MANAGER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1004'), (SELECT id FROM users WHERE username = 'owen.blake'),   'TEAM_LEADER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1004'), (SELECT id FROM users WHERE username = 'maya.chen'),    'TEAM_MEMBER'),

((SELECT id FROM projects WHERE project_code = 'PRJ-1005'), (SELECT id FROM users WHERE username = 'nikky.sharma'), 'PROJECT_MANAGER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1005'), (SELECT id FROM users WHERE username = 'chloe.kim'),    'TEAM_MEMBER'),

((SELECT id FROM projects WHERE project_code = 'PRJ-1006'), (SELECT id FROM users WHERE username = 'ana.torres'),   'PROJECT_MANAGER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1006'), (SELECT id FROM users WHERE username = 'sofia.ruiz'),   'TEAM_LEADER'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1006'), (SELECT id FROM users WHERE username = 'frank.lee'),    'TEAM_MEMBER');

-- ==================== milestones ====================
-- progress is intentionally omitted here (defaults to 0) — it's now fully
-- derived from the tasks linked to each milestone by a DB trigger (see
-- 01-init.sql), and self-corrects as tasks are seeded below.

INSERT INTO milestones (project_id, title, description, due_date, status) VALUES
((SELECT id FROM projects WHERE project_code = 'PRJ-1001'), 'Discovery & Wireframes',      'User research and low-fidelity wireframes',       '2026-06-20', 'COMPLETED'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1001'), 'Visual Design Approved',      'Final visual design signed off by stakeholders',  '2026-08-01', 'COMPLETED'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1001'), 'Launch Ready',                'Site built, tested, and ready to ship',            '2026-10-10', 'IN_PROGRESS'),

((SELECT id FROM projects WHERE project_code = 'PRJ-1002'), 'MVP Feature Freeze',          'Core feature set locked for the first release',   '2026-08-15', 'IN_PROGRESS'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1002'), 'Beta Release',                'Public beta available in app stores',              '2026-10-15', 'PENDING'),

((SELECT id FROM projects WHERE project_code = 'PRJ-1003'), 'API v2 Contract Finalized',   'Endpoint contracts reviewed and frozen',           '2026-06-15', 'COMPLETED'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1003'), 'Data Migration Complete',     'All production data moved to the new schema',     '2026-09-15', 'IN_PROGRESS'),

((SELECT id FROM projects WHERE project_code = 'PRJ-1004'), 'Component Audit',             'Inventory of every component in use today',       '2026-04-01', 'COMPLETED'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1004'), 'Library v1 Shipped',         'Unified component library published',              '2026-07-01', 'COMPLETED'),

((SELECT id FROM projects WHERE project_code = 'PRJ-1005'), 'Requirements Sign-off',       'Stakeholder requirements gathered and approved',   '2026-08-01', 'PENDING'),

((SELECT id FROM projects WHERE project_code = 'PRJ-1006'), 'Vendor Evaluation',           'Compare ticketing/support platform vendors',       '2026-03-15', 'COMPLETED'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1006'), 'Integration Spike',           'Prototype integration with the chosen vendor',     '2026-06-01', 'PENDING');

-- ==================== tasks ====================

-- start_date is now required (Role_Requirment.md: "Each task should have a
-- Start Date and Due Date") — every row below has one, including the 8 rows
-- that previously left it NULL.
--
-- 'QA pass on checkout flow' and 'Migrate user table schema' are seeded as
-- TO_DO/0 progress rather than their original IN_REVIEW/IN_PROGRESS: both
-- depend on a task that isn't COMPLETED yet ('Fix login redirect bug' and
-- 'Review API documentation' respectively), and the new dependency-status
-- trigger blocks an active status while a dependency is incomplete. Reopening
-- them to TO_DO (rather than completing their dependencies) keeps 'Fix login
-- redirect bug' genuinely overdue-and-incomplete for the overdue-detection
-- demo below.
INSERT INTO tasks (project_id, milestone_id, title, description, priority, status, start_date, due_date, estimated_hours, progress, completed_at, created_by) VALUES
((SELECT id FROM projects WHERE project_code = 'PRJ-1001'), (SELECT id FROM milestones WHERE title = 'Launch Ready'),              'Finalize homepage design',        'Lock the hero, nav, and footer treatments',        'HIGH',   'IN_PROGRESS', '2026-09-01', '2026-09-12', 16, 70, NULL,                      (SELECT id FROM users WHERE username = 'nikky.sharma')),
((SELECT id FROM projects WHERE project_code = 'PRJ-1001'), (SELECT id FROM milestones WHERE title = 'Launch Ready'),              'Write onboarding copy',           'Copy for the first-run welcome flow',              'LOW',    'TO_DO',        '2026-09-16', '2026-09-20', 6,  0,  NULL,                      (SELECT id FROM users WHERE username = 'nikky.sharma')),
((SELECT id FROM projects WHERE project_code = 'PRJ-1001'), NULL,                                                                  'Design empty states',             'Empty/error states for key list views',            'MEDIUM', 'TO_DO',        '2026-09-14', '2026-09-18', 8,  0,  NULL,                      (SELECT id FROM users WHERE username = 'owen.blake')),

((SELECT id FROM projects WHERE project_code = 'PRJ-1002'), (SELECT id FROM milestones WHERE title = 'MVP Feature Freeze'),        'QA pass on checkout flow',        'Full regression pass on checkout',                 'HIGH',   'TO_DO',        '2026-09-05', '2026-09-11', 12, 0,  NULL,                      (SELECT id FROM users WHERE username = 'ben.carter')),
((SELECT id FROM projects WHERE project_code = 'PRJ-1002'), (SELECT id FROM milestones WHERE title = 'MVP Feature Freeze'),        'Fix login redirect bug',          'Users land on the wrong screen after SSO login',   'HIGH',   'IN_PROGRESS',  '2026-09-02', '2026-09-10', 4,  50, NULL,                      (SELECT id FROM users WHERE username = 'owen.blake')),
((SELECT id FROM projects WHERE project_code = 'PRJ-1002'), (SELECT id FROM milestones WHERE title = 'Beta Release'),              'Set up push notifications',       'Wire up push for order status updates',            'MEDIUM', 'TO_DO',        '2026-09-20', '2026-10-01', 10, 0,  NULL,                      (SELECT id FROM users WHERE username = 'ben.carter')),

((SELECT id FROM projects WHERE project_code = 'PRJ-1003'), (SELECT id FROM milestones WHERE title = 'Data Migration Complete'),   'Migrate user table schema',       'Backfill and cut over the users table',            'URGENT', 'TO_DO',        '2026-09-01', '2026-09-15', 20, 0,  NULL,                      (SELECT id FROM users WHERE username = 'ravi.patel')),
((SELECT id FROM projects WHERE project_code = 'PRJ-1003'), (SELECT id FROM milestones WHERE title = 'Data Migration Complete'),   'Review API documentation',        'Bring API docs in line with the v2 contract',      'MEDIUM', 'TO_DO',        '2026-09-10', '2026-09-13', 5,  0,  NULL,                      (SELECT id FROM users WHERE username = 'ravi.patel')),
((SELECT id FROM projects WHERE project_code = 'PRJ-1003'), NULL,                                                                  'Set up CI pipeline',              'Automated build/test pipeline for the new service','MEDIUM', 'COMPLETED',    '2026-08-01', '2026-08-20', 8,  100, '2026-08-19 16:00:00+00', (SELECT id FROM users WHERE username = 'leo.nguyen')),

((SELECT id FROM projects WHERE project_code = 'PRJ-1004'), (SELECT id FROM milestones WHERE title = 'Library v1 Shipped'),        'Publish component storybook',     'Public Storybook instance for the design system',  'MEDIUM', 'COMPLETED',    '2026-06-01', '2026-06-25', 14, 100, '2026-06-24 10:00:00+00', (SELECT id FROM users WHERE username = 'maya.chen')),
((SELECT id FROM projects WHERE project_code = 'PRJ-1004'), (SELECT id FROM milestones WHERE title = 'Component Audit'),           'Audit legacy button variants',    'Catalogue every button style in production',       'LOW',    'COMPLETED',    '2026-03-18', '2026-03-25', 6,  100, '2026-03-24 09:00:00+00', (SELECT id FROM users WHERE username = 'maya.chen')),

((SELECT id FROM projects WHERE project_code = 'PRJ-1005'), (SELECT id FROM milestones WHERE title = 'Requirements Sign-off'),     'Draft Q3 roadmap',                'First pass at the Q3 ops roadmap',                 'LOW',    'TO_DO',        '2026-09-18', '2026-09-25', 4,  0,  NULL,                      (SELECT id FROM users WHERE username = 'nikky.sharma')),
((SELECT id FROM projects WHERE project_code = 'PRJ-1005'), NULL,                                                                  'Explore competitor dashboards',   'Survey how similar tools present ops data',        'LOW',    'TO_DO',        '2026-09-15', '2026-09-22', 6,  0,  NULL,                      (SELECT id FROM users WHERE username = 'nikky.sharma')),

((SELECT id FROM projects WHERE project_code = 'PRJ-1006'), (SELECT id FROM milestones WHERE title = 'Integration Spike'),         'Evaluate ticketing vendors',      'Score vendors against integration requirements',   'MEDIUM', 'IN_REVIEW',    '2026-09-01', '2026-09-14', 10, 65, NULL,                      (SELECT id FROM users WHERE username = 'ana.torres')),
((SELECT id FROM projects WHERE project_code = 'PRJ-1006'), NULL,                                                                  'Prepare project presentation',    'Status update deck for stakeholders',              'LOW',    'TO_DO',        '2026-09-12', '2026-09-19', 3,  0,  NULL,                      (SELECT id FROM users WHERE username = 'ana.torres'));

-- ==================== task_assignees ====================

INSERT INTO task_assignees (task_id, user_id) VALUES
((SELECT id FROM tasks WHERE title = 'Finalize homepage design'),      (SELECT id FROM users WHERE username = 'maya.chen')),
((SELECT id FROM tasks WHERE title = 'Write onboarding copy'),         (SELECT id FROM users WHERE username = 'chloe.kim')),
((SELECT id FROM tasks WHERE title = 'Design empty states'),           (SELECT id FROM users WHERE username = 'maya.chen')),
((SELECT id FROM tasks WHERE title = 'Design empty states'),           (SELECT id FROM users WHERE username = 'chloe.kim')),
((SELECT id FROM tasks WHERE title = 'QA pass on checkout flow'),      (SELECT id FROM users WHERE username = 'sofia.ruiz')),
((SELECT id FROM tasks WHERE title = 'Fix login redirect bug'),        (SELECT id FROM users WHERE username = 'chloe.kim')),
((SELECT id FROM tasks WHERE title = 'Set up push notifications'),     (SELECT id FROM users WHERE username = 'owen.blake')),
((SELECT id FROM tasks WHERE title = 'Migrate user table schema'),     (SELECT id FROM users WHERE username = 'ravi.patel')),
((SELECT id FROM tasks WHERE title = 'Migrate user table schema'),     (SELECT id FROM users WHERE username = 'daniel.osei')),
((SELECT id FROM tasks WHERE title = 'Review API documentation'),      (SELECT id FROM users WHERE username = 'ravi.patel')),
((SELECT id FROM tasks WHERE title = 'Set up CI pipeline'),            (SELECT id FROM users WHERE username = 'leo.nguyen')),
((SELECT id FROM tasks WHERE title = 'Publish component storybook'),   (SELECT id FROM users WHERE username = 'maya.chen')),
((SELECT id FROM tasks WHERE title = 'Audit legacy button variants'),  (SELECT id FROM users WHERE username = 'maya.chen')),
((SELECT id FROM tasks WHERE title = 'Draft Q3 roadmap'),              (SELECT id FROM users WHERE username = 'nikky.sharma')),
((SELECT id FROM tasks WHERE title = 'Explore competitor dashboards'), (SELECT id FROM users WHERE username = 'chloe.kim')),
-- Reassigned from frank.lee (SUSPENDED) to sofia.ruiz (an active PRJ-1006
-- team lead) — a suspended user must not receive an active task assignment.
-- frank.lee stays a PRJ-1006 project_member so the SUSPENDED account-status
-- case is still demonstrated, just without a live assignment.
((SELECT id FROM tasks WHERE title = 'Evaluate ticketing vendors'),    (SELECT id FROM users WHERE username = 'sofia.ruiz')),
((SELECT id FROM tasks WHERE title = 'Prepare project presentation'),  (SELECT id FROM users WHERE username = 'sofia.ruiz'));

-- ==================== task_dependencies ====================
-- "Task A can't start until Task B (depends_on) is COMPLETED"

INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES
((SELECT id FROM tasks WHERE title = 'QA pass on checkout flow'),     (SELECT id FROM tasks WHERE title = 'Fix login redirect bug')),
((SELECT id FROM tasks WHERE title = 'Set up push notifications'),    (SELECT id FROM tasks WHERE title = 'Fix login redirect bug')),
((SELECT id FROM tasks WHERE title = 'Migrate user table schema'),    (SELECT id FROM tasks WHERE title = 'Review API documentation')),
((SELECT id FROM tasks WHERE title = 'Publish component storybook'),  (SELECT id FROM tasks WHERE title = 'Audit legacy button variants')),
((SELECT id FROM tasks WHERE title = 'Prepare project presentation'), (SELECT id FROM tasks WHERE title = 'Evaluate ticketing vendors'));

-- ==================== subtasks ====================

INSERT INTO subtasks (task_id, title, assignee_id, due_date, status) VALUES
((SELECT id FROM tasks WHERE title = 'Finalize homepage design'),  'Export hero section assets', (SELECT id FROM users WHERE username = 'maya.chen'),    '2026-09-08', 'COMPLETED'),
((SELECT id FROM tasks WHERE title = 'Finalize homepage design'),  'Get stakeholder sign-off',    (SELECT id FROM users WHERE username = 'nikky.sharma'), '2026-09-11', 'IN_PROGRESS'),
((SELECT id FROM tasks WHERE title = 'QA pass on checkout flow'),  'Test on iOS Safari',          (SELECT id FROM users WHERE username = 'sofia.ruiz'),   '2026-09-09', 'COMPLETED'),
((SELECT id FROM tasks WHERE title = 'QA pass on checkout flow'),  'Test on Android Chrome',      (SELECT id FROM users WHERE username = 'sofia.ruiz'),   '2026-09-10', 'IN_PROGRESS'),
((SELECT id FROM tasks WHERE title = 'Migrate user table schema'), 'Write rollback script',       (SELECT id FROM users WHERE username = 'ravi.patel'),   '2026-09-14', 'TO_DO');

-- ==================== checklist_items ====================

INSERT INTO checklist_items (task_id, content, is_completed, sort_order) VALUES
((SELECT id FROM tasks WHERE title = 'Finalize homepage design'), 'Confirm color palette',           true,  1),
((SELECT id FROM tasks WHERE title = 'Finalize homepage design'), 'Confirm typography',               true,  2),
((SELECT id FROM tasks WHERE title = 'Finalize homepage design'), 'Get dev handoff notes ready',       false, 3),
((SELECT id FROM tasks WHERE title = 'Fix login redirect bug'),   'Reproduce on staging',              true,  1),
((SELECT id FROM tasks WHERE title = 'Fix login redirect bug'),   'Write regression test',             false, 2),
((SELECT id FROM tasks WHERE title = 'Set up CI pipeline'),       'Add build cache',                   true,  1);

-- ==================== comments ====================
-- Root comments first, then replies in a second insert — a reply's
-- parent_comment_id subquery needs the parent row to already be committed.

INSERT INTO comments (task_id, user_id, message) VALUES
((SELECT id FROM tasks WHERE title = 'Finalize homepage design'),   (SELECT id FROM users WHERE username = 'owen.blake'),  'Looks great, just double check mobile breakpoints.'),
((SELECT id FROM tasks WHERE title = 'Fix login redirect bug'),     (SELECT id FROM users WHERE username = 'ben.carter'),  'Can we get a fix for this today? It''s blocking QA.'),
((SELECT id FROM tasks WHERE title = 'Migrate user table schema'),  (SELECT id FROM users WHERE username = 'daniel.osei'), 'Backfill script ran clean on staging.'),
((SELECT id FROM tasks WHERE title = 'Evaluate ticketing vendors'), (SELECT id FROM users WHERE username = 'ana.torres'),  'Let''s shortlist the top 2 vendors by Friday.'),
((SELECT id FROM tasks WHERE title = 'QA pass on checkout flow'),   (SELECT id FROM users WHERE username = 'sofia.ruiz'),  'Found an edge case with promo codes, filing a bug.');

INSERT INTO comments (task_id, user_id, parent_comment_id, message) VALUES
((SELECT id FROM tasks WHERE title = 'Finalize homepage design'), (SELECT id FROM users WHERE username = 'maya.chen'),  (SELECT id FROM comments WHERE message = 'Looks great, just double check mobile breakpoints.'), 'Good catch, updating now.'),
((SELECT id FROM tasks WHERE title = 'Fix login redirect bug'),   (SELECT id FROM users WHERE username = 'owen.blake'), (SELECT id FROM comments WHERE message = 'Can we get a fix for this today? It''s blocking QA.'),  'On it, pushing a fix within the hour.');

-- ==================== attachments ====================
-- file_url is a relative storage path (this app's own upload storage), not
-- an external link.

INSERT INTO attachments (project_id, task_id, uploaded_by, file_name, file_url, file_size, mime_type) VALUES
((SELECT id FROM projects WHERE project_code = 'PRJ-1001'), NULL, (SELECT id FROM users WHERE username = 'nikky.sharma'), 'brand-guidelines.pdf',        '/uploads/projects/website-redesign/brand-guidelines.pdf',              2456000, 'application/pdf'),
((SELECT id FROM projects WHERE project_code = 'PRJ-1003'), NULL, (SELECT id FROM users WHERE username = 'ravi.patel'),   'api-v2-contract.docx',         '/uploads/projects/backend-system-migration/api-v2-contract.docx',      184000,  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
(NULL, (SELECT id FROM tasks WHERE title = 'Finalize homepage design'),   (SELECT id FROM users WHERE username = 'maya.chen'),  'homepage-mockup-v3.fig',        '/uploads/tasks/finalize-homepage-design/homepage-mockup-v3.fig',       5210000, 'application/octet-stream'),
(NULL, (SELECT id FROM tasks WHERE title = 'Fix login redirect bug'),     (SELECT id FROM users WHERE username = 'owen.blake'), 'redirect-bug-screenshot.png',   '/uploads/tasks/fix-login-redirect-bug/redirect-bug-screenshot.png',    340000,  'image/png'),
(NULL, (SELECT id FROM tasks WHERE title = 'Evaluate ticketing vendors'), (SELECT id FROM users WHERE username = 'ana.torres'), 'vendor-comparison-matrix.xlsx', '/uploads/tasks/evaluate-ticketing-vendors/vendor-comparison-matrix.xlsx', 98000, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

-- ==================== work_logs ====================

INSERT INTO work_logs (task_id, user_id, work_date, hours_worked, description) VALUES
((SELECT id FROM tasks WHERE title = 'Finalize homepage design'),  (SELECT id FROM users WHERE username = 'maya.chen'),   '2026-09-01', 4.5, 'Hero section layout exploration'),
((SELECT id FROM tasks WHERE title = 'Finalize homepage design'),  (SELECT id FROM users WHERE username = 'maya.chen'),   '2026-09-02', 3.0, 'Applied feedback from design review'),
((SELECT id FROM tasks WHERE title = 'Fix login redirect bug'),    (SELECT id FROM users WHERE username = 'owen.blake'),  '2026-09-02', 2.0, 'Reproduced bug locally'),
((SELECT id FROM tasks WHERE title = 'Migrate user table schema'), (SELECT id FROM users WHERE username = 'ravi.patel'),  '2026-09-01', 6.0, 'Wrote migration script'),
((SELECT id FROM tasks WHERE title = 'Migrate user table schema'), (SELECT id FROM users WHERE username = 'daniel.osei'), '2026-09-02', 5.0, 'Ran backfill on staging'),
((SELECT id FROM tasks WHERE title = 'Set up CI pipeline'),        (SELECT id FROM users WHERE username = 'leo.nguyen'),  '2026-08-18', 4.0, 'Configured build pipeline');

-- ==================== notifications ====================

INSERT INTO notifications (user_id, type, title, message, project_id, task_id, is_read) VALUES
((SELECT id FROM users WHERE username = 'maya.chen'),   'TASK_ASSIGNED',       'New task assigned',          'You were assigned "Finalize homepage design"',        NULL, (SELECT id FROM tasks WHERE title = 'Finalize homepage design'),  true),
((SELECT id FROM users WHERE username = 'chloe.kim'),   'TASK_ASSIGNED',       'New task assigned',          'You were assigned "Write onboarding copy"',            NULL, (SELECT id FROM tasks WHERE title = 'Write onboarding copy'),     false),
((SELECT id FROM users WHERE username = 'owen.blake'),  'TASK_STATUS_CHANGED', 'Task blocked',               '"QA pass on checkout flow" was reopened to To Do — its dependency "Fix login redirect bug" isn''t complete yet', NULL, (SELECT id FROM tasks WHERE title = 'QA pass on checkout flow'),  false),
((SELECT id FROM users WHERE username = 'nikky.sharma'),'DEADLINE_REMINDER',   'Task due tomorrow',          '"Finalize homepage design" is due tomorrow',           NULL, (SELECT id FROM tasks WHERE title = 'Finalize homepage design'),  false),
((SELECT id FROM users WHERE username = 'ana.torres'),  'PROJECT_UPDATED',     'Project status changed',     '"Customer Support Portal" timeline was extended',      (SELECT id FROM projects WHERE project_code = 'PRJ-1006'), NULL, true),
((SELECT id FROM users WHERE username = 'owen.blake'),  'COMMENT_ADDED',       'New comment on your task',   'Ben Carter commented on "Fix login redirect bug"',     NULL, (SELECT id FROM tasks WHERE title = 'Fix login redirect bug'),    false);

-- ==================== activity_logs ====================

INSERT INTO activity_logs (user_id, action, project_id, task_id, description) VALUES
((SELECT id FROM users WHERE username = 'nikky.sharma'), 'PROJECT_CREATED',      (SELECT id FROM projects WHERE project_code = 'PRJ-1001'), NULL, 'Created project "Website Redesign"'),
((SELECT id FROM users WHERE username = 'ana.torres'),   'PROJECT_CREATED',      (SELECT id FROM projects WHERE project_code = 'PRJ-1002'), NULL, 'Created project "Mobile Application"'),
((SELECT id FROM users WHERE username = 'nikky.sharma'), 'TASK_CREATED',         (SELECT id FROM projects WHERE project_code = 'PRJ-1001'), (SELECT id FROM tasks WHERE title = 'Finalize homepage design'), 'Created task "Finalize homepage design"'),
((SELECT id FROM users WHERE username = 'nikky.sharma'), 'TASK_ASSIGNED',        (SELECT id FROM projects WHERE project_code = 'PRJ-1001'), (SELECT id FROM tasks WHERE title = 'Finalize homepage design'), 'Assigned "Finalize homepage design" to Maya Chen'),
((SELECT id FROM users WHERE username = 'owen.blake'),   'TASK_STATUS_CHANGED',  (SELECT id FROM projects WHERE project_code = 'PRJ-1002'), (SELECT id FROM tasks WHERE title = 'Fix login redirect bug'), 'Changed status to In Progress'),
((SELECT id FROM users WHERE username = 'leo.nguyen'),   'TASK_COMPLETED',       (SELECT id FROM projects WHERE project_code = 'PRJ-1003'), (SELECT id FROM tasks WHERE title = 'Set up CI pipeline'), 'Marked "Set up CI pipeline" as Completed'),
((SELECT id FROM users WHERE username = 'maya.chen'),    'MILESTONE_COMPLETED',  (SELECT id FROM projects WHERE project_code = 'PRJ-1004'), NULL, 'Completed milestone "Library v1 Shipped"'),
((SELECT id FROM users WHERE username = 'ben.carter'),   'COMMENT_ADDED',        (SELECT id FROM projects WHERE project_code = 'PRJ-1002'), (SELECT id FROM tasks WHERE title = 'Fix login redirect bug'), 'Commented on "Fix login redirect bug"');

-- ==================== overdue notifications ====================
-- As of the seed data's "today" (2026-09-12), 'Fix login redirect bug'
-- (due 2026-09-10) and 'QA pass on checkout flow' (due 2026-09-11) are both
-- overdue and not completed. Generate their OVERDUE_TASK notifications here
-- rather than hand-inserting them, so this stays correct if task dates or
-- assignees above ever change.
SELECT fn_generate_overdue_notifications();
