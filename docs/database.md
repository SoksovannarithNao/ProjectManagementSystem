# Database

PostgreSQL schema as it actually exists. **Sources read:** `database/init/01-init.sql` (what Docker and CI execute), `02-seed.sql`, `03-app-role.sh`, `database/verify_invariants.sql`, and the Flyway migrations `database/taskmanager/migrations/V1…V8`. Operational notes and design rationale that already existed are in [database/README.md](../database/README.md); this page is the structural reference.

- **22 tables**, 5 views, and 23 triggers: 7 `updated_at` triggers plus 16 rule/derivation triggers (see [section 5](#5-triggers-and-functions)).
- **15 tables** have JPA entities and repositories; **7 do not** (`permissions`, `role_permissions`, `checklist_items`, `attachments`, `work_logs`, `report_exports`, `kpi_snapshots`). Hibernate runs with `ddl-auto=validate`.
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
        varchar status "TO_DO|IN_PROGRESS|IN_REVIEW|COMPLETED|CANCELLED"
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
| `roles.name` (seed, not a CHECK) | `USER`, `ADMINISTRATOR` | — |
| `projects.priority` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | `MEDIUM` |
| `projects.status` | `PLANNING`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CANCELLED` | `PLANNING` |
| `project_members.project_role` | `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` | `MEMBER` |
| `project_members.status` | `PENDING`, `ACTIVE`, `DECLINED` | `ACTIVE` |
| `milestones.status` | `PENDING`, `IN_PROGRESS`, `COMPLETED` | `PENDING` |
| `tasks.priority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` | `MEDIUM` |
| `tasks.status` | `TO_DO`, `IN_PROGRESS`, `IN_REVIEW`, `COMPLETED`, `CANCELLED` | `TO_DO` |
| `subtasks.status` | `TO_DO`, `IN_PROGRESS`, `COMPLETED` | `TO_DO` |
| `otp_verifications.purpose` | `REGISTRATION` | `REGISTRATION` |
| `notifications.type` | `TASK_ASSIGNED`, `TASK_STATUS_CHANGED`, `COMMENT_ADDED`, `PROJECT_UPDATED`, `DEADLINE_REMINDER`, `OVERDUE_TASK`, `MILESTONE_UPDATED`, `TEAM_INVITATION`, `TEAM_INVITATION_RESPONDED` | — |
| `activity_logs.action` | `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_COMPLETED`, `TASK_CREATED`, `TASK_DELETED`, `TASK_ASSIGNED`, `TASK_UNASSIGNED`, `TASK_STATUS_CHANGED`, `TASK_PRIORITY_CHANGED`, `TASK_DUE_DATE_CHANGED`, `TASK_COMPLETED`, `SUBTASK_ADDED`, `SUBTASK_COMPLETED`, `SUBTASK_DELETED`, `COMMENT_ADDED`, `FILE_UPLOADED`, `MILESTONE_CREATED`, `MILESTONE_COMPLETED` | — |
| `report_exports.report_type` | `PROJECT_REPORT`, `TASK_REPORT`, `PROJECT_STATUS_REPORT`, `TASK_COMPLETION_REPORT`, `OVERDUE_TASK_REPORT`, `TEAM_PERFORMANCE_REPORT`, `WORKLOAD_REPORT` | — |
| `report_exports.file_format` | `PDF`, `EXCEL` | — |

Progress columns (`projects`, `milestones`, `tasks`) are `NUMERIC(5,2)` constrained to 0–100.

## 3. Tables

Legend: **PK** primary key · **FK** foreign key (with `ON DELETE`) · **UQ** unique · **NN** not null · *implemented* = has a JPA entity.

### 3.1 Identity and access

**`roles`** *(implemented)* — system roles. `id` PK; `name` varchar(50) NN **UQ**; `description` varchar(255); `created_at`. Seed: `USER`, `ADMINISTRATOR`.

**`permissions`** — action catalog. `id` PK; `code` varchar(30) NN **UQ**; `description`. Seed: `VIEW`, `CREATE`, `EDIT`, `DELETE`, `ASSIGN`, `APPROVE`, `GENERATE_REPORTS`. **Not read by any code.**

**`role_permissions`** — `(role_id, permission_id)` composite PK; both FK `CASCADE`; index on `permission_id`. Seed: every permission for `ADMINISTRATOR` only. **Not read by any code.**

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

**`projects`** *(implemented)* — `id` PK; `project_code` varchar(30) NN **UQ** (constraint `projects_project_code_key`); `name` varchar(200) NN; `description` text; `start_date`, `end_date` date NN; `manager_id` NN FK → `users` `RESTRICT`; `priority`, `status` (see §2); `progress` NUMERIC(5,2) NN default 0; `created_at`, `updated_at`. `CHECK (end_date >= start_date)`. Indexes: `manager_id`, `status`.

**`project_members`** *(implemented)* — `id` PK; `project_id` NN FK → `projects` `CASCADE`; `user_id` NN FK → `users` `CASCADE`; `project_role`, `status` (§2); `invited_by` FK → `users` `SET NULL`; `responded_at`; `joined_at` NN default `now()`. **`UNIQUE (project_id, user_id)`**. Indexes: `project_id`, `user_id`, `status`. Trigger `trg_project_members_owner_integrity`.

**`milestones`** *(implemented)* — `id` PK; `project_id` NN FK → `projects` `CASCADE`; `title` varchar(200) NN; `description` text; `due_date` NN; `status`, `progress`; `created_at`, `updated_at`. Index on `project_id`.

### 3.3 Tasks

**`tasks`** *(implemented)* — `id` PK; `project_id` NN FK → `projects` `CASCADE`; `milestone_id` FK → `milestones` `SET NULL`; `title` varchar(200) NN; `description` text; `priority`, `status`; `start_date`, `due_date` date **NN**; `estimated_hours` NUMERIC(6,2); `progress` NN default 0; `completed_at` timestamptz; `created_by` FK → `users` `SET NULL`; `created_at`, `updated_at`. `CHECK (due_date >= start_date)`. Indexes: `project_id`, `milestone_id`, `created_by`, `status`, `due_date`.

**`task_assignees`** *(implemented)* — `id` PK; `task_id` NN FK `CASCADE`; `user_id` NN FK `CASCADE`; `assigned_at` NN. **`UNIQUE (task_id, user_id)`**. Indexes on both FKs.

**`task_dependencies`** *(implemented; composite key class `TaskDependencyId`)* — PK `(task_id, depends_on_task_id)`; both FK → `tasks` `CASCADE`; `CHECK (task_id <> depends_on_task_id)`. Index on `depends_on_task_id`.

**`subtasks`** *(implemented)* — `id` PK; `task_id` NN FK `CASCADE`; `title` varchar(200) NN; `assignee_id` FK → `users` `SET NULL`; `due_date`; `status`; `created_at`, `updated_at`. Indexes: `task_id`, `assignee_id`.

**`checklist_items`** — `id` PK; `task_id` NN FK `CASCADE`; `content` varchar(300) NN; `is_completed` boolean NN default false; `sort_order` int NN default 0; `created_at`, `updated_at`. Index on `task_id`. **No entity/API/UI.**

**`comments`** *(implemented)* — `id` PK; `task_id` NN FK `CASCADE`; `user_id` NN FK `CASCADE`; `parent_comment_id` FK → `comments` `CASCADE`; `message` text NN; `created_at`, `updated_at`. Indexes: `task_id`, `user_id`, `parent_comment_id`.

**`attachments`** — `id` PK; `project_id` FK `CASCADE`; `task_id` FK `CASCADE`; `uploaded_by` FK → `users` `SET NULL`; `file_name` varchar(255) NN; `file_url` varchar(500) NN; `file_size` bigint; `mime_type` varchar(100); `uploaded_at` NN. `CHECK (num_nonnulls(project_id, task_id) = 1)` — attached to exactly one of project or task. Indexes on both FKs. **No entity/API/UI.**

**`work_logs`** — `id` PK; `task_id` NN FK `CASCADE`; `user_id` NN FK `CASCADE`; `work_date` date NN; `hours_worked` NUMERIC(5,2) NN `CHECK (> 0)`; `description` varchar(500); `created_at`. Indexes: `task_id`, `user_id`, `work_date`. **No entity/API/UI.**

### 3.4 Notifications, history, reporting

**`notifications`** *(implemented)* — `id` PK; `user_id` NN FK → `users` `CASCADE`; `type` NN (§2); `title` varchar(200) NN; `message` varchar(500); `project_id` FK `CASCADE`; `task_id` FK `CASCADE`; `is_read` boolean NN default false; `created_at`. Indexes: `user_id`, `(user_id, is_read)`.

**`activity_logs`** *(implemented)* — `id` PK; `user_id` FK → `users` `SET NULL`; `action` NN (§2); `project_id` FK → `projects` `CASCADE`; `task_id` FK → `tasks` **`SET NULL`** (deliberately, so a `TASK_DELETED` row survives); `description` varchar(500); `created_at`. Indexes: `user_id`, `project_id`, `task_id`, `created_at DESC`.

**`report_exports`** — `id` PK; `report_type` NN, `generated_by` FK `SET NULL`, `filters` jsonb, `file_format` NN, `file_url`, `generated_at`. Indexes: `generated_by`, `report_type`. **Nothing writes to it.**

**`kpi_snapshots`** — `id` PK; `snapshot_date` date NN; `project_id` FK `CASCADE` (NULL = org-wide); `project_completion_rate`, `task_completion_rate`, `overdue_rate`, `on_time_completion_rate` NUMERIC(5,2); `average_task_completion_time` NUMERIC(10,2); `created_at`. `UNIQUE (snapshot_date, project_id)` — in PostgreSQL NULLs are distinct, so this does **not** prevent two org-wide snapshots on the same day. Indexes: `project_id`, `snapshot_date`. **Nothing writes to it.**

## 4. Views

| View | Definition (summary) | Used by the app? |
|---|---|---|
| `v_overdue_tasks` | tasks with `due_date < CURRENT_DATE` and status not `COMPLETED`/`CANCELLED` | Only by `fn_generate_overdue_notifications()`; the backend computes `overdue` itself in `TaskResponse` |
| `v_project_status_summary` | per project status: `project_count`, `delayed_count` (past `end_date`, not finished) | No |
| `v_task_completion_by_project` | per project: total and completed tasks, `completion_percentage = projects.progress` | No |
| `v_team_performance` | per user: assigned, completed, pending, overdue tasks, completion rate | No |
| `v_team_workload` | per user: assigned/active/overdue tasks, estimated hours, actual (logged) hours | No |

The four reporting views exist for the not-yet-built reports; the Reports page computes its charts in the browser from `/api/tasks` data.

## 5. Triggers and functions

All validation triggers raise with `ERRCODE '23514'` so they surface as `DataIntegrityViolationException` → a clean `400` (see [security.md](security.md#6-error-handling)). Function names omit the `check_`/`trg_fn_` prefix noise where obvious.

| Trigger | Table / event | Rule |
|---|---|---|
| `trg_users_updated_at`, `trg_projects_updated_at`, `trg_milestones_updated_at`, `trg_tasks_updated_at`, `trg_subtasks_updated_at`, `trg_checklist_items_updated_at`, `trg_comments_updated_at` | BEFORE UPDATE | set `updated_at = now()` |
| `trg_project_members_owner_integrity` | `project_members` BEFORE UPDATE/DELETE | a project must keep at least one **active owner** |
| `trg_milestones_due_date_within_project` | `milestones` BEFORE INSERT/UPDATE | due date within the project's start–end dates |
| `trg_tasks_completed_at` | `tasks` BEFORE INSERT/UPDATE | stamp `completed_at` on `COMPLETED`, clear otherwise |
| `trg_tasks_due_date_within_project` | `tasks` BEFORE INSERT/UPDATE | `due_date ≤ project.end_date` |
| `trg_tasks_milestone_project_match` | `tasks` BEFORE INSERT/UPDATE | milestone belongs to the task's project |
| `trg_tasks_dependencies_status_gate` | `tasks` BEFORE INSERT/UPDATE | no `IN_PROGRESS`/`IN_REVIEW`/`COMPLETED` while a dependency is incomplete |
| `trg_task_dependencies_status_gate` | `task_dependencies` BEFORE INSERT/UPDATE | cannot add an incomplete prerequisite to an already-active task |
| `trg_task_dependencies_no_cycle` | `task_dependencies` BEFORE INSERT/UPDATE | no dependency cycles (recursive CTE) |
| `trg_task_assignees_project_member` | `task_assignees` BEFORE INSERT/UPDATE | assignee is an `ACTIVE` member of the task's project |
| `trg_task_assignees_not_suspended` | `task_assignees` BEFORE INSERT/UPDATE | assignee's `account_status` is `ACTIVE` |
| `trg_tasks_not_completed_with_open_subtasks` | `tasks` BEFORE UPDATE | cannot **enter** `COMPLETED` with an incomplete subtask |
| `trg_tasks_progress_derived_from_subtasks` | `tasks` BEFORE UPDATE | task `progress` follows subtask completion (when it has subtasks) |
| `trg_subtasks_sync_parent_task` | `subtasks` AFTER INSERT/UPDATE/DELETE | push subtask-derived progress to the parent task |
| `trg_tasks_progress_sync` | `tasks` AFTER INSERT/UPDATE/DELETE | recompute the project's and milestone's progress |
| `trg_projects_progress_derived`, `trg_milestones_progress_derived` | BEFORE UPDATE | overwrite `progress` with the computed value on every update |

Functions that are not triggers: `fn_compute_project_progress(bigint)`, `fn_compute_milestone_progress(bigint)`, `fn_compute_task_progress_from_subtasks(bigint)`, `fn_generate_overdue_notifications()` (returns the number of rows inserted). Rules that exist **only in application code** (no trigger): subtask assignee eligibility (`SubtaskService`), invitation eligibility (`ProjectMemberService`), and the "assignees may change only status/progress" restriction (`TaskService`). **Not checked anywhere:** that a comment's parent belongs to the same task, and that a task dependency joins two tasks of the same project.

Progress formulas: project and milestone = `round(100 × completed ÷ non-cancelled tasks, 2)` (0 when none); task = `round(100 × completed subtasks ÷ subtasks, 2)` (left unchanged when there are no subtasks).

## 6. Seed data (`02-seed.sql`)

Loaded once, after `01-init.sql`, into an empty volume: 13 positions, 7 departments, **24 users** (1 administrator `admin.system`; 23 with no global role; one `INACTIVE`, one `SUSPENDED`, one project-less `newuser`), **10 projects** `PRJ-2001`…`PRJ-2010`, their memberships and roles, a few `PENDING`/`DECLINED` invitations, tasks, assignments, subtasks, comments, notifications and activity logs. Every seeded user's password is `DevPassword123!`.

## 7. Least-privilege application role

`03-app-role.sh` creates `taskmanager_app` (password from `TASKMANAGER_APP_PASSWORD`) with `SELECT/INSERT/UPDATE/DELETE` on the **15** tables that have entities (`roles`, `users`, `projects`, `project_members`, `milestones`, `tasks`, `task_assignees`, `task_dependencies`, `notifications`, `otp_verifications`, `positions`, `departments`, `subtasks`, `comments`, `activity_logs`), `USAGE, SELECT` on all sequences, and `EXECUTE` on three functions. **The backend connects as this role, not as `postgres`.** The other 7 tables are not granted — adding an entity for one of them requires adding a `GRANT` line here (and in the CI duplicate). Views are not granted either (the backend does not query them).

## 8. Migrations vs. the init script

`database/init/01-init.sql` is what actually creates the schema (Docker and CI). `database/taskmanager/migrations/` is a Flyway project (`flyway.toml`, locations `filesystem:migrations`, `validateMigrationNaming`, `outOfOrder = true`) kept as a parallel historical record — **the application does not run Flyway** (`flyway-core` is not a dependency).

| Migration | Content |
|---|---|
| `V1__initial_schema.sql` | baseline schema |
| `V2__add_permissions_progress_and_integrity_rules.sql` | permissions tables, derived progress, dependency/assignment/milestone triggers, overdue view/function, reporting views, `report_exports`, `kpi_snapshots` |
| `V3__add_registration_otp_and_preferences.sql` | `PENDING_VERIFICATION`, `otp_verifications`, theme/notification preferences |
| `V4__add_team_invitations_positions_departments_subtasks_comments.sql` | positions/departments, invitation columns on `project_members`, new notification types |
| `V5__project_scoped_authorization.sql` | `users.role_id` nullable; project roles become `OWNER/ADMIN/MEMBER/VIEWER`; old global roles removed |
| `V6__store_profile_photo_in_database.sql` | photo bytes + token instead of a URL |
| `V7__add_default_global_user_role.sql` | adds the `USER` role |
| `V8__enforce_project_owner_integrity.sql` | `trg_project_members_owner_integrity` |

**Drift (verified):** the migrations V1–V8 do **not** contain the task/subtask consistency objects that `01-init.sql` has — `check_task_not_completed_with_open_subtasks`, `trg_tasks_not_completed_with_open_subtasks`, `fn_compute_task_progress_from_subtasks`, `trg_subtasks_sync_parent_task`, `trg_tasks_progress_derived_from_subtasks`. A database built from the migrations would lack those rules. `database/README.md` states that the two routes produce identical schemas; that was true when written but is no longer. See [issues.md](issues.md).

## 9. Invariant checks

`database/verify_invariants.sql` is a set of read-only queries that must each return **zero rows**: tasks missing dates, active tasks with incomplete dependencies, assignees who are not project members, assignees who are not `ACTIVE`, tasks linked to another project's milestone, stale project progress, stale milestone progress. CI runs it after loading the schema and seed and fails the build on any output.

## 10. Notes and inconsistencies found

- Several comments inside `01-init.sql` are out of date: the `permissions` section still says "on top of the 4 fixed roles", and the `task_dependencies` section says ordering is "enforced in application business logic, not here" although triggers do enforce it.
- CI runs `postgres:16`; Docker Compose runs `postgres:18-alpine`.
- `docker-compose.yml` mounts the data volume at `/var/lib/postgresql` (the PostgreSQL 18 image layout).
- `users.email` and `users.username` uniqueness is enforced only by the unique **indexes**; there is no table-level `UNIQUE` constraint, so a violation's constraint name is `idx_users_username_lower` / `idx_users_email_lower`.
