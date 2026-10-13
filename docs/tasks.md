# Task Management

Tasks, milestones, subtasks, checklists, attachments, dependencies, assignment, approval, comments, time tracking and activity history. Code: `TaskService`, `TaskApprovalService`, `MilestoneService`, `SubtaskService`, `ChecklistItemService`, `AttachmentService`, `TaskAssigneeService`, `TaskDependencyService`, `CommentService`, `WorkLogService`, `ActivityLogService`; UI: `pages/Tasks.jsx`, `Kanban.jsx`, `Calendar.jsx`, `ProjectDetail.jsx`, `components/TaskFormModal.jsx`, `TaskDetailPanel.jsx`. Database rules are in [database.md](database.md#5-triggers-and-functions).

## 1. Task structure

A task **always belongs to exactly one project** (`tasks.project_id NOT NULL`, `TaskRequest.projectId @NotNull`, the form's Project field is required). This matches `Role_Requirment.md` ("Each task must belong to a project").

| Field | Type / rule | Notes |
|---|---|---|
| `id` | identity | |
| `project` | required | Cannot be omitted. The New Task form only offers projects where the caller holds `TASK:CREATE` |
| `milestone` | optional | Must belong to the **same project** (trigger `trg_tasks_milestone_project_match`). The UI forms have no milestone picker; the API accepts `milestoneId` |
| `title` | required, ≤ 200 | |
| `description` | optional text | |
| `priority` | `LOW`, `MEDIUM` (default), `HIGH`, `URGENT` | |
| `status` | `TODO` (default), `IN_PROGRESS`, `IN_REVIEW`, `COMPLETED`, `CANCELLED` | |
| `startDate`, `dueDate` | **both required** (`NOT NULL`) | `dueDate ≥ startDate` (CHECK) and `dueDate ≤ project.endDate` (trigger) |
| `estimatedHours` | optional, ≥ 0 (`NUMERIC(6,2)`, so at most 9999.99) | Entered as hours, minutes or days (`4`, `1h 30m`, `45m`, `2d` — a day is 8 hours) and stored as decimal hours. The response also carries read-only `actualHours`, the sum of the task's work logs (see "Time tracking" below) |
| `progress` | 0–100 | Derived when the task has subtasks (see §5); otherwise stored as sent (default 0) |
| `completedAt` | timestamp | **Set automatically** when status becomes `COMPLETED` and cleared when it leaves it (`trg_tasks_completed_at`); any value in a request is overridden |
| `createdBy` | user | Always the caller on create (a client-supplied `createdById` is honoured only for a system administrator) |
| `createdAt`, `updatedAt` | timestamps | database-maintained |

Computed in `TaskResponse` (not stored): `overdue` (due date before today and status not `COMPLETED`/`CANCELLED` — the same definition as view `v_overdue_tasks`), `dueSoon` (not `COMPLETED`/`CANCELLED` and due today or within the next 3 days, `Derived.isTaskDueSoon`; the UI shows it as a *Due today / tomorrow / in N days* badge; an overdue task is never also due soon), `totalSubtasks`, `completedSubtasks`, `blocked`, `blockingTaskTitles`.

## 2. Status and priority

**Statuses** — `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `COMPLETED`; `CANCELLED` as a terminal alternative. The backend does **not** enforce a fixed transition order: any status can be set from any other, subject to the rules in §7 (open subtasks, unfinished dependencies).

How the UI moves a task (`frontend/src/api/tasks.js`):

- **Quick-advance circle** (Tasks page): one click = one step — `TODO → IN_PROGRESS`, then — for someone who may **approve** (`TASK:APPROVE`) — `IN_PROGRESS`/`IN_REVIEW → COMPLETED`; for everyone else `IN_PROGRESS → IN_REVIEW` ("Submit for review"), which then waits ("Awaiting approval") for an approver. `COMPLETED` and `CANCELLED` are terminal for this control, so a finished task is never reopened by a stray click. The Tasks page has one group per status — **To Do**, **In Progress**, **In Review**, **Completed**, **Cancelled** (before 2026-10-09 it merged them into To do / Doing / Done); clicking while In Progress or In Review with open subtasks shows the blocking message instead of failing.
- **Status dropdown** (task panel, project page): all five statuses, including reopening and `IN_REVIEW`/`CANCELLED`; *Completed* is not offered to someone without `TASK:APPROVE`, and the dropdown is replaced by a plain badge for someone who cannot change the status at all.
- **Approval gate:** the backend refuses `COMPLETED` without `TASK:APPROVE` (`403`, [authentication-authorization.md](authentication-authorization.md#53-task-update-rule-row-level)); the UI hides the option so a Team Member is never offered it.
- **Approval workflow** (since 2026-10-09, `V12`; assignment-brief.md B3.8): `IN_REVIEW` is only a status. A task entering review gets an open request (*Submit for review* in the task panel, or the quick-advance circle); an approver decides in the panel's *Approval* section or from the *Awaiting your approval* list at the top of the Tasks page:
  - **Approve** — the task becomes `COMPLETED` (progress 100; refused while a subtask is open). An approver who completes a task straight from the status dropdown or the quick-advance circle counts as approving it.
  - **Request changes** — back to `IN_PROGRESS`; a comment is required.
  - **Reject** — a comment is required and the approver chooses `IN_PROGRESS` or `CANCELLED`.
  - An approver can be **named** for a task (the *Approver* picker; needs `ASSIGN`): then only that person, the project Owner or an Administrator decides. Nobody decides their own work except the Owner and Administrators.
  - A request ends as `APPROVED`, `CHANGES_REQUESTED`, `REJECTED` or `WITHDRAWN` (the task left review without a decision). The panel lists the history with who decided, when and why. Tasks and Kanban show an *Awaiting approval* / *Changes requested* chip.
  - Every request and decision writes an activity entry and a notification ([notifications.md](notifications.md)).
- **Kanban**: columns *To Do*, *In Progress*, *In Review*, *Completed*, plus a computed *Blocked* column (a `TODO` task that is blocked by an unfinished dependency — "Blocked" is never a stored status). Cards open the task panel. A card can be **dragged** to another column or moved from its **Move to** menu (since 2026-10-13); both use the task panel's status change, so the rules below apply: Blocked is not a place to drop, a blocked task cannot start, Completed needs an approver and every subtask done (everyone else moves a task to In Review, which opens the approval request), and someone who may not change the task gets no handle and no menu.

**Priorities** — `LOW`, `MEDIUM`, `HIGH`, `URGENT` (tasks); projects use `CRITICAL` instead of `URGENT`. The Tasks page can sort by priority (Urgent first).

## 3. Assignment

Table `task_assignees` (`UNIQUE (task_id, user_id)`) — many assignees per task are possible at the data and API level; **the UI assigns a single person** (one Assignee dropdown, shown only to holders of `TASK:ASSIGN`).

| Rule | Enforced by |
|---|---|
| Only a holder of `TASK:ASSIGN` in the task's project (Project Manager, Team Leader, administrator) may assign/unassign | `TaskAssigneeService` |
| The assignee must be an **active member of the task's project** | trigger `trg_task_assignees_project_member`; the UI dropdown lists only active members (`getActiveProjectMembers`) |
| The assignee's account must be `ACTIVE` | trigger `trg_task_assignees_not_suspended` |
| Assigning notifies the assignee (`TASK_ASSIGNED`) unless they disabled notifications | `NotificationService.notifyTaskAssigned` |
| Both assign and unassign write an activity entry (`TASK_ASSIGNED` / `TASK_UNASSIGNED`) | `TaskAssigneeService` |
| Unassigning sends **no** notification | *(confirmed: no call in `deleteTaskAssignee`)* |

The New/Edit Task form sends two calls: save the task, then reconcile the assignee against `/api/task-assignees` (delete the old row, create the new one). If the task saves but the assignee step fails, the form still closes and an error toast says the task was saved but the assignee was not.

Changing a task's **project** in the Edit form clears an assignee who is not in the new project. Moving a task to another project also requires manage rights on that **target** project; otherwise the backend answers `403` (changed 2026-10-06). Task assignment is the model behind *My Tasks* below ([ADR-0004](adr/0004-task-assignment-model.md)).

## 4. My Tasks

The sidebar entry and page are named **Tasks** (renamed from "My Tasks" on 2026-10-06). The page shows every task in the projects the caller can see, grouped by project, then by status (To Do / In Progress / In Review / Completed / Cancelled). **My Tasks is a filter** in the Filter menu (*Assignment → My Tasks*):

- It keeps only tasks where the logged-in user is one of the task's **assignees** — taken from `GET /api/task-assignees` (`task.id → [userId]` map in `frontend/src/api/relations.js`), compared with the caller's profile id (`pages/Tasks.jsx`).
- It is **assignee-based, not creator-based**. Tasks assigned to you by an owner or admin appear; tasks you created but are not assigned to do not.
- It combines with the other filters (status, priority, assignee, due date, project) and search; it counts toward the "Filter (N)" badge; **Clear filters** resets it.
- It needs no backend change: `GET /api/task-assignees` already returns every assignment in the caller's projects, scoped like every other read.
- A user with no assignments (for example the seeded `admin.system`) sees the empty state "No tasks match your search/filters".

Page behaviour: search matches title, description and project name; search also matches assignee names, priority, status and due date; filters are **status** (multi-select), **priority** (multi-select), **assignee** (or *Unassigned*), **due date** (*Overdue*, *Due today*, *Due in the next 7 days*, *No due date*), project and My Tasks, all combined with AND; sort is *Due date*, *Latest*, *Priority*, *Progress*, *Status* or *Title (A–Z)*. They run in the browser over the tasks the server already limited to the caller. `GET /api/tasks` takes the same fields as parameters ([api-reference.md](api-reference.md#9-tasks)). Fully complete projects sink to the bottom.

**Quick views** (since 2026-10-12, the brief's *My Tasks* groups): a bar above the list with **All, Today, Upcoming, In Progress, Completed and Overdue**, each showing how many tasks it holds. A view narrows what the search and the filters (including *My Tasks*) already leave, so *My Tasks* + *Today* is "my tasks due today". *Today* = open tasks due today, *Upcoming* = open tasks due after today, *In Progress* = status In Progress, *Completed* = status Completed, *Overdue* = the server's `overdue` flag; "open" means not Completed or Cancelled. Selecting a view does not count toward the "Filter (N)" badge, and *All* shows everything again.

## 4a. Permissions summary

See the full matrix in [authentication-authorization.md](authentication-authorization.md#52-project-scope-matrix). In short: Project Managers and Team Leaders (`OWNER`/`ADMIN`) do everything, including **approving** a task as completed; a Team Member (`MEMBER`) does **not** create or delete tasks, but works on subtasks, checklist items, comments, files and time; an **assigned** user may change only `status`/`progress` of that task, and may move it to *In Review* but not to *Completed*; `VIEWER` is read-only — it cannot add comments or subtasks, nor change a task even if assigned to it (changed 2026-10-06).

## 5. Subtasks

Table `subtasks`: `title` (≤ 200, required), `assigneeId` (optional), `dueDate` (optional), `status` (`TODO`, `IN_PROGRESS`, `COMPLETED`). UI: a checklist in the task panel and an expandable list on each Tasks-page row (fetched on demand — there is no bulk endpoint).

Rules:

- **Permissions:** reading needs project membership; creating, editing and deleting subtasks need the `SUBTASK:*` grants (everyone except `VIEWER`) — a `VIEWER` gets `403` and the task panel hides the controls (changed 2026-10-06).
- **Assignee:** must be an active member of the project and `ACTIVE` — checked only when the assignee actually *changes* (`SubtaskService.applyRequest`), so editing an old subtask whose assignee later left the project still works.
- **Progress:** if a task has subtasks, its `progress` is `100 × completed ÷ total`, recomputed by triggers (`trg_subtasks_sync_parent_task`, `trg_tasks_progress_derived_from_subtasks`). With no subtasks or checklist items, the status decides (since `V17`, D-18): a task entering `COMPLETED` is **100** and one leaving it goes back to **0**, whichever screen or client changed the status (`TaskService` sets it and `trg_tasks_progress_derived_from_subtasks` backs it up); a task that has subtasks or items gets the number derived from them.
- **Completion gate:** a task cannot **enter** `COMPLETED` while any subtask is not `COMPLETED` — `400 "Complete all subtasks before marking this task as done."`, checked in `TaskService` and again by trigger `trg_tasks_not_completed_with_open_subtasks`. It only blocks the transition; an already-`COMPLETED` task stays completed if a subtask is added or reopened later.
- **Auto-promotion:** updating any subtask of a task that is still `TODO` promotes the task to `IN_PROGRESS` once (`SubtaskService.startTaskIfStillToDo`), and writes a `TASK_STATUS_CHANGED` entry. It is skipped when the task is blocked by an unfinished dependency, and it never demotes or completes a task.
- **Activity:** `SUBTASK_ADDED`, `SUBTASK_COMPLETED` (only when it newly becomes completed) and `SUBTASK_DELETED`.

**Checklist** (since 2026-10-09, `V13`; assignment-brief.md B1.6): lightweight tick-boxes inside a task, apart from subtasks (no assignee or due date). Table `checklist_items`: `content` (≤ 300), `completed`, `sortOrder`, who added it. UI: the *Checklist* section of the task panel and `n/m checklist` on the Tasks page. A Team Member adds items, ticks them only on tasks assigned to them, and deletes their own; the Owner and Team Leader do all of it. **Progress counts items with subtasks** (D-07): `(done subtasks + done items) ÷ (all subtasks + all items)`; a completed task whose subtasks are all done stays 100 even with open items — only open **subtasks** block Completed.

**Attachments** (since 2026-10-09, `V13`): files on a task (task panel) or on the project (project page). 10 MB per file, 25 per task or project; png, jpg, jpeg, gif, webp, pdf, txt, md, csv, json, doc, docx, xls, xlsx, ppt, pptx, odt, ods, odp, zip only, content checked against the type. Anyone who works in the project uploads; the uploader, the Owner and the Team Leader delete; a Viewer only reads. Details: [api-reference.md](api-reference.md#12c-attachments).

## 6. Comments

Table `comments`: `message` (required, ≤ 4000), `task`, `user`, optional `parent_comment_id` (a reply). API: list by task (oldest first), create, update, delete.

| Aspect | Behaviour |
|---|---|
| Who can read / add | **read:** any active project member (including `VIEWER`); **add:** `COMMENT:CREATE` (everyone except `VIEWER`) — a `VIEWER` gets `403` and the UI hides the comment box (changed 2026-10-06) |
| Edit | the author only |
| Delete | the author, or a holder of `COMMENT:DELETE` (Project Manager, Team Leader, administrator) |
| UI | add, edit own, delete, and **reply** (task panel): replies are nested under their comment and the composer shows "Replying to …" |
| Notification | `COMMENT_ADDED` (since 2026-10-12): the task's assignees, the project's Owner and Team Leaders and, for a reply, the author of the comment it answers; never the author ([notifications.md](notifications.md#9-comments-project-updates-and-milestone-updates-since-2026-10-12)) |
| Mentions | `@username` in a comment (since 2026-10-13, D-21): the person, if an active member of the project, is told with a `MENTION` notification **instead of** the line above; the author never is; an edit tells only the newly mentioned. The task panel offers the project's members while you type `@` and highlights the mentioned ones |
| Activity | `COMMENT_ADDED` is written to the task feed (`CommentService`) |
| Reply validation | the parent comment must exist and belong to the same task (`400 "The comment you are replying to belongs to another task"`, since 2026-10-09) |
| Deleting a comment with replies | database `ON DELETE CASCADE` removes the replies |

## 7. Dependencies

Table `task_dependencies (task_id, depends_on_task_id)`: "`task` cannot start until `depends_on_task` is `COMPLETED`". `POST /api/task-dependencies` and `DELETE /api/task-dependencies?taskId=&dependsOnTaskId=` require `TASK:ASSIGN` in the **dependent task's** project. The task panel lists, adds and removes dependencies.

Database rules:

- a task cannot depend on itself (`CHECK`), and **cycles are rejected** (`trg_task_dependencies_no_cycle`, recursive check);
- a task cannot move to `IN_PROGRESS`, `IN_REVIEW` or `COMPLETED` while any dependency is not `COMPLETED` (`trg_tasks_dependencies_status_gate`); `TODO` and `CANCELLED` are always allowed;
- a new dependency cannot be added to an already-active task if the prerequisite is not `COMPLETED` (`trg_task_dependencies_status_gate`);
- the other direction (since `V17`, D-18): a prerequisite cannot be taken back out of `COMPLETED` (reopened or cancelled) while a task that depends on it is `IN_PROGRESS`, `IN_REVIEW` or `COMPLETED` (`trg_tasks_prerequisite_not_reopened`; `TaskService` gives the message naming those tasks). Move the dependants back to `TODO` first, which blocks them again.

Surfacing: `TaskResponse.blocked` and `blockingTaskTitles` (names of the unfinished prerequisites) come from one batched query (`TaskDependencyRepository.findBlockingTasks`); the UI shows a lock icon with a tooltip and the Kanban *Blocked* column.

**Needs clarification:** neither `TaskDependencyService.createTaskDependency` nor the schema checks that the two tasks are in the same project, so a dependency across projects appears possible.

## 8. Milestones

Table `milestones`: `title` (≤ 200, required), `description`, `dueDate` (required), `status` (`PENDING`, `IN_PROGRESS`, `COMPLETED`), `progress`.

- Create / update / delete: `MILESTONE:CREATE/EDIT/DELETE` (Project Manager, Team Leader, administrator) (moving a milestone to another project via update also needs the right on the target project — changed 2026-10-06). The project page lets you **add** (title + due date), **edit** (title, description, due date and status, in a form; since 2026-10-12) and **delete**. Completing a milestone while linked tasks are still open is allowed (D-08): the form warns, and the tasks are not changed.
- `dueDate` must fall within the project's start and end dates (trigger).
- `progress` is derived like a project's (completed ÷ non-cancelled tasks linked to it); `status` is **not** derived — it stays whatever was set.
- The Calendar shows milestones on their due dates beside the tasks (since 2026-10-12); the milestone selector is absent from the task forms (the API accepts `milestoneId`).

## 9. Activity and history

Three read-only feeds, all newest first: `GET /api/activity-logs/task/{taskId}` (the task panel's Activity section, refreshed after changes), `GET /api/activity-logs/project/{projectId}` (the *Activity* card on the project page) and `GET /api/activity-logs/recent` (the dashboard's *Recent activity*, across the caller's projects).

Events written by code (`ActivityLogService.record` for a task, `recordProjectEvent` for the project itself):

| Action | Written when |
|---|---|
| `TASK_CREATED` | a task is created ("Task created") |
| `TASK_STATUS_CHANGED` | status changes ("Status changed from To Do to In Progress"); also by the subtask auto-promotion and the approval workflow |
| `TASK_PRIORITY_CHANGED` | priority changes |
| `TASK_DUE_DATE_CHANGED` | due date changes |
| `TASK_ASSIGNED` / `TASK_UNASSIGNED` | assignment added / removed |
| `SUBTASK_ADDED` / `SUBTASK_COMPLETED` / `SUBTASK_DELETED` | subtask events |
| `COMMENT_ADDED` | a comment or reply is added |
| `FILE_UPLOADED` | a file is attached to a task or to the project |
| `WORK_LOGGED` / `WORK_LOG_UPDATED` / `WORK_LOG_DELETED` | a time entry is logged, changed (only when a value changed) or deleted; a delete by someone other than the author names who logged it |
| `TASK_APPROVAL_REQUESTED` / `TASK_APPROVED` / `TASK_CHANGES_REQUESTED` / `TASK_REJECTED` / `TASK_APPROVER_SET` | the approval workflow |
| `PROJECT_CREATED` / `PROJECT_UPDATED` / `PROJECT_COMPLETED` | project events (no task link) |
| `MILESTONE_CREATED` / `MILESTONE_COMPLETED` | milestone events (no task link) |
| `TASK_DELETED` | a task is deleted — written with **no task link** (only the project), so it appears in the project and recent feeds but never in a task's own feed |

Allowed by the database `CHECK` but **never written**: `TASK_COMPLETED` (a completion is recorded as `TASK_APPROVED` and `TASK_STATUS_CHANGED`). There is no per-user feed and no generic audit interceptor. Entries are written inside the same transaction as the change.

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
| New tasks start as `TODO` with progress 0 | UI forms (`status: 'TODO'`, `progress: 0`); the API accepts any status on create |


## Time tracking (estimated vs. actual)

Implements the "Estimated Time / Actual Time" part of the assignment (Time Tracking & Work Logs). Time tracking is an **optional** feature in the specification ([assignment-brief.md](../assignment-brief.md) §B11).

- **Estimate** — the optional `estimatedHours` on the task (New Task / Edit Task form).
- **Actual** — the sum of the task's **work logs** (`work_logs` table; `WorkLog` entity). `TaskResponse.actualHours` is filled from one grouped query for the whole list, so listing tasks does not run a query per task.
- **Logging** — in the task panel's *Time tracking* section a member types a time (`1h 30m`, `45m`, `1.5`, `2d`), a date (default today, never in the future; the server accepts a date up to a day ahead of its own, so that someone in a time zone ahead of the server can log "today" just after midnight) and an optional note (≤ 500). One entry is 0.01–24 hours. Anyone who can edit the project's content (`OWNER`/`ADMIN`/`MEMBER`, or a system administrator) can log time **for themselves on any task of the project**, not only on tasks assigned to them (decision D-23, as the permission matrix reads); a `VIEWER` can read the entries but not add any.
- **Timer** — *Start timer* keeps a clock in the browser (`localStorage`, one running timer per user, survives a reload). *Stop* does not save by itself: it fills the time and date into the form so the person can trim it or add a note. A run under a minute is discarded; one over 24 hours is capped and flagged.
- **Changing** — the pencil on **your own** entry turns it into a small form (time, date, note). Only the author can change an entry, not even an administrator, and only while they can still log time in the project (a `VIEWER` cannot); an entry stays on its task. Saving without a change writes nothing to the feed.
- **Deleting** — the author, or a holder of `WORK_LOG:DELETE` (Project Manager, Team Leader, administrator), can delete an entry.
- **Activity** — logging, changing and deleting an entry are written to the task's activity feed (and so the project feed): `WORK_LOGGED`, `WORK_LOG_UPDATED`, `WORK_LOG_DELETED`. They send no notification.
- **Display** — the panel shows `logged / estimated`, a progress bar and the time left, or in the danger colour how far over the estimate the task is. Task rows and board cards show a small `1h 30m / 13h` chip (danger colour once over).

Per-person actual hours do appear in the project *Workload* view and the Workload report (`actualHours`, calculated by `TeamViewsService`); the SQL view `v_team_workload` itself is not read by the application.
