# Task Management

Tasks, milestones, subtasks, dependencies, assignment, comments and activity history. Code: `TaskService`, `MilestoneService`, `SubtaskService`, `TaskAssigneeService`, `TaskDependencyService`, `CommentService`, `ActivityLogService`; UI: `pages/Tasks.jsx`, `Kanban.jsx`, `Calendar.jsx`, `ProjectDetail.jsx`, `components/TaskFormModal.jsx`, `TaskDetailPanel.jsx`. Database rules are in [database.md](database.md#5-triggers-and-functions).

## 1. Task structure

A task **always belongs to exactly one project** (`tasks.project_id NOT NULL`, `TaskRequest.projectId @NotNull`, the form's Project field is required). This matches `Role_Requirment.md` ("Each task must belong to a project").

| Field | Type / rule | Notes |
|---|---|---|
| `id` | identity | |
| `project` | required | Cannot be omitted. The New Task form only offers projects where the caller is `OWNER`/`ADMIN`/`MEMBER` |
| `milestone` | optional | Must belong to the **same project** (trigger `trg_tasks_milestone_project_match`). The UI forms have no milestone picker; the API accepts `milestoneId` |
| `title` | required, ≤ 200 | |
| `description` | optional text | |
| `priority` | `LOW`, `MEDIUM` (default), `HIGH`, `URGENT` | |
| `status` | `TO_DO` (default), `IN_PROGRESS`, `IN_REVIEW`, `COMPLETED`, `CANCELLED` | |
| `startDate`, `dueDate` | **both required** (`NOT NULL`) | `dueDate ≥ startDate` (CHECK) and `dueDate ≤ project.endDate` (trigger) |
| `estimatedHours` | optional, ≥ 0 (`NUMERIC(6,2)`) | There is no "actual hours" — work logs are not implemented |
| `progress` | 0–100 | Derived when the task has subtasks (see §5); otherwise stored as sent (default 0) |
| `completedAt` | timestamp | **Set automatically** when status becomes `COMPLETED` and cleared when it leaves it (`trg_tasks_completed_at`); any value in a request is overridden |
| `createdBy` | user | Always the caller on create (a client-supplied `createdById` is honoured only for a system administrator) |
| `createdAt`, `updatedAt` | timestamps | database-maintained |

Computed in `TaskResponse` (not stored): `overdue` (due date before today and status not `COMPLETED`/`CANCELLED` — the same definition as view `v_overdue_tasks`), `totalSubtasks`, `completedSubtasks`, `blocked`, `blockingTaskTitles`.

## 2. Status and priority

**Statuses** — `TO_DO` → `IN_PROGRESS` → `IN_REVIEW` → `COMPLETED`; `CANCELLED` as a terminal alternative. The backend does **not** enforce a fixed transition order: any status can be set from any other, subject to the rules in §7 (open subtasks, unfinished dependencies).

How the UI moves a task (`frontend/src/api/tasks.js`):

- **Quick-advance circle** (Tasks page): one click = one step — `TO_DO → IN_PROGRESS`, `IN_PROGRESS`/`IN_REVIEW → COMPLETED`. `COMPLETED` and `CANCELLED` are terminal for this control, so a finished task is never reopened by a stray click. The Tasks page groups `IN_PROGRESS` and `IN_REVIEW` together as **Doing**, and `COMPLETED` as **Done**; clicking while Doing with open subtasks shows the blocking message instead of failing.
- **Status dropdown** (task panel, project page): all five statuses, including reopening and `IN_REVIEW`/`CANCELLED`.
- **Kanban**: columns *To Do*, *In Progress*, *Review*, *Done*, plus a computed *Blocked* column (a `TO_DO` task that is blocked by an unfinished dependency — "Blocked" is never a stored status). Cards open the task panel; **cards cannot be dragged** to change status.

**Priorities** — `LOW`, `MEDIUM`, `HIGH`, `URGENT` (tasks); projects use `CRITICAL` instead of `URGENT`. The Tasks page can sort by priority (Urgent first).

## 3. Assignment

Table `task_assignees` (`UNIQUE (task_id, user_id)`) — many assignees per task are possible at the data and API level; **the UI assigns a single person** (one Assignee dropdown, shown only to `OWNER`/`ADMIN`).

| Rule | Enforced by |
|---|---|
| Only `OWNER`/`ADMIN` of the task's project (or an administrator) may assign/unassign | `TaskAssigneeService` |
| The assignee must be an **active member of the task's project** | trigger `trg_task_assignees_project_member`; the UI dropdown lists only active members (`getActiveProjectMembers`) |
| The assignee's account must be `ACTIVE` | trigger `trg_task_assignees_not_suspended` |
| Assigning notifies the assignee (`TASK_ASSIGNED`) unless they disabled notifications | `NotificationService.notifyTaskAssigned` |
| Both assign and unassign write an activity entry (`TASK_ASSIGNED` / `TASK_UNASSIGNED`) | `TaskAssigneeService` |
| Unassigning sends **no** notification | *(confirmed: no call in `deleteTaskAssignee`)* |

The New/Edit Task form sends two calls: save the task, then reconcile the assignee against `/api/task-assignees` (delete the old row, create the new one). If the task saves but the assignee step fails, the form still closes and an error toast says the task was saved but the assignee was not.

Changing a task's **project** in the Edit form clears an assignee who is not in the new project. Moving a task to another project also requires manage rights on that **target** project; otherwise the backend answers `403` (changed 2026-10-06). Task assignment is the model behind *My Tasks* below ([ADR-0004](adr/0004-task-assignment-model.md)).

## 4. My Tasks

The sidebar entry and page are named **Tasks** (renamed from "My Tasks" on 2026-10-06). The page shows every task in the projects the caller can see, grouped by project, then by To do / Doing / Done. **My Tasks is a filter** in the Filter menu (*Assignment → My Tasks*):

- It keeps only tasks where the logged-in user is one of the task's **assignees** — taken from `GET /api/task-assignees` (`task.id → [userId]` map in `frontend/src/api/relations.js`), compared with the caller's profile id (`pages/Tasks.jsx`).
- It is **assignee-based, not creator-based**. Tasks assigned to you by an owner or admin appear; tasks you created but are not assigned to do not.
- It combines with the other filters (priority, project) and search; it counts toward the "Filter (N)" badge; **Clear filters** resets it.
- It needs no backend change: `GET /api/task-assignees` already returns every assignment in the caller's projects, scoped like every other read.
- A user with no assignments (for example the seeded `admin.system`) sees the empty state "No tasks match your search/filters".

Page behaviour: search matches title, description and project name; filters are priority (multi-select), project and My Tasks; sort is *Due date*, *Priority* or *Title (A–Z)*. There is no filter by status, assignee or due date, and no "today / upcoming" grouping. Fully complete projects sink to the bottom.

## 4a. Permissions summary

See the full matrix in [authentication-authorization.md](authentication-authorization.md#52-permission-matrix). In short: `OWNER`/`ADMIN` do everything; `MEMBER` creates tasks and edits subtasks/comments; an **assigned** user may change only `status`/`progress` of that task; `VIEWER` is read-only — it cannot add comments or subtasks, nor change a task even if assigned to it (changed 2026-10-06).

## 5. Subtasks

Table `subtasks`: `title` (≤ 200, required), `assigneeId` (optional), `dueDate` (optional), `status` (`TO_DO`, `IN_PROGRESS`, `COMPLETED`). UI: a checklist in the task panel and an expandable list on each Tasks-page row (fetched on demand — there is no bulk endpoint).

Rules:

- **Permissions:** reading needs project membership; creating, editing and deleting subtasks need content-edit rights (`OWNER`/`ADMIN`/`MEMBER`) — a `VIEWER` gets `403` and the task panel hides the controls (changed 2026-10-06).
- **Assignee:** must be an active member of the project and `ACTIVE` — checked only when the assignee actually *changes* (`SubtaskService.applyRequest`), so editing an old subtask whose assignee later left the project still works.
- **Progress:** if a task has subtasks, its `progress` is `100 × completed ÷ total`, recomputed by triggers (`trg_subtasks_sync_parent_task`, `trg_tasks_progress_derived_from_subtasks`). With no subtasks, progress is not subtask-derived.
- **Completion gate:** a task cannot **enter** `COMPLETED` while any subtask is not `COMPLETED` — `400 "Complete all subtasks before marking this task as done."`, checked in `TaskService` and again by trigger `trg_tasks_not_completed_with_open_subtasks`. It only blocks the transition; an already-`COMPLETED` task stays completed if a subtask is added or reopened later.
- **Auto-promotion:** updating any subtask of a task that is still `TO_DO` promotes the task to `IN_PROGRESS` once (`SubtaskService.startTaskIfStillToDo`), and writes a `TASK_STATUS_CHANGED` entry. It is skipped when the task is blocked by an unfinished dependency, and it never demotes or completes a task.
- **Activity:** `SUBTASK_ADDED`, `SUBTASK_COMPLETED` (only when it newly becomes completed) and `SUBTASK_DELETED`.

`checklist_items` (a separate table in the schema) has no entity, API or UI; subtasks serve as the checklist.

## 6. Comments

Table `comments`: `message` (required, ≤ 4000), `task`, `user`, optional `parent_comment_id` (a reply). API: list by task (oldest first), create, update, delete.

| Aspect | Behaviour |
|---|---|
| Who can read / add | **read:** any active project member (including `VIEWER`); **add:** content-edit rights (`OWNER`/`ADMIN`/`MEMBER`) — a `VIEWER` gets `403` and the UI hides the comment box (changed 2026-10-06) |
| Edit | the author only |
| Delete | the author, or an `OWNER`/`ADMIN` (or administrator) of the project |
| UI | add, edit own, delete (task panel). **No reply control** — `parentCommentId` is accepted by the API but the UI never sends it |
| Notification | **none** — `COMMENT_ADDED` exists as an allowed type but no code creates it |
| Activity | **none** — `COMMENT_ADDED` is allowed in `activity_logs.action` but is never written |
| Reply validation | the parent comment must exist; the code does **not** check that it belongs to the same task *(by reading `CommentService`; not tested live)* |
| Deleting a comment with replies | database `ON DELETE CASCADE` removes the replies |

## 7. Dependencies

Table `task_dependencies (task_id, depends_on_task_id)`: "`task` cannot start until `depends_on_task` is `COMPLETED`". `POST /api/task-dependencies` and `DELETE /api/task-dependencies?taskId=&dependsOnTaskId=` require `OWNER`/`ADMIN` of the **dependent task's** project. The task panel lists, adds and removes dependencies.

Database rules:

- a task cannot depend on itself (`CHECK`), and **cycles are rejected** (`trg_task_dependencies_no_cycle`, recursive check);
- a task cannot move to `IN_PROGRESS`, `IN_REVIEW` or `COMPLETED` while any dependency is not `COMPLETED` (`trg_tasks_dependencies_status_gate`); `TO_DO` and `CANCELLED` are always allowed;
- a new dependency cannot be added to an already-active task if the prerequisite is not `COMPLETED` (`trg_task_dependencies_status_gate`).

Surfacing: `TaskResponse.blocked` and `blockingTaskTitles` (names of the unfinished prerequisites) come from one batched query (`TaskDependencyRepository.findBlockingTasks`); the UI shows a lock icon with a tooltip and the Kanban *Blocked* column.

**Needs clarification:** neither `TaskDependencyService.createTaskDependency` nor the schema checks that the two tasks are in the same project, so a dependency across projects appears possible.

## 8. Milestones

Table `milestones`: `title` (≤ 200, required), `description`, `dueDate` (required), `status` (`PENDING`, `IN_PROGRESS`, `COMPLETED`), `progress`.

- Create / update / delete: `OWNER`/`ADMIN`/administrator (moving a milestone to another project via update also needs manage rights on the target project — changed 2026-10-06). The project page lets you **add** (title + due date) and **delete**; **editing a milestone exists only in the API**.
- `dueDate` must fall within the project's start and end dates (trigger).
- `progress` is derived like a project's (completed ÷ non-cancelled tasks linked to it); `status` is **not** derived — it stays whatever was set.
- Calendar does not show milestones; the milestone selector is absent from the task forms.

## 9. Activity and history

`GET /api/activity-logs/task/{taskId}` returns the task's feed, newest first. The task panel's Activity section shows it and refreshes after changes.

Events actually written by code (`ActivityLogService.record`):

| Action | Written when |
|---|---|
| `TASK_CREATED` | a task is created ("Task created") |
| `TASK_STATUS_CHANGED` | status changes ("Status changed from To Do to In Progress"); also by the subtask auto-promotion |
| `TASK_PRIORITY_CHANGED` | priority changes |
| `TASK_DUE_DATE_CHANGED` | due date changes |
| `TASK_ASSIGNED` / `TASK_UNASSIGNED` | assignment added / removed |
| `SUBTASK_ADDED` / `SUBTASK_COMPLETED` / `SUBTASK_DELETED` | subtask events |
| `TASK_DELETED` | a task is deleted — written with **no task link** (only the project), so it is **not returned by any endpoint** (the only read is per task) |

Allowed by the database `CHECK` but **never written**: `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_COMPLETED`, `TASK_COMPLETED`, `COMMENT_ADDED`, `FILE_UPLOADED`, `MILESTONE_CREATED`, `MILESTONE_COMPLETED`. There is no project-wide or per-user feed and no generic audit interceptor. Entries are written inside the same transaction as the change.

Changes to title, description, dates other than due date, estimated hours, project and milestone are not logged.

## 10. Task rules at a glance

| Rule | Where enforced |
|---|---|
| A task belongs to a project | form, `@NotNull`, `NOT NULL` + foreign key |
| `start_date` and `due_date` required; `due ≥ start` | `@NotNull`, `NOT NULL`, `CHECK` |
| `due_date ≤ project.end_date` | trigger `trg_tasks_due_date_within_project` |
| Milestone belongs to the task's project | trigger `trg_tasks_milestone_project_match` |
| Assignee is an active member and an `ACTIVE` account | triggers; UI filters the list |
| `completed_at` set/cleared automatically | trigger `trg_tasks_completed_at` |
| No dependency cycles; no starting before prerequisites finish | triggers |
| Cannot complete with open subtasks | service + trigger |
| Task progress follows subtasks | triggers |
| Project and milestone progress follow tasks | triggers |
| Only owners/admins edit everything; assignees change only status/progress | `TaskService.updateTask` |
| New tasks start as `TO_DO` with progress 0 | UI forms (`status: 'TO_DO'`, `progress: 0`); the API accepts any status on create |
