# Database

PostgreSQL schema as it actually exists. **Sources read:** `database/init/01-init.sql` (what Docker and CI execute), `02-seed.sql`, `03-app-role.sh`, `database/verify_invariants.sql`, and the Flyway migrations `database/taskmanager/migrations/V1…V14`. This page is both the structural reference (sections 1-10) and the operational guide that used to live in `database/README.md` (sections 11-14: running and inspecting, design decisions, authorization, backend coverage; migration details are in section 8). The folder README was removed.

- **26 tables**, 5 views, and 29 triggers: 7 `updated_at` triggers plus 22 rule/derivation triggers (see [section 5](#5-triggers-and-functions)).
- **24 of the 26 tables** have JPA entities and repositories; **2 do not** (`report_exports`, `kpi_snapshots`). `permissions` and `role_permissions` are read by the backend since migration `V9`. Hibernate runs with `ddl-auto=validate`.
- Conventions: `BIGINT GENERATED ALWAYS AS IDENTITY` primary keys; timestamps are `TIMESTAMPTZ`; enum-like columns are `VARCHAR` + `CHECK` (not native enums).

## 1. Entity-relationship diagram

Generated from the foreign keys in `01-init.sql`. Attributes shown are the keys and the most important columns; complete column lists are in [section 3](#3-tables).

```mermaid
erDiagram
    roles ||--o{ users : "role_id (RESTRICT, nullable)"
    roles ||--o{ role_permissions : "CASCADE"
    permissions ||--o{ role_permissions : "CASCADE"
    positions |o--o{ users : "position_id (SET NULL)"
    departments |o--o{ users : "department_id (SET NULL)"
    users ||--o{ otp_verifications : "CASCADE"
    users ||--o{ projects : "manager_id (RESTRICT)"
    projects ||--o{ project_members : "CASCADE"
    users ||--o{ project_members : "user_id (CASCADE)"
    users |o--o{ project_members : "invited_by (SET NULL)"
    projects ||--o{ milestones : "CASCADE"
    projects ||--o{ tasks : "CASCADE"
    milestones |o--o{ tasks : "milestone_id (SET NULL)"
    users |o--o{ tasks : "created_by (SET NULL)"
    users |o--o{ tasks : "approver_id (SET NULL)"
    tasks ||--o{ task_approvals : "CASCADE"
    users |o--o{ task_approvals : "requested_by / decided_by (SET NULL)"
    tasks ||--o{ task_assignees : "CASCADE"
    users ||--o{ task_assignees : "CASCADE"
    tasks ||--o{ task_dependencies : "task_id (CASCADE)"
    tasks ||--o{ task_dependencies : "depends_on_task_id (CASCADE)"
    tasks ||--o{ subtasks : "CASCADE"
    users |o--o{ subtasks : "assignee_id (SET NULL)"
    tasks ||--o{ checklist_items : "CASCADE"
    tasks ||--o{ comments : "CASCADE"
    users ||--o{ comments : "CASCADE"
    comments |o--o{ comments : "parent_comment_id (CASCADE)"
    projects |o--o{ attachments : "CASCADE"
    tasks |o--o{ attachments : "CASCADE"
    users |o--o{ attachments : "uploaded_by (SET NULL)"
    tasks ||--o{ work_logs : "CASCADE"
    users ||--o{ work_logs : "CASCADE"
    users ||--o{ notifications : "CASCADE"
    projects |o--o{ notifications : "CASCADE"
    tasks |o--o{ notifications : "CASCADE"
    users |o--o{ activity_logs : "user_id (SET NULL)"
    projects |o--o{ activity_logs : "CASCADE"
    tasks |o--o{ activity_logs : "task_id (SET NULL)"
    users |o--o{ report_exports : "generated_by (SET NULL)"
    projects |o--o{ kpi_snapshots : "CASCADE"

    users {
        bigint id PK
        varchar username "unique, case-insensitive"
        varchar email "unique, case-insensitive"
        varchar account_status "ACTIVE|INACTIVE|SUSPENDED|PENDING_VERIFICATION"
        bigint role_id FK "nullable"
    }
    projects {
        bigint id PK
        varchar project_code "unique"
        bigint manager_id FK
        varchar status "PLANNING|IN_PROGRESS|ON_HOLD|COMPLETED|CANCELLED"
        numeric progress "derived"
    }
    project_members {
        bigint id PK
        bigint project_id FK
        bigint user_id FK
        varchar project_role "OWNER|ADMIN|MEMBER|VIEWER"
        varchar status "PENDING|ACTIVE|DECLINED"
    }
    tasks {
        bigint id PK
        bigint project_id FK
        bigint milestone_id FK "nullable"
        varchar status "TODO|IN_PROGRESS|IN_REVIEW|COMPLETED|CANCELLED"
        date start_date
        date due_date
    }
    task_assignees {
        bigint id PK
        bigint task_id FK
        bigint user_id FK
    }
    task_dependencies {
        bigint task_id PK
        bigint depends_on_task_id PK
    }
```

Reading notes: `||` = exactly one, `|o` = zero or one (nullable FK), `o{` = many. The label after the relationship is the FK column and its `ON DELETE` action (a bare `CASCADE` means the child's FK column is named after the parent).

### Relationship description (text form)

- A **user** optionally has one **role**, one **position**, one **department**. A user may *manage* many **projects** (`projects.manager_id`, `RESTRICT`: a user who is still a project's manager cannot be deleted).
- A **project** has many **project_members** (one row per user, unique), **milestones**, **tasks**, and optionally **attachments**, **notifications**, **activity_logs**, **kpi_snapshots**.
- A **task** belongs to exactly one project and optionally one milestone; it has many **task_assignees**, **subtasks**, **checklist_items**, **comments**, **work_logs**, and takes part in **task_dependencies** on either side.
- **Comments** form a tree through `parent_comment_id`.
- **Notifications** and **activity_logs** reference users, projects and tasks; deleting a task keeps its `activity_logs` rows (`task_id` becomes NULL) but deletes its `notifications`.

## 2. Status and enumeration fields

All enforced by `CHECK` constraints in `01-init.sql` (and mirrored by `@Pattern` on request DTOs).

| Table.column | Allowed values | Default |
|---|---|---|
| `users.account_status` | `ACTIVE`, `INACTIVE`, `SUSPENDED`, `PENDING_VERIFICATION` | `ACTIVE` |
| `users.theme_preference` | `LIGHT`, `DARK`, `SYSTEM` | `SYSTEM` |
| `roles.name` (seed, not a CHECK) | system: `ADMINISTRATOR`, `PROJECT_MANAGER`, `USER`; project: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` | — |
| `roles.scope` | `SYSTEM`, `PROJECT` (`BOTH` is allowed by the CHECK but no role uses it since `V10`) | `SYSTEM` |
| `role_permissions.scope` | `SYSTEM`, `PROJECT` | — |
| `projects.priority` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | `MEDIUM` |
| `projects.status` | `PLANNING`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CANCELLED` | `PLANNING` |
| `project_members.project_role` | `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` | `MEMBER` |
| `project_members.status` | `PENDING`, `ACTIVE`, `DECLINED` | `ACTIVE` |
| `milestones.status` | `PENDING`, `IN_PROGRESS`, `COMPLETED` | `PENDING` |
| `tasks.priority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` | `MEDIUM` |
| `tasks.status` | `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `COMPLETED`, `CANCELLED` | `TODO` |
| `subtasks.status` | `TODO`, `IN_PROGRESS`, `COMPLETED` | `TODO` |
| `otp_verifications.purpose` | `REGISTRATION` | `REGISTRATION` |
| `notifications.type` | `TASK_ASSIGNED`, `TASK_STATUS_CHANGED`, `COMMENT_ADDED`, `PROJECT_UPDATED`, `DEADLINE_REMINDER`, `OVERDUE_TASK`, `MILESTONE_UPDATED`, `TEAM_INVITATION`, `TEAM_INVITATION_RESPONDED`, `APPROVAL_REQUESTED`, `APPROVAL_DECIDED`, `MENTION` | — |
| `activity_logs.action` | `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_COMPLETED`, `TASK_CREATED`, `TASK_DELETED`, `TASK_ASSIGNED`, `TASK_UNASSIGNED`, `TASK_STATUS_CHANGED`, `TASK_PRIORITY_CHANGED`, `TASK_DUE_DATE_CHANGED`, `TASK_COMPLETED`, `SUBTASK_ADDED`, `SUBTASK_COMPLETED`, `SUBTASK_DELETED`, `COMMENT_ADDED`, `FILE_UPLOADED`, `MILESTONE_CREATED`, `MILESTONE_COMPLETED`, `TASK_APPROVAL_REQUESTED`, `TASK_APPROVED`, `TASK_CHANGES_REQUESTED`, `TASK_REJECTED`, `TASK_APPROVER_SET`, `WORK_LOGGED`, `WORK_LOG_UPDATED`, `WORK_LOG_DELETED` (the last three since `V19`) | — |
| `report_exports.report_type` | `PROJECT_REPORT`, `TASK_REPORT`, `PROJECT_STATUS_REPORT`, `TASK_COMPLETION_REPORT`, `OVERDUE_TASK_REPORT`, `TEAM_PERFORMANCE_REPORT`, `WORKLOAD_REPORT` | — |
| `report_exports.file_format` | `PDF`, `EXCEL` | — |

Progress columns (`projects`, `milestones`, `tasks`) are `NUMERIC(5,2)` constrained to 0–100.

## 3. Tables

Legend: **PK** primary key · **FK** foreign key (with `ON DELETE`) · **UQ** unique · **NN** not null · *implemented* = has a JPA entity.

### 3.1 Identity and access

**`roles`** *(implemented)* — two levels of role ([ADR-0015](adr/0015-two-level-roles-system-and-project.md)). `id` PK; `name` varchar(50) NN **UQ**; `description` varchar(255); `scope` varchar(10) NN (`SYSTEM`/`PROJECT`); `project_role` varchar(20) nullable **UQ** (set only on the project roles: the `project_members.project_role` value the row stands for); `built_in` boolean NN (built-in roles cannot be renamed or deleted); `created_at`. Seed: system roles `ADMINISTRATOR`, `PROJECT_MANAGER`, `USER`; project roles `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`. Business names: Project Manager = `PROJECT_MANAGER` system role and normally `OWNER`; Team Leader = `ADMIN`; Team Member = `MEMBER`.

**`permissions`** — action catalog. `id` PK; `code` varchar(30) NN **UQ**; `description`. Seed: `VIEW`, `CREATE`, `EDIT`, `DELETE`, `ASSIGN`, `APPROVE`, `GENERATE_REPORTS` *(implemented — read-only)*.

**`role_permissions`** *(implemented)* — the permission matrix. Composite PK `(role_id, permission_id, resource, scope)`; `role_id`, `permission_id` FK `CASCADE`; `resource` varchar(30) NN (`PROJECT`, `MILESTONE`, `MEMBER`, `ATTACHMENT`, `CHECKLIST_ITEM`, `TASK`, `TASK_STATUS`, `SUBTASK`, `COMMENT`, `WORK_LOG`, `REPORT`, `USER`, `ROLE`, `LOOKUP`); `scope` varchar(10) NN CHECK `SYSTEM`/`PROJECT`; index on `permission_id`. Seed: **198 rows** — Administrator 98 (every action on all 14 resources), Project Manager 2 (`PROJECT:CREATE`, `REPORT:GENERATE_REPORTS`), Owner 37, Admin 35, Member 17, Viewer 9, User 0 (163 before the `ATTACHMENT` and `CHECKLIST_ITEM` resources arrived in `V13`). The matrix is listed in [authentication-authorization.md](authentication-authorization.md#52-project-scope-matrix); the SQL is `V10` / `01-init.sql`.

**`positions`**, **`departments`** *(implemented)* — org-wide lookup lists. `id` PK; `name` varchar(100) NN; `description` varchar(255); `created_at`. Unique index on `LOWER(name)`.

**`users`** *(implemented)*

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `full_name` | varchar(150) | NN |
| `username` | varchar(50) | NN; unique **index on `LOWER(username)`** |
| `email` | varchar(255) | NN; unique **index on `LOWER(email)`** |
| `password_hash` | varchar(255) | NN (BCrypt) |
| `gender` varchar(20), `date_of_birth` date, `phone_number` varchar(30) | | optional |
| `profile_photo` | bytea | optional image bytes |
| `profile_photo_content_type` | varchar(50) | optional |
| `profile_photo_token` | uuid | optional; partial unique index (`WHERE … IS NOT NULL`) |
| `position_id` | bigint | FK → `positions` `SET NULL` |
| `department_id` | bigint | FK → `departments` `SET NULL` |
| `role_id` | bigint | FK → `roles` `RESTRICT`, **nullable** |
| `account_status` | varchar(20) | NN, CHECK, default `ACTIVE` |
| `theme_preference` | varchar(10) | NN, CHECK, default `SYSTEM` |
| `task_notifications_enabled` | boolean | NN, default `true` |
| `created_at`, `updated_at` | timestamptz | NN, default `now()`; `updated_at` by trigger |

Indexes: `idx_users_username_lower`, `idx_users_email_lower` (unique), `idx_users_role_id`, `idx_users_position_id`, `idx_users_department_id`, `idx_users_profile_photo_token`.

**`otp_verifications`** *(implemented)* — registration codes. `id` PK; `user_id` NN FK → `users` `CASCADE`; `purpose` NN (`REGISTRATION`); `otp_hash` varchar(255) NN (BCrypt); `expires_at` NN; `attempts` int NN default 0; `max_attempts` int NN default 5; `consumed_at`; `last_sent_at` NN default `now()`; `created_at`. `CHECK (attempts <= max_attempts)`. Index on `user_id`.

### 3.2 Projects and teams

**`projects`** *(implemented)* — `id` PK; `project_code` varchar(30) NN **UQ** (constraint `projects_project_code_key`); `name` varchar(200) NN; `description` text; `start_date`, `end_date` date NN; `manager_id` NN FK → `users` `RESTRICT`; `priority`, `status` (see §2); `progress` NUMERIC(5,2) NN default 0; `completed_at` timestamptz (V14: when the project became `COMPLETED`, set and cleared by `trg_projects_completed_at`, never written by the application); `lead_id` FK → `users` `SET NULL` (V15: a Team Leader named beside the Owner, D-09; must be an active Team Leader of the project, kept by `trg_projects_lead_is_team_leader` and `trg_project_members_clear_lead`); `created_at`, `updated_at`. `CHECK (end_date >= start_date)`. Indexes: `manager_id`, `lead_id`, `status`.

**`project_members`** *(implemented)* — `id` PK; `project_id` NN FK → `projects` `CASCADE`; `user_id` NN FK → `users` `CASCADE`; `project_role`, `status` (§2); `invited_by` FK → `users` `SET NULL`; `responded_at`; `joined_at` NN default `now()`. **`UNIQUE (project_id, user_id)`**. Indexes: `project_id`, `user_id`, `status`. Constraint trigger `trg_project_members_single_owner`.

**`milestones`** *(implemented)* — `id` PK; `project_id` NN FK → `projects` `CASCADE`; `title` varchar(200) NN; `description` text; `due_date` NN; `status`, `progress`; `created_at`, `updated_at`. Index on `project_id`.

### 3.3 Tasks

**`tasks`** *(implemented)* — `id` PK; `project_id` NN FK → `projects` `CASCADE`; `milestone_id` FK → `milestones` `SET NULL`; `title` varchar(200) NN; `description` text; `priority`, `status`; `start_date`, `due_date` date **NN**; `estimated_hours` NUMERIC(6,2); `progress` NN default 0; `completed_at` timestamptz; `created_by` FK → `users` `SET NULL`; `approver_id` FK → `users` `SET NULL` (the approver named for this task, optional, V12); `created_at`, `updated_at`. `CHECK (due_date >= start_date)`. Indexes: `project_id`, `milestone_id`, `created_by`, `approver_id`, `status`, `due_date`.

**`task_approvals`** *(implemented, V12)* — one row per review request. `id` PK; `task_id` NN FK → `tasks` `CASCADE`; `requested_by` FK → `users` `SET NULL`; `requested_at` NN; `decided_by` FK → `users` `SET NULL`; `decided_at`; `decision` NN default `PENDING` (`PENDING`, `APPROVED`, `CHANGES_REQUESTED`, `REJECTED`, `WITHDRAWN`); `comment` varchar(1000). `CHECK`: `decided_at` is null exactly while the decision is `PENDING`. Indexes: `task_id`, `decision`, and a **partial unique index** `(task_id) WHERE decision = 'PENDING'` (one open request per task).

**`task_assignees`** *(implemented)* — `id` PK; `task_id` NN FK `CASCADE`; `user_id` NN FK `CASCADE`; `assigned_at` NN. **`UNIQUE (task_id, user_id)`**. Indexes on both FKs.

**`task_dependencies`** *(implemented; composite key class `TaskDependencyId`)* — PK `(task_id, depends_on_task_id)`; both FK → `tasks` `CASCADE`; `CHECK (task_id <> depends_on_task_id)`. Index on `depends_on_task_id`.

**`subtasks`** *(implemented)* — `id` PK; `task_id` NN FK `CASCADE`; `title` varchar(200) NN; `assignee_id` FK → `users` `SET NULL`; `due_date`; `status`; `created_at`, `updated_at`. Indexes: `task_id`, `assignee_id`.

**`checklist_items`** — `id` PK; `task_id` NN FK `CASCADE`; `content` varchar(300) NN; `is_completed` boolean NN default false; `sort_order` int NN default 0; `created_by` FK → `users` `SET NULL` (V13: who added it, so an author may delete their own); `created_at`, `updated_at`. Indexes on `task_id`, `created_by`. Trigger `trg_checklist_items_sync_parent_task` keeps the task's progress current (V13). *(implemented)*

**`comments`** *(implemented)* — `id` PK; `task_id` NN FK `CASCADE`; `user_id` NN FK `CASCADE`; `parent_comment_id` FK → `comments` `CASCADE`; `message` text NN; `created_at`, `updated_at`. Indexes: `task_id`, `user_id`, `parent_comment_id`.

**`attachments`** — `id` PK; `project_id` FK `CASCADE`; `task_id` FK `CASCADE`; `uploaded_by` FK → `users` `SET NULL`; `file_name` varchar(255) NN; `file_url` varchar(500) *(unused since V13, optional)*; `file_size` bigint; `mime_type` varchar(100); `uploaded_at` NN. `CHECK (num_nonnulls(project_id, task_id) = 1)` — attached to exactly one of project or task. Indexes on both FKs. *(implemented)*

**`attachment_contents`** *(implemented, V13)* — the bytes of an attachment, kept apart from the metadata so listing never reads them. `attachment_id` PK and FK → `attachments` `CASCADE`; `data` bytea NN. Stored in the database like profile photos, so `pg_dump` carries the files.

**`work_logs`** *(implemented 2026-10-08)* — `id` PK; `task_id` NN FK `CASCADE`; `user_id` NN FK `CASCADE`; `work_date` date NN; `hours_worked` NUMERIC(5,2) NN `CHECK (> 0)`; `description` varchar(500); `created_at`. Indexes: `task_id`, `user_id`, `work_date`. Entity `WorkLog`, API `/api/work-logs`, UI in the task panel (an entry is changed in place by its author; logging, changing and deleting are written to `activity_logs`, `V19`); a task's `actualHours` is the sum of its logs ([tasks.md](tasks.md#time-tracking-estimated-vs-actual)).

### 3.4 Notifications, history, reporting

**`notifications`** *(implemented)* — `id` PK; `user_id` NN FK → `users` `CASCADE`; `type` NN (§2); `title` varchar(200) NN; `message` varchar(500); `project_id` FK `CASCADE`; `task_id` FK `CASCADE`; `is_read` boolean NN default false; `created_at`. Indexes: `user_id`, `(user_id, is_read)`.

**`activity_logs`** *(implemented)* — `id` PK; `user_id` FK → `users` `SET NULL`; `action` NN (§2); `project_id` FK → `projects` `CASCADE`; `task_id` FK → `tasks` **`SET NULL`** (deliberately, so a `TASK_DELETED` row survives); `description` varchar(500); `created_at`. Indexes: `user_id`, `project_id`, `task_id`, `created_at DESC`.

**`audit_logs`** *(implemented, V16)* — the administrator audit log, separate from `activity_logs` (the project members' feed). `id` PK; `actor_id` bigint and `actor_name` varchar(150) NN (the person who did it, `System` when nobody was signed in); `action` NN (`USER_ROLE_CHANGED`, `PERMISSIONS_CHANGED`, `PROJECT_ROLE_CHANGED`, `OWNERSHIP_TRANSFERRED`, `ACCOUNT_CREATED`, `ACCOUNT_STATUS_CHANGED`, `ACCOUNT_DELETED`, `PROJECT_DELETED`, `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_DELETED`); `target_type` NN (`USER` / `ROLE` / `PROJECT`), `target_id` bigint, `target_label` varchar(255); `project_id` bigint (so a project's Owner can read its ownership entries); `before_value` and `after_value` text; `created_at`. **No foreign keys**: an entry must outlive the user, role or project it describes. **Append-only:** `trg_audit_logs_append_only` refuses every `UPDATE` and `DELETE` (even for the table owner), and the application role holds `SELECT` and `INSERT` only. Indexes: `created_at DESC`, `action`, and `project_id` where set.

**`refresh_tokens`** *(implemented, V20)* — what keeps a person signed in: `id` PK; `user_id` NN FK `users` `CASCADE`; `token_hash` char(64) NN unique (the SHA-256 of the random token in the httpOnly cookie, so the token itself is never stored); `created_at`; `expires_at` NN. Indexes: `user_id`, `expires_at`. A row is deleted on sign-out, on a changed or reset password and with the account; expired rows are cleared at each sign-in. Entity `RefreshToken`, service `RefreshTokenService`.

**`report_exports`** — `id` PK; `report_type` NN, `generated_by` FK `SET NULL`, `filters` jsonb, `file_format` NN, `file_url`, `generated_at`. Indexes: `generated_by`, `report_type`. **Nothing writes to it.**

**`kpi_snapshots`** — `id` PK; `snapshot_date` date NN; `project_id` FK `CASCADE` (NULL = org-wide); `project_completion_rate`, `task_completion_rate`, `overdue_rate`, `on_time_completion_rate` NUMERIC(5,2); `average_task_completion_time` NUMERIC(10,2); `created_at`. `UNIQUE (snapshot_date, project_id)` — in PostgreSQL NULLs are distinct, so this does **not** prevent two org-wide snapshots on the same day. Indexes: `project_id`, `snapshot_date`. **Nothing writes to it.**

## 4. Views

| View | Definition (summary) | Used by the app? |
|---|---|---|
| `v_overdue_tasks` | tasks with `due_date < CURRENT_DATE` and status not `COMPLETED`/`CANCELLED` | By `fn_generate_overdue_notifications()` (the seed script only); the backend computes `overdue` itself in `TaskResponse` |
| `v_project_status_summary` | per project status: `project_count`, `delayed_count` (past `end_date`, not finished) | No |
| `v_task_completion_by_project` | per project: total and completed tasks, `completion_percentage = projects.progress` | No |
| `v_team_performance` | per user: assigned, completed, pending, overdue tasks, completion rate | No |
| `v_team_workload` | per user: assigned/active/overdue tasks, estimated hours, actual (logged) hours | No |

None of the views is read by the backend. The KPIs and the seven reports are calculated live in Java by `ReportService` (`GET /api/reports/*`), and the Reports Overview charts are computed in the browser from `/api/tasks` data, except the Workload chart, which reads `GET /api/workload` (or `/api/projects/{id}/workload` for a chosen project); the four reporting views remain available for ad-hoc SQL.

## 5. Triggers and functions

All validation triggers raise with `ERRCODE '23514'` so they surface as `DataIntegrityViolationException` → a clean `400` (see [security.md](security.md#6-error-handling)). Function names omit the `check_`/`trg_fn_` prefix noise where obvious.

| Trigger | Table / event | Rule |
|---|---|---|
| `trg_users_updated_at`, `trg_projects_updated_at`, `trg_milestones_updated_at`, `trg_tasks_updated_at`, `trg_subtasks_updated_at`, `trg_checklist_items_updated_at`, `trg_comments_updated_at` | BEFORE UPDATE | set `updated_at = now()` |
| `trg_project_members_single_owner` | `project_members` AFTER INSERT/UPDATE/DELETE, **deferred to commit** | a project has **exactly one active owner**; skipped when the project itself is being deleted (replaced V8's `trg_project_members_owner_integrity`, which blocked deleting a single-owner project) |
| `trg_milestones_due_date_within_project` | `milestones` BEFORE INSERT/UPDATE | due date within the project's start–end dates |
| `trg_tasks_completed_at` | `tasks` BEFORE INSERT/UPDATE | stamp `completed_at` on `COMPLETED`, clear otherwise |
| `trg_tasks_due_date_within_project` | `tasks` BEFORE INSERT/UPDATE | `due_date ≤ project.end_date` |
| `trg_tasks_milestone_project_match` | `tasks` BEFORE INSERT/UPDATE | milestone belongs to the task's project |
| `trg_tasks_dependencies_status_gate` | `tasks` BEFORE INSERT/UPDATE | no `IN_PROGRESS`/`IN_REVIEW`/`COMPLETED` while a dependency is incomplete |
| `trg_tasks_prerequisite_not_reopened` | `tasks` BEFORE UPDATE OF `status` | a task cannot leave `COMPLETED` while a task that depends on it is `IN_PROGRESS`, `IN_REVIEW` or `COMPLETED` (V17); the other direction of the gate above |
| `trg_task_dependencies_status_gate` | `task_dependencies` BEFORE INSERT/UPDATE | cannot add an incomplete prerequisite to an already-active task |
| `trg_task_dependencies_no_cycle` | `task_dependencies` BEFORE INSERT/UPDATE | no dependency cycles (recursive CTE) |
| `trg_task_assignees_project_member` | `task_assignees` BEFORE INSERT/UPDATE | assignee is an `ACTIVE` member of the task's project |
| `trg_task_assignees_not_suspended` | `task_assignees` BEFORE INSERT/UPDATE | assignee's `account_status` is `ACTIVE` |
| `trg_tasks_not_completed_with_open_subtasks` | `tasks` BEFORE UPDATE | cannot **enter** `COMPLETED` with an incomplete subtask |
| `trg_tasks_progress_derived_from_subtasks` | `tasks` BEFORE UPDATE | task `progress` follows its subtasks and checklist items; with neither, a task entering `COMPLETED` is 100 and one leaving it is 0 (V17) |
| `trg_subtasks_sync_parent_task` | `subtasks` AFTER INSERT/UPDATE/DELETE | push subtask-derived progress to the parent task |
| `trg_checklist_items_sync_parent_task` | `checklist_items` AFTER INSERT/UPDATE/DELETE | the same for checklist items, which count toward task progress together with subtasks (V13) |
| `trg_projects_completed_at` | `projects` BEFORE INSERT/UPDATE | stamp `completed_at` when the status becomes `COMPLETED` (an existing date is kept), clear it for any other status (V14) |
| `trg_projects_lead_is_team_leader` | `projects` BEFORE INSERT/UPDATE OF `lead_id` | the lead must be an `ACTIVE` member of the project with project role `ADMIN` (Team Leader) (V15) |
| `trg_project_members_clear_lead` | `project_members` AFTER UPDATE OF `project_role`/`status` or DELETE | clear `projects.lead_id` when that member stops being an active Team Leader of the project (V15) |
| `trg_audit_logs_append_only` | `audit_logs` BEFORE UPDATE/DELETE | refuse every change to or removal of an audit entry (V16) |
| `trg_tasks_progress_sync` | `tasks` AFTER INSERT/UPDATE/DELETE | recompute the project's and milestone's progress |
| `trg_projects_progress_derived`, `trg_milestones_progress_derived` | BEFORE UPDATE | overwrite `progress` with the computed value on every update |

Functions that are not triggers: `fn_compute_project_progress(bigint)`, `fn_compute_milestone_progress(bigint)`, `fn_compute_task_progress_from_subtasks(bigint)`, `fn_generate_overdue_notifications()` (returns the number of rows inserted; only the seed script calls it — the application's overdue notices come from `DeadlineNotificationService`). Rules that exist **only in application code** (no trigger): subtask assignee eligibility (`SubtaskService`), invitation eligibility (`ProjectMemberService`), and the "assignees may change only status/progress" restriction (`TaskService`). **Not checked by the database:** that a comment's parent belongs to the same task (`CommentService` checks it, `400`), and that a task dependency joins two tasks of the same project (checked nowhere).

Progress formulas: project and milestone = `round(100 × completed ÷ non-cancelled tasks, 2)` (0 when none); task = `round(100 × completed subtasks ÷ subtasks, 2)` (left unchanged when there are no subtasks).

## 6. Seed data (`02-seed.sql`)

Loaded once, after `01-init.sql`, into an empty volume. **Rebuilt on 2026-10-13** as a coherent demo dataset instead of random fixtures: 13 positions, 7 departments, **24 users** (the same accounts as before; every account has a system role: 1 Administrator `admin.system`, 3 Project Managers (the project owners), 20 Users; one `INACTIVE`, one `SUSPENDED`, one project-less `newuser`) and **10 projects** `PRJ-2001`…`PRJ-2010` at different stages, with the same teams and roles. Under them: **98 hand-written tasks** (37 to do, 16 in progress, 6 in review, 37 completed, 2 cancelled), **31 milestones**, **27 dependencies** (15 tasks blocked), 73 subtasks, 37 checklist items, 51 comments (23 of them replies), 358 time entries, 47 approval records (6 open requests, 4 that sent work back for changes), 6 small files, a **project lead** on every project that has a Team Leader, 693 activity entries, 118 notifications (the file's own; the backend's start-up deadline job can add more) and 10 administrator audit entries. Everything is dated relative to the day the file runs (`CURRENT_DATE`), so there is always work overdue (9 open tasks, one project delayed by 6 days), due today and due this week, and one project is on hold, one planning for the future and one completed. The data respects every rule the triggers enforce (no running task on an unfinished prerequisite, completed tasks at 100% with a completion date and only completed subtasks, a lead who is an active Team Leader), so the whole file loads without a trigger objecting. No extra custom system role is seeded: an administrator creates those. Every seeded user's password is `DevPassword123!`.

## 7. Least-privilege application role

`03-app-role.sh` creates `taskmanager_app` (password from `TASKMANAGER_APP_PASSWORD`) with `SELECT/INSERT/UPDATE/DELETE` on the **22** tables that have read-write entities (`roles`, `role_permissions`, `users`, `projects`, `project_members`, `milestones`, `tasks`, `task_assignees`, `task_dependencies`, `notifications`, `otp_verifications`, `positions`, `departments`, `subtasks`, `comments`, `activity_logs`, `work_logs`, `task_approvals`, `attachments`, `attachment_contents`, `checklist_items`, `refresh_tokens`), `SELECT` only on `permissions`, `SELECT, INSERT` only on `audit_logs` (append-only, V16), `USAGE, SELECT` on all sequences, and `EXECUTE` on three functions. **The backend connects as this role, not as `postgres`.** The other 2 tables (`report_exports`, `kpi_snapshots`) are not granted — adding an entity for one of them requires adding a `GRANT` line here (CI runs this script, so there is no second list). **On an existing database the script does not re-run**, so apply the new grant once by hand (`GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO taskmanager_app;`); forgetting it gives `permission denied for table …` and a `500` on any endpoint that reads the table (this happened with `work_logs`).

`.github/workflows/ci.yml` does not keep a copy of this list any more: since 2026-10-14 its backend job runs `03-app-role.sh` itself, so CI tests with the role the application uses. `database/verify_grants.sql` (run by CI right after the role is created, and by hand with `psql -t -A -d taskmanager -f database/verify_grants.sql`) prints every table the application role cannot read; it must print nothing. Three tables are on its list of tables that deliberately have no entity (`flyway_schema_history`, `kpi_snapshots`, `report_exports`), so leaving a table without a grant is a decision, not an oversight. `V12`, `V13` and `V16` grant their new tables themselves (the script only runs on a new volume). Views are not granted (the backend does not query them). On an existing database `V9` itself applies the two new grants (`permissions` read, `role_permissions` read/write).

## 8. Migrations vs. the init script

`database/init/01-init.sql` is what actually creates the schema (Docker and CI). `database/taskmanager/migrations/` is a Flyway project (`flyway.toml`, locations `filesystem:migrations`, `validateMigrationNaming`, `outOfOrder = true`) applied to an existing database by the one-shot `migrate` service in `docker-compose.yml` on every `docker compose up` (a database built from the current init scripts carries its own baseline row, version 20, from `init/04-flyway-baseline.sql`). **The application itself does not run Flyway** (`flyway-core` is not a dependency).

| Migration | Content |
|---|---|
| `V1__initial_schema.sql` | baseline schema |
| `V2__add_permissions_progress_and_integrity_rules.sql` | permissions tables, derived progress, dependency/assignment/milestone triggers, overdue view/function, reporting views, `report_exports`, `kpi_snapshots` |
| `V3__add_registration_otp_and_preferences.sql` | `PENDING_VERIFICATION`, `otp_verifications`, theme/notification preferences |
| `V4__add_team_invitations_positions_departments_subtasks_comments.sql` | positions/departments, invitation columns on `project_members`, new notification types |
| `V5__project_scoped_authorization.sql` | `users.role_id` nullable; project roles become `OWNER/ADMIN/MEMBER/VIEWER`; old global roles removed |
| `V6__store_profile_photo_in_database.sql` | photo bytes + token instead of a URL |
| `V7__add_default_global_user_role.sql` | adds the `USER` role |
| `V8__enforce_project_owner_integrity.sql` | `trg_project_members_owner_integrity` (replaced in `V10`) |
| `V9__requirement_roles_and_permissions.sql` | first version of the role matrix: `roles.scope/project_role/built_in`, `role_permissions.resource/scope`, four requirement roles + `VIEWER` at both levels, backfill, grants to `taskmanager_app` |
| `V10__two_level_roles.sql` | **two-level roles** ([ADR-0015](adr/0015-two-level-roles-system-and-project.md)): adds `USER`, `OWNER`, `ADMIN`, `MEMBER`; retires the `TEAM_LEADER` / `TEAM_MEMBER` system roles (their accounts become `USER`); `PROJECT_MANAGER` becomes system-only; rewrites the matrix (163 rows: a Team Member no longer creates tasks or deletes subtasks, report access moves to the project roles); makes every project have exactly one owner (extra owners → `ADMIN`) and every owner a Project Manager; replaces the V8 trigger with the deferred `trg_project_members_single_owner`. **Idempotent**: the data changes run only while the old model (`TEAM_LEADER`) is present, so a re-run or a database built from the new `01-init.sql` is left alone and edited grants are never wiped |
| `V11__rename_status_to_do_to_todo.sql` | renames the stored task/subtask status `TO_DO` → `TODO` (D-15): drops and re-adds the two `CHECK` constraints, new column defaults, rewrites the rows with the user triggers switched off (no new `updated_at`), re-creates `v_team_workload`; idempotent |
| `V12__task_approval_workflow.sql` | **approval workflow** (B3.8): `tasks.approver_id`; table `task_approvals` with a partial unique index (one open request per task); widens the `activity_logs.action` and `notifications.type` checks; gives each task already `IN_REVIEW` an open request; grants the application role; idempotent |
| `V13__attachments_checklists.sql` | **attachments and checklists** (change-plan 3a): resources `ATTACHMENT` and `CHECKLIST_ITEM` in the `role_permissions` check plus their grants (35 rows; the matrix is now 198); `attachments.file_url` optional; table `attachment_contents`; `checklist_items.created_by`; `fn_compute_task_progress_from_subtasks(task, status)` counts checklist items with subtasks (D-07) and the `checklist_items` sync trigger; grants for the application role; idempotent |
| `V14__project_completed_at.sql` | **project completion date** (checklist #23): `projects.completed_at` and the trigger `trg_projects_completed_at` (stamp on `COMPLETED`, clear otherwise); projects already `COMPLETED` get their last update time, with the user triggers switched off so `updated_at` does not move; idempotent |
| `V15__project_lead.sql` | **project lead** (checklist #18, D-09): `projects.lead_id` (FK `users`, `SET NULL`, indexed), the triggers `trg_projects_lead_is_team_leader` and `trg_project_members_clear_lead`, and `PROJECT_LEAD_CHANGED` in the `activity_logs.action` check; idempotent |
| `V16__audit_log.sql` | **audit log** (checklist #44, B10, D-11): table `audit_logs` (no foreign keys, three indexes), the trigger `trg_audit_logs_append_only`, and `SELECT, INSERT` for the application role; idempotent |
| `V17__task_status_integrity.sql` | **two task rules for every way of changing a status** (found adding Kanban moves, #35): the trigger `trg_tasks_prerequisite_not_reopened`, and the progress rule in `trg_fn_tasks_progress_derived_from_subtasks` (entering `COMPLETED` = 100, leaving it = 0 when nothing derives it), with a backfill; idempotent |
| `V18__mention_notification.sql` | **the `MENTION` notification type** (@mentions, G-14, D-21): `notifications_type_check` is replaced by a list that also allows it, only while it does not already; idempotent |
| `V19__work_log_activity.sql` | **time-log events in the activity feed** (checklist #9, #15): `activity_logs_action_check` is replaced by a list that also allows `WORK_LOGGED`, `WORK_LOG_UPDATED` and `WORK_LOG_DELETED`, only while it does not already; idempotent |
| `V20__refresh_tokens.sql` | **the sign-in refresh token** (risk R-4, D-24): table `refresh_tokens` (`user_id` FK `users` `CASCADE`, `token_hash` `CHAR(64)` unique, `created_at`, `expires_at`; two indexes) and its grant to `taskmanager_app`; idempotent |

**Drift (verified, re-checked 2026-10-12):** no migration from `V1` to `V20` creates the task/subtask consistency objects that `01-init.sql` has — `check_task_not_completed_with_open_subtasks`, `trg_tasks_not_completed_with_open_subtasks`, `trg_subtasks_sync_parent_task` and `trg_tasks_progress_derived_from_subtasks` (`V13` only re-creates the function `fn_compute_task_progress_from_subtasks`, which those triggers call). A database built from the migrations alone would lack those rules; the Compose route is safe because it baselines an existing database at 8 and a fresh one at 14. The old `database/README.md` (since removed) stated that the two routes produce identical schemas; that was true when it was written but is no longer. See [issues.md](issues.md).

### 8.1 Flyway project layout and rules

Managed with **Flyway Desktop** (Redgate) as the project `taskmanager`, in `database/taskmanager/`:

```text
database/taskmanager/
├── flyway.toml              project config (databaseType = "PostgreSql")
├── flyway.user.toml         per-user Development/Shadow connection details: git-ignored, never commit
├── filter.rgf               SQL Compare filter used by Flyway Desktop's diffing
├── schema-model/            schema snapshot Flyway Desktop maintains from the Development connection
└── migrations/              V1 … V20 (table above)
```

- **Source of truth, stated plainly:** `database/init/*.sql` is what creates the schema (Docker Compose through `docker-entrypoint-initdb.d`, and CI, both run `01-init.sql` then `02-seed.sql`). The migrations are a parallel, versioned historical record kept equivalent by hand. Editing `init/01-init.sql` without also adding a matching migration (or the reverse) is how the drift above was introduced.
- **New schema changes are new files** (the next one is `V21__*.sql`), never edits to an already-numbered migration: Flyway checksums each applied file and refuses to re-run one that changed. `V1` was corrected in place once, to fix three triggers that were missing `USING ERRCODE = '23514'`; that was only safe because no `flyway_schema_history` table has ever existed anywhere this project runs, so nothing had consumed `V1`'s checksum. Do not treat it as precedent for a migration that has actually been applied somewhere.
- Flyway Desktop generates new migrations by diffing its **Development** database against its **Shadow** database (a second, disposable Postgres database it can wipe and rebuild). Create one locally with `docker exec -it taskmanager-postgres psql -U postgres -c "CREATE DATABASE taskmanager_shadow;"`.
- `V2` expresses its changes as `ALTER TABLE` / `CREATE` against the `V1` baseline (for example `ALTER TABLE tasks ALTER COLUMN start_date SET NOT NULL`), whereas `01-init.sql` bakes them into each `CREATE TABLE` (`start_date DATE NOT NULL`) because it always runs on an empty database. The routes were intended to give the same result; the drift paragraph above lists where they no longer do.
- Migrations contain schema only. `init/02-seed.sql` is dev-only fake data and deliberately not a migration, because migrations must be safe in every environment. Load it by hand (`psql -f database/init/02-seed.sql`) after migrating if you want the demo rows.
- **Applied by Docker Compose.** The one-shot `migrate` service (`flyway/flyway`, `docker-compose.yml`) runs `migrate -baselineOnMigrate=true -baselineVersion=8` against the database before the backend starts (`depends_on: migrate: service_completed_successfully`). A volume that predates Flyway has no `flyway_schema_history`, so it baselines at 8 and applies `V9` to `V20`. A volume built from the current init scripts already holds the end state, so `init/04-flyway-baseline.sql` writes a **baseline row at version 20** and Flyway applies only what is newer (without it `V9` would re-create the retired roles). When you fold a new migration into `01-init.sql`, raise the version in that file. It connects as the `postgres` superuser (migrations create objects and grants); the backend still connects as `taskmanager_app`. Both paths were tested on throwaway databases before the live upgrade, and `verify_invariants.sql` carries checks for the ownership rule (exactly one owner per project; owners are Project Managers or Administrators) and the approval rule (an open request belongs to a task in review, and every task in review has one).

### 8.2 Running the migrations with the Flyway CLI or Docker

Without Flyway Desktop, the same migrations run through the plain CLI or the Docker image, because `flyway.toml` is standard Flyway configuration:

```powershell
docker run --rm `
  -v "${PWD}\database\taskmanager\migrations:/flyway/sql" `
  -e FLYWAY_URL="jdbc:postgresql://host.docker.internal:5432/taskmanager" `
  -e FLYWAY_USER=postgres `
  -e FLYWAY_PASSWORD=postgres `
  -e FLYWAY_BASELINE_ON_MIGRATE=true `
  -e FLYWAY_BASELINE_VERSION=0 `
  flyway/flyway info
```

`host.docker.internal` reaches the host's published `5432` from inside the Flyway container on Docker Desktop for Windows and macOS. `FLYWAY_BASELINE_ON_MIGRATE` matters because the Compose Postgres already has this schema from `init/01-init.sql`: it tells Flyway to adopt that state as the baseline instead of failing because the tables exist.

## 9. Invariant checks

`database/verify_invariants.sql` is a standalone set of 14 read-only queries that must each return **zero rows** (run it any time with `psql -f database/verify_invariants.sql`, especially after a schema or seed change; CI runs it with `psql -t -A`, which prints nothing when every query is empty): tasks missing dates, active tasks with incomplete dependencies, assignees who are not project members, assignees who are not `ACTIVE`, tasks linked to another project's milestone, stale project progress, stale milestone progress, a project without exactly one active owner, an owner who cannot own projects, a pending approval request on a task that is not in review, a task in review without an open request, and a project whose completion date disagrees with its status. CI runs it after loading the schema and seed and fails the build on any output.

## 10. Notes and inconsistencies found

- Several comments inside `01-init.sql` are out of date: the `permissions` section still says "on top of the 4 fixed roles", and the `task_dependencies` section says ordering is "enforced in application business logic, not here" although triggers do enforce it.
- CI runs `postgres:16`; Docker Compose runs `postgres:18-alpine`.
- `docker-compose.yml` mounts the data volume at `/var/lib/postgresql` (the PostgreSQL 18 image layout).
- `users.email` and `users.username` uniqueness is enforced only by the unique **indexes**; there is no table-level `UNIQUE` constraint, so a violation's constraint name is `idx_users_username_lower` / `idx_users_email_lower`.

## 11. Running, connecting and inspecting

From the repository root:

```bash
cp .env.example .env   # first time only
docker compose up -d
```

This starts a `postgres` container, creates the `taskmanager` database, and runs every `.sql` and `.sh` file in `database/init/` in filename order, **the first time the container's data volume is created**. `01-init.sql` is the schema, `02-seed.sql` loads demo data (24 users, 10 projects and everything under them), `03-app-role.sh` creates the least-privileged role the backend connects as and `04-flyway-baseline.sql` records the Flyway baseline (version 20). CI loads every `.sql` file in the folder into its own throwaway database. Every seeded user shares the password `DevPassword123!`; `contractor.felix` (`INACTIVE`) and `exemployee.diego` (`SUSPENDED`) are seeded to fail login whatever the password, to exercise `account_status` handling.

| | Superuser (admin, migrations) | App role (what the backend uses) |
|---|---|---|
| Host | `localhost` | `localhost` |
| Port | `5432` | `5432` |
| Database | `taskmanager` | `taskmanager` |
| User | `postgres` | `taskmanager_app` |
| Password | `postgres` | `taskmanager_app_password` (development default; set with `TASKMANAGER_APP_PASSWORD`) |

The backend's actual defaults are in `backend/src/main/resources/application.properties` (`SPRING_DATASOURCE_USERNAME` / `PASSWORD`, overridable through the environment; see `.env.example` and `docker-compose.yml`).

**Re-running init scripts after a schema change.** Scripts in `docker-entrypoint-initdb.d` only run against an empty data directory. To pick up a change to `01-init.sql`:

```bash
docker compose down -v   # drops the pgdata volume: local data only, safe in development
docker compose up -d
```

**Inspecting the database:**

```bash
docker exec -it taskmanager-postgres psql -U postgres -d taskmanager
```

## 12. Deliberate design decisions

Choices that were ambiguous or under-specified when the schema was written, recorded so they are not re-litigated:

- **Account status values.** The assignment names "Account Status" but the original summary never listed its values (the specification now fixes them: [assignment-brief.md](../assignment-brief.md) §B1.1). The schema uses `users.account_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION')`. `SUSPENDED` is the established name in this codebase and was kept on purpose. `PENDING_VERIFICATION` arrived with self-registration (`V3`): the state an account sits in until it completes OTP email verification; `login` rejects it like any other non-`ACTIVE` status.
- **Task assignment cardinality.** The requirements say a task "may have one or more assignees depending on the application design". The schema keeps assignment optional: a `tasks` row can exist with zero `task_assignees` rows, the way an unassigned issue exists, and no constraint demands at least one.
- **Username and email are case-insensitive** (`idx_users_username_lower`, `idx_users_email_lower`): login accepts a username, so `Nikky` and `nikky` must not be separate accounts.
- **Progress is derived, not authoritative.** `projects.progress` and `milestones.progress` stay ordinary writable `NUMERIC` columns (the API contract is unchanged) but two triggers keep them from going stale: `trg_tasks_progress_sync` recomputes the project and milestone on every task insert, status change, move or delete, and `trg_projects_progress_derived` / `trg_milestones_progress_derived` overwrite `NEW.progress` on **every** update to those rows, so even a manual `UPDATE` with an arbitrary value is corrected. The formula excludes `CANCELLED` tasks from both counts (cancelled work is not remaining work and should not drag progress down) and gives 0% for no tasks. Side effect: because the task path recomputes through a real `UPDATE` on the parent row, a project's or milestone's `updated_at` moves whenever any of its tasks change. See [ADR 0012](adr/0012-derived-progress.md).
- **Overdue is derived, not a stored status.** `v_overdue_tasks` (`due_date < CURRENT_DATE AND status NOT IN ('COMPLETED','CANCELLED')`) is always current. `fn_generate_overdue_notifications()` inserts one `OVERDUE_TASK` notification per overdue task per current assignee, deduplicated **per calendar day** (so a task overdue for a week produces one notification per assignee per day). The application does not call it: since 2026-10-10 `DeadlineScheduler` / `DeadlineNotificationService` (Spring `@Scheduled`, daily at 08:00 and once at startup) create the overdue notices in Java — once per person and due date, to the assignees *and* the project Owner, honouring the notification preference — and the 3-day / 1-day `DEADLINE_REMINDER` notices. No schema change.
- **Reports are mostly derived live.** The four reporting views cover the Project Status, Task Completion, Team Performance and Workload reports from existing tables. `report_exports` would hold metadata for a generated file, and `kpi_snapshots` would hold point-in-time values of the five KPIs both requirement documents list (`project_completion_rate`, `task_completion_rate`, `overdue_rate`, `average_task_completion_time`, `on_time_completion_rate`) so a trend chart has history. Neither is filled by a trigger; both are meant to be written by whatever job or endpoint eventually generates reports.
- **Validation triggers set `ERRCODE '23514'`.** Without it Postgres defaults to `P0001`, which is not in the SQLSTATE class (`23`) that Hibernate and Spring translate into `DataIntegrityViolationException`; the error fell through as an unclassified `500`. When adding a cross-row check as a trigger, set it on the `RAISE EXCEPTION` too. The progress triggers are the one exception because they never raise.

**Task integrity rules** (all trigger-enforced, listed in section 5): `start_date` and `due_date` are required; a dependent task cannot go active while its prerequisite is incomplete (enforced from both directions, because either write path can create the invalid state; `TODO` and `CANCELLED` are always allowed); a task's milestone must belong to the task's own project; an assignee must be an `ACTIVE` member of the task's project; and a task cannot enter `COMPLETED` while it has an incomplete subtask. That last rule is one-directional: it never reaches back to un-complete an already-`COMPLETED` task if a subtask is reopened, and task `status` otherwise stays manual by design (the only exception, an application-layer promotion from `TODO` to `IN_PROGRESS`, is in [backend.md](backend.md#task--subtask-rules)).

## 13. Authorization and permissions

`permissions` and `role_permissions` hold the authorization rules and **the backend reads them** (since `V9`; role model per [ADR-0015](adr/0015-two-level-roles-system-and-project.md) since `V10`). A grant is a row *(role, permission, resource, scope)*: "this role may do this action on this resource, anywhere in the system (`SYSTEM`) or inside a project where the user holds the role (`PROJECT`)". `PermissionService` loads the table into memory at startup and again after every matrix edit; `ProjectAccessGuard` answers every check through it.

Two kinds of role share the one `roles` table. A **system role** is `users.role_id` (`ADMINISTRATOR`, `PROJECT_MANAGER`, `USER`) and carries only system-scope grants. A **project role** is `project_members.project_role` (`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`), resolved to its role row through `roles.project_role`, and carries the project-scope grants; an `ACTIVE` membership is required. A system role never widens a project role. See [authentication-authorization.md](authentication-authorization.md) for the full matrix and [ADR-0002](adr/0002-project-level-authorization.md) for why project scoping exists.

Because the matrix is data, a new project role or a finer permission is an `INSERT`, not a redeploy; an Administrator can edit grants in the UI (`PUT /api/roles/{id}/permissions`). The Administrator role's grants are not editable, and the code bypass means a bad edit can never lock the Administrator out. There is still no per-user override table (deliberately).

## 14. API / backend coverage

Not every table has a backend entity, repository, service and controller; some are reachable from `psql` but not from the API.

| Table | Backend coverage |
|---|---|
| `notifications` | Full stack |
| `positions`, `departments` | Full stack: org-wide lookup lists, Team-Admin-managed |
| `otp_verifications` | Full stack, but no REST surface of its own: used only by `register`, `verify-otp`, `resend-otp` |
| `subtasks` | Full stack, project-membership scoped |
| `comments` | Full stack: read and create by project members, author-only edit, author-or-manager delete |
| `audit_logs` | Full stack (2026-10-13): append-only administrator log; `GET /api/audit-logs` and `/project/{projectId}`, written by the services that do the audited actions |
| `activity_logs` | Full stack, read-only API (`GET /api/activity-logs/task/{taskId}`, `/project/{projectId}`, `/recent`), written internally by other services |
| `work_logs` | Full stack (added 2026-10-08): list by task, create, delete; feeds `TaskResponse.actualHours` |
| `task_approvals` | Full stack (V12): `TaskApprovalService`, `TaskApprovalController` |
| `checklist_items`, `attachments`, `attachment_contents` | Full stack (V13): `ChecklistItemService`, `AttachmentService` |
| `permissions`, `role_permissions` | Full stack (added 2026-10-08): `GET /api/permissions/matrix`, `PUT /api/roles/{id}/permissions`, `GET /api/users/me/permissions` (section 13) |
| `report_exports`, `kpi_snapshots` | DB-only: nothing writes to them; the reporting views are queryable but have no controller |

`project_members` also gained `status`, `invited_by` and `responded_at` (migration `V4`) for the invitation workflow; a project is the "team", so there is no separate `teams` table. Remaining scope: entities for `report_exports` and `kpi_snapshots`, which only matter if report export or KPI history is built. Prioritised plan: [roadmap.md](roadmap.md).

## Contributing

Branch naming and the pull-request workflow are in [../Contributing.md](../Contributing.md) (database branches use `database/<task>`).
