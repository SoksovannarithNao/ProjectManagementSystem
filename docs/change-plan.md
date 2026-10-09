# Change Plan

What is still to change in the application, in the order proposed. Written on **2026-10-08**, after the two-level role migration (`V10`). **Batches 1, 2, 3a, 3b and 3c were done on 2026-10-09** (see §3, §4 and §5); nothing else is started.

Sources: the approved specification ([assignment-brief.md](../assignment-brief.md) Part B, decisions D-01 … D-18 all approved), the user flows ([project-workflow.md](../project-workflow.md)) and the live test ([workflow-conformance.md](workflow-conformance.md)). Section references like *B8* point into Part B of the brief.

## 1. Where we are

| Done | Where |
|---|---|
| Two-level roles, one owner per project, Team Member limits, permission matrix and its admin screens | [ADR-0015](adr/0015-two-level-roles-system-and-project.md), migration `V10` |
| Specification resolved on paper (contradictions, definitions, reports, notifications, acceptance criteria) | brief Part B, `project-workflow.md` |
| Time tracking (optional feature) | [tasks.md](tasks.md#time-tracking-estimated-vs-actual) |
| Live conformance test of the 40 workflows | [workflow-conformance.md](workflow-conformance.md): 16 pass, 18 partial, 10 missing (20 / 14 / 10 after batch 1; 22 / 13 / 9 after batch 2; 26 / 10 / 8 after batch 3a; 31 / 7 / 6 after batch 3b; 33 / 6 / 5 after batch 3c) |
| **Batch 1 — quick fixes (7 items)** | 2026-10-09, migration `V11`; §3 |
| **Batch 2 — approval workflow** | 2026-10-09, migration `V12`; §4 |
| **Batch 3a — collaboration (4 items)** | 2026-10-09, migration `V13`; §5 |
| **Batch 3b — manager views (6 items)** | 2026-10-09, no schema change; §5 |
| **Batch 3c — reports and KPIs (2 items)** | 2026-10-09, no schema change; §5 |

| Remaining | Items | Size |
|---|---|---|
| ~~1. Quick fixes~~ | done 2026-10-09 | |
| ~~2. Approval workflow~~ | done 2026-10-09 | |
| **3. Missing required features** | 5 sub-batches, 16 items | large |
| **4. Optional features** | 6 | optional |
| **5. Housekeeping** | 3 (1 done) | small |

## 2. How every batch is delivered

1. Change the code **and** the tests (unit + Playwright); a new rule gets a test that fails without it.
2. A schema change is a new idempotent `V<n>` migration **plus** the same end state in `database/init/01-init.sql`; raise the version in `init/04-flyway-baseline.sql`.
3. Back up the live database (`pg_dump`) before a migration; try the migration on a throw-away copy first.
4. Rebuild and redeploy (`docker compose build backend frontend`, `docker compose up -d`), then verify against the running stack.
5. Update the affected `docs/` pages and add a [changelog.md](changelog.md) entry in the same change.
6. Nothing is committed by the assistant; the commit is yours.

## 3. Batch 1 — Quick fixes (7) — done 2026-10-09

| # | Change | Why | Where |
|---|---|---|---|
| 1.1 | Unknown API paths return `404`, not `500` | I-22: every typo logs a stack trace | `GlobalExceptionHandler` (handle `NoResourceFoundException`) |
| 1.2 | UI says **Completed** and **In Review**, not "Done" / "Review" | Conflict C-01; X-4 in the brief | Kanban columns, Tasks groups, Dashboard card |
| 1.3 | Assignment notification carries task name, project, due date and who assigned it | Part A requires it (conformance §13) | `NotificationService.notifyTaskAssigned` |
| 1.4 | Sign in with **username or email** | Part A, REQUIRED | `AuthService`, login form label |
| 1.5 | Users edit their **own position and department** (from the managed lists) | D-16 | `SelfProfileUpdateRequest`, `UserService.updateOwnProfile`, Profile page |
| 1.6 | **Project filters** (Active, Completed, On Hold, Priority, Manager) and sorting; task filter by status, assignee, due date | B1.9, Part A REQUIRED | Projects and Tasks pages; list endpoints stay permission-scoped |
| 1.7 | Rename the stored status `TO_DO` → `TODO` | D-15 | migration `V11`, entity/DTO patterns, frontend constants, tests. **Riskiest of the batch**: touches many files, so do it last and on its own |

### Result (2026-10-09)

All seven items are done, deployed to the running stack and verified there (details: [changelog.md](changelog.md), re-test: [workflow-conformance.md](workflow-conformance.md) §7). I-22 and X-02 are closed.

| # | What was built | Notes |
|---|---|---|
| 1.1 | `GlobalExceptionHandler.handleNoResource` answers `404 "Resource not found"` | Verified live; the backend log shows no stack trace for a mistyped URL |
| 1.2 | Kanban, Tasks, Dashboard and the status filters say To Do / In Progress / In Review / Completed | The Tasks page now has **five groups** (one per status) instead of the merged To do / Doing / Done, so In Review is visible on its own |
| 1.3 | Assignment notification: `<assigner> assigned you to "<task>" in "<project>" — due <date>` | `notifyTaskAssigned` takes the assigner; "no due date set" when there is none |
| 1.4 | Sign in with username **or** e-mail | `UserService.resolveLoginIdentifier`; the request field is still `username`; case-insensitive; the rate-limit key uses what was typed |
| 1.5 | Profile page: Position and Department from the managed lists | `PUT /api/users/me` takes `positionId` / `departmentId`; no "+ Add New" (administrators only); the Team-page endpoint now tells you to use Profile for yourself |
| 1.6 | Project filters (status, priority, manager) + sort; task filters (status, assignee, due date) + extra sorts; wider search | Done **in the browser over the already permission-scoped lists**, which cannot reveal anything the user may not open. The list endpoints still take no parameters (brief G-16) |
| 1.7 | `TO_DO` → `TODO` | Migration `V11` (idempotent; rewrites 26 tasks and 77 subtasks without touching `updated_at`); `01-init.sql`, seed, entities, DTO patterns, frontend, tests, docs; label stays "To Do"; Flyway baseline raised to 11 |

Delivery followed §2: `pg_dump` taken first, `V11` tried on a throw-away copy of the live database (and re-run to prove it is idempotent), then `docker compose build backend frontend` and `up -d`. Backend tests 143/143, Playwright 57/57, ESLint clean.

## 4. Batch 2 — Approval workflow (B3.8, A6) — done 2026-10-09

`IN_REVIEW` is a status; **approval is a separate decision** on the task.

- **Data:** an approval record per request (task, requested by/at, decided by/at, decision, comment) and an optional designated approver on the task.
- **Rules (D-05):** every task needs approval to become `COMPLETED`; *Approved* → may complete; *Changes requested* → back to `IN_PROGRESS` with a comment; *Rejected* → the approver chooses `IN_PROGRESS` or `CANCELLED`; Owner / Administrator may approve their own work; Members and Viewers never approve. Who may approve: Administrator, Project Manager (through its project role), Owner, Team Leader.
- **API:** request, decide, designate approver; the existing completion gate stays as the backstop.
- **Side effects:** an activity entry and a notification for every request and decision (recipients per D-10).
- **UI:** "Submit for review" / "Awaiting approval" in the task panel, Tasks and Kanban; an approver sees pending approvals and decides with a comment.
- **Tests:** unit tests for each decision path and who may decide; Playwright: a member submits, a Team Leader approves, the task completes and project progress changes.

### Result (2026-10-09)

Built as planned, deployed and verified live (details: [changelog.md](changelog.md), re-test: [workflow-conformance.md](workflow-conformance.md) §8). §15 and A6 are now PASS.

| Part | What was built | Decisions taken where the specification was silent |
|---|---|---|
| Data | `V12`: `task_approvals` (task, requested by/at, decided by/at, decision, comment; one open request per task) and `tasks.approver_id`; new activity actions and notification types; the 6 tasks already in review got an open request | A fifth decision value `WITHDRAWN` records a request that ended without a decision (the task left review) |
| Rules | Submit (In Progress → In Review + request); Approved completes the task; Changes requested → In Progress; Rejected → In Progress or Cancelled; comments required for the last two; Owner / Administrator may approve their own work | **Approving completes the task straight away** (the brief says "may be set to Completed"). A named approver is exclusive, except the Owner and an Administrator. "Own work" = you requested the review or are assigned to the task |
| API | `POST /api/tasks/{id}/approval/submit`, `POST /api/tasks/{id}/approval/decision`, `GET /api/tasks/{id}/approvals`, `PUT /api/tasks/{id}/approver`, `GET /api/approvals/pending`; `TaskResponse` gains `approver`, `approvalStatus`, `approvalRequestedBy/At` | The completion gate stays as the backstop: completing through `PUT /api/tasks/{id}` needs `TASK:APPROVE`, follows the same who-may-decide rules and is recorded as the approval; moving a task into review through the edit opens a request, moving it out withdraws it |
| Side effects | Activity entries (`TASK_APPROVAL_REQUESTED`, `TASK_APPROVED`, `TASK_CHANGES_REQUESTED`, `TASK_REJECTED`, `TASK_APPROVER_SET`) and notifications (`APPROVAL_REQUESTED`, `APPROVAL_DECIDED`) | A request notifies the named approver, otherwise every active member who may approve; a decision notifies the requester; the actor is never notified (D-10 proposal) |
| UI | Task panel: *Approval* section (submit, awaiting-approval banner, comment box with Approve / Request changes / Reject, approver picker, history); an *Awaiting approval* / *Changes requested* chip on Tasks and Kanban; an *Awaiting your approval* inbox on the Tasks page | The quick-advance circle offers "Submit for review" instead of "Mark as Completed" to an approver who may not decide that task (their own work) |

Delivery followed §2: `pg_dump` first, `V12` tried (and re-run) on a restored copy of the live database, then build and `up -d`. Backend tests 175/175, Playwright 66/66, ESLint clean.

## 5. Batch 3 — Missing required features

Split into five sub-batches. Each is independent except where noted.

### 3a. Collaboration (4) — done 2026-10-09

| Item | Detail |
|---|---|
| File attachments | Upload to a project or task; Owner, Team Leader, Team Member may upload; the uploader or the Owner may delete; validate type and size (limits are still to be chosen, D-17) |
| Comment replies in the UI | The API already supports `parentCommentId` |
| Checklists | Separate from subtasks (B1.6); counted in task progress together with subtasks (D-07) |
| Project-level activity | Project created/updated, comment added, file uploaded, approval events; a feed on the project page |

#### Result of 3a (2026-10-09)

All four items are built, deployed and verified live (details: [changelog.md](changelog.md), re-test: [workflow-conformance.md](workflow-conformance.md) §9).

| Item | What was built | Decisions taken where the specification was silent |
|---|---|---|
| File attachments | Upload to a task or a project (`POST /api/attachments`), list, download, delete; stored in the database (`attachment_contents`); *Attachments* section in the task panel and on the project page | **Limits (D-17 was UNDEFINED): 10 MB per file, 25 files per task or project, allow-list of types.** Content is checked against the type (a renamed `.exe` is refused); file names are cleaned; downloads are always attachments (`nosniff`, CSP `sandbox`) and need a token. New permission resource `ATTACHMENT` (Owner / Team Leader: view, upload, delete; Team Member: view, upload; Viewer: view); the uploader may always delete their own file |
| Comment replies in the UI | *Reply* on every comment, a "Replying to…" bar on the composer, replies nested under their comment | A reply must belong to the same task (this closes the first half of I-15) |
| Checklists | `ChecklistItem` API and a *Checklist* section in the task panel (add, tick, delete); shown on the Tasks page as `n/m checklist`; counted in task progress with the subtasks (D-07) by a database trigger | New resource `CHECKLIST_ITEM`, granted like subtasks (a Team Member ticks only on tasks assigned to them); the author may delete their own item. **Only subtasks gate completion** (open checklist items do not block Completed; a completed task stays 100) |
| Project-level activity | `GET /api/activity-logs/project/{id}`; an *Activity* card on the project page | Events now recorded: project created / updated (with what changed) / completed, milestone created / completed, comment and reply added, file uploaded. Task, subtask, approval and deleted-task entries were already tied to the project and now show up too |

Also fixed on the way: nginx refused any request body over 1 MB, so even profile photos (limit 5 MB) failed in the Docker deployment; the API location now allows 12 MB and the 5 MB photo limit is checked in `UserService`.

Delivery followed §2: `pg_dump` first, `V13` tried (and re-run) on a restored copy, a fresh database built from `01-init.sql` + `02-seed.sql` and compared with the migrated copy, then build and `up -d`. Backend tests 226/226, Playwright 76/76, ESLint clean.

### 3b. Manager views (6) — done 2026-10-09

| Item | Detail |
|---|---|
| Dashboard statistics | Total / Active (`IN_PROGRESS`) / Completed / **Delayed** projects; recent activities |
| Delayed projects | Calculated, never stored: end date passed and not Completed or Cancelled (B1.3) |
| Team Tasks | Per project, grouped by member, for Owner and Team Leader |
| Project timeline | Project, milestone and task dates on one axis |
| Team workload | Assigned / active / overdue tasks, estimated and actual hours; overloaded / underloaded **relative to the team average** (D-13) |
| Change a member's role, transfer ownership | UI for what the API already does (B3.9) |

#### Result of 3b (2026-10-09)

All six items are built, deployed and verified live (details: [changelog.md](changelog.md), re-test: [workflow-conformance.md](workflow-conformance.md) §10). No schema change, so no migration this time.

| Item | What was built | Decisions taken where the specification was silent |
|---|---|---|
| Dashboard statistics | `GET /api/dashboard/stats` (project counts by status, Delayed, average completion, task counts, overdue, the five most-delayed projects) and `GET /api/activity-logs/recent`; a statistics strip, *Delayed projects* and *Recent activity* cards, and the Task Overview now read from the server figures | Active = `IN_PROGRESS` only (D-06); the average completion leaves out cancelled projects |
| Delayed projects | `ProjectResponse.delayed` / `daysDelayed`, calculated by `backend/util/Derived` (end date passed and not Completed / Cancelled); a *Delayed* badge on cards and the project page; a *Delayed* filter on the Projects page | Never stored, so it cannot disagree with the dates |
| Team Tasks | `GET /api/projects/{id}/team-tasks` and `/projects/:id/team`: every active member with their tasks, counts and average progress, plus unassigned tasks; reassign or unassign from the list; open a task for follow-up | For the right to assign tasks (`TASK:ASSIGN`: Owner, Team Leader, Administrator); Viewers are not listed; cancelled tasks are left out |
| Project timeline | `/projects/:id/timeline`: the project bar, milestone markers and task bars on one axis with a today marker; a task opens the usual panel, a milestone shows its details | Composed in the browser from the existing project, milestone and task endpoints (all dates are already there); open to every member |
| Team workload | `GET /api/projects/{id}/workload`, `GET /api/workload` (every project the caller manages), `/projects/:id/workload` and a dashboard card; assigned / active / overdue, estimated and actual hours and an *Overloaded / Underloaded / Balanced* label | **D-13 made concrete** in `util/WorkloadClassifier` (1.5x / 0.5x the team average with a one-task / four-hour minimum gap); an Owner or Team Leader is listed only once they hold tasks |
| Roles and ownership in the UI | A role picker on every member of the project page (*Team Leader / Team Member / Viewer*, and *Owner (transfer ownership)* with a confirmation for someone who can own projects) | The rules the brief states (B3.7, B3.9) are now enforced by the server: **nobody changes their own project role** (the Owner is told to transfer ownership instead), and **a Team Leader moves only Team Members and Viewers** (not a leader or the Owner) |

Also fixed: three existing end-to-end specs opened "the first project card", which is a different project whenever a test creates one (Postgres reuses freed rows). They now open *Website Redesign* explicitly.

Delivery followed §2: no schema change, so no backup or migration; `docker compose build backend frontend` and `up -d`, then verified against the running stack. Backend tests 265/265, Playwright 86/86 (run twice), ESLint clean.

### 3c. Reporting and KPIs (2) — done 2026-10-09

| Item | Detail |
|---|---|
| The seven named reports | Project, Task, Project Status (with Delayed), Task Completion, Overdue Task, Team Performance, Workload; columns and filters as in B8; **server-side endpoints gated by `REPORT:GENERATE_REPORTS`** (today only the page is gated). Needs 3b (Delayed, workload) |
| The five KPIs | Formulas approved as D-12 |

#### Result of 3c (2026-10-09)

Both items are built, deployed and verified live (details: [changelog.md](changelog.md), re-test: [workflow-conformance.md](workflow-conformance.md) §11). No schema change, so no migration.

| Item | What was built | Decisions taken where the specification was silent |
|---|---|---|
| The five KPIs | `GET /api/reports/kpis[?projectId=]` and a *KPIs* tab: project completion, task completion, overdue, average task completion time (days) and on-time completion rate, with the counts they were calculated from | The formulas are exactly the approved D-12 / B8 table (cancelled work left out of the denominators). **A rate whose denominator is empty is `null` and shown as "—", not 0%.** Percentages carry one decimal |
| The seven named reports | `GET /api/reports/project`, `/tasks`, `/project-status`, `/task-completion`, `/overdue`, `/team-performance`, `/workload`; one tab each on the Reports page, each with its filters and an explicit *Generate* step | **Who may generate follows B8 and is enforced on the server:** Administrator all projects; anyone else only the projects where they hold `REPORT:GENERATE_REPORTS` (Owner, Team Leader, and the Project Manager through the Owner role); everyone else `403`; a project outside that set is `404` for a stranger and `403` for a member without the right. Task Completion = completed ÷ non-cancelled tasks due in the (required) date range, grouped by project, member or due month. Team Performance shows *To Do* (the B1.3 "pending"), *In Progress* and *In Review* apart. Project Status has a *Delayed* group that is calculated and overlaps the others. The Workload Report reuses the 3b classification |
| Reports page | Kept the four charts as an *Overview* tab (still computed in the browser from `/tasks`); the KPIs and the seven reports are new tabs (`?tab=`) | PDF / Excel export is optional (batch 4) and not built |

Delivery followed §2 except the backup and migration, which a change without schema needs not: `docker compose build backend frontend` and `up -d`, then verified against the running stack as `admin.system`, `pm.olivia`, `lead.owen` (200) and `dev.chen` (403 on every endpoint). Backend tests 290/290, Playwright 99/99 (run twice), ESLint clean.

### 3d. Notifications and sessions (3)

| Item | Detail |
|---|---|
| Scheduled reminders and overdue notices | A scheduled job: 3 days and 1 day before a deadline, and when overdue; to the assignee and the project Owner. The generator function exists in the database but nothing runs it |
| Remaining notification types | Comment, project update, milestone update, member added/removed; recipients per D-10 |
| Auto-logout (prototype) | Inactivity warning, then sign-out; the timeout value is still to be chosen |

### 3e. Roles (1)

| Item | Detail |
|---|---|
| Create, edit and delete extra system roles | D-14: choose their permissions from the seven; the three built-in system roles and the four project roles stay fixed |

## 6. Batch 4 — Optional features (6)

Not acceptance criteria. Build only if wanted; if shown they are labelled "Optional feature demonstration".

Kanban drag-to-move (same status rules as §15) · report export to PDF/Excel · Gantt chart prototype · document management · audit log (B10) · @mentions (undefined in both sources).

## 7. Batch 5 — Housekeeping (3 left)

| # | Item |
|---|---|
| 5.1 | ~~Delete the leftover pending `newuser` invitation~~ — **done 2026-10-08**: the invitation was already gone; the one remaining failure in `project-team.spec.js` was a stale selector (`text-danger` → the message text), fixed. The suite is 43/43 |
| 5.2 | I-21: tasks 2, 3 and 5 of PRJ-2001 are assigned to `lead.owen`, who has no PRJ-2001 membership in the live database (seed has one) |
| 5.3 | `api/openapi.yaml` is stale (documents 57 of 91 endpoints, old roles); regenerate it from the code or retire it |
| 5.4 | Run the Playwright suite in CI (it needs the Docker stack) |

## 8. Proposed order

`1 → 2 → 3a → 3b → 3c → 3d → 3e`, with batch 5 any time and batch 4 last (or never).

- Batch 1 first: small, removes visible wrong labels and closes real gaps cheaply.
- Batch 2 next: the approval step is the headline of the role model and is only half built.
- 3a before 3b/3c: the activity feed and attachments feed the dashboard and reports.
- 3c needs 3b (Delayed projects and workload are report inputs); 3d needs a scheduler.

## 9. Open questions

None blocking. Values still to be chosen when their batch starts: attachment size/type limits (D-17), the inactivity timeout (3d). (The `TODO` rename, 1.7, was done with batch 1.)
