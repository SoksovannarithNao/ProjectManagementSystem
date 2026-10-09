# Change Log

Significant changes, newest first, reconstructed from the git history (79 commits, 2026-08-27 → 2026-10-06), the merged pull requests (#8 → #44), the migration files, and the existing READMEs. There are **no git tags or release numbers** (`pom.xml` is `0.0.1-SNAPSHOT`, `frontend/package.json` is `0.0.0`, `api/openapi.yaml` declares `0.2.0`), so entries are grouped by date and pull request.

Categories: **Added** · **Changed** · **Fixed** · **Database** · **Architecture** · **Build / CI / Docs**. Commit hashes are given so each entry can be inspected with `git show <hash>`. Entries summarise the commit message; extra detail comes from the cited README/migration text. Anything inferred rather than stated is marked *(inferred)*.

---

## 2026-10-09 (batch 3c) — Change-plan batch 3c: the five KPIs and the seven named reports (uncommitted)

Implements sub-batch 3c of [change-plan.md](change-plan.md) ([assignment-brief.md](../assignment-brief.md) B8, D-12; workflow flows 31 and 32). No schema change. Deployed and verified live.

**Added**
- **Server-side reports, gated by `REPORT:GENERATE_REPORTS`:** `GET /api/reports/kpis`, `/project`, `/tasks`, `/project-status`, `/task-completion`, `/overdue`, `/team-performance`, `/workload`. Until now only the Reports page was hidden from people without the permission; the data endpoints were not. An Administrator reports on every project; anyone else on the projects where they hold the permission (Owner, Team Leader, and the Project Manager as Owner); everyone else gets `403`; a project outside that set is `404` for a stranger.
- **The five KPIs** (approved formulas, D-12): project completion rate, task completion rate, overdue rate, average task completion time (days) and on-time completion rate, each with the counts it was calculated from. A rate whose denominator is empty is `null` and shown as "—"; percentages have one decimal.
- **The seven reports**, each with its filters: Project Report (details, owner, dates, progress, milestones, team, task counts, upcoming deadlines), Task Report (project, assignee, status, priority, due range), Project Status Report (Planning / In Progress / On Hold / Completed / Cancelled / **Delayed**, owner, date range), Task Completion Report (required date range, grouped by project, member or month), Overdue Task Report (project, assignee, priority, days overdue), Team Performance Report (assigned, completed, To Do, In Progress, In Review, overdue, completion rate) and Workload Report (the 3b classification).
- **Reports page:** a tab for the *Overview* (the previous charts), the *KPIs* and each report, with an explicit *Generate* step and the scope and time the report was made.

**Changed**
- `TeamViewsService` exposes `buildWorkload(...)` so the Workload Report and the Team Workload view use the same code.

**Not built:** PDF / Excel export (optional, batch 4).

**Tests:** backend 265 → **290** (`ReportServiceTest`: access rules, the KPI formulas and their empty cases, each report's content and filters); Playwright 86 → **99** (`reports.spec.js`: the KPI numbers against a project with known tasks, 403 for a Team Member on every endpoint, 404 for a stranger, each report's filters and validation, the tabs and generating a report in the browser).

**Docs:** `change-plan.md`, `workflow-conformance.md` (§11), `issues.md`, `assignment-brief.md`, `api-reference.md`, `authentication-authorization.md`, `backend.md`, `frontend.md`, `security.md`, `testing.md`, `roadmap.md`, checklist.

---

## 2026-10-09 (batch 3b) — Change-plan batch 3b: manager views (uncommitted)

Implements sub-batch 3b of [change-plan.md](change-plan.md) (assignment-brief.md Part A, B1.3, B3.7, B3.9, D-06, D-13; workflow flows 5, 22, 30, A5). No schema change. Deployed and verified live.

**Added**
- **Dashboard statistics** from the server: `GET /api/dashboard/stats` (projects by status, Delayed, average completion, tasks by status, overdue, the five most-delayed projects) and `GET /api/activity-logs/recent`. The dashboard shows a statistics strip, a *Delayed projects* card, *Recent activity*, and — for people who may assign tasks — a *Team workload* card.
- **Delayed projects**: `ProjectResponse.delayed` and `daysDelayed`, calculated by the new `util/Derived` (end date passed and not Completed / Cancelled), never stored; a *Delayed* badge on project cards and the project page and a *Delayed* filter on the Projects page.
- **Team Tasks** (`GET /api/projects/{id}/team-tasks`, page `/projects/:id/team`): each active member with their tasks, counts and average progress, plus unassigned tasks; reassign or unassign from the list. For people with `TASK:ASSIGN` in the project (Owner, Team Leader, Administrator).
- **Team Workload** (`GET /api/projects/{id}/workload`, `GET /api/workload`, page `/projects/:id/workload`): assigned, active and overdue tasks, estimated and actual hours, and *Overloaded / Underloaded / Balanced* against the team average (D-13, `util/WorkloadClassifier`). Owners and Team Leaders appear only once work is assigned to them.
- **Project timeline** (page `/projects/:id/timeline`, every member): project, milestones and tasks on one time axis with a today marker; a task opens the usual panel.
- **Project roles in the UI**: a role picker on each member of the project page and a confirmed *Owner (transfer ownership)* option (the API already did both).

**Changed**
- `PUT /api/project-members/{id}` now enforces the rules of B3.7 / B3.9: nobody changes their own project role (the Owner stepping down still gets "Transfer ownership first"), and a Team Leader can only make a Team Member a Team Member or a Viewer and cannot touch the role of the Owner or another Team Leader.
- Three existing end-to-end specs picked "the first project card"; they now open *Website Redesign* explicitly (a test that creates a project could otherwise be listed first).

**Tests:** backend 226 → **265** (`DashboardServiceTest`, `TeamViewsServiceTest`, `WorkloadClassifierTest`, `DerivedTest`, the recent-activity feed, five role-rule cases); Playwright 76 → **86** (`manager-views.spec.js`: Delayed, dashboard figures, who may open Team Tasks / Workload, grouping, overloaded / underloaded, role rules, and five UI flows including reassigning a task, the timeline and an ownership transfer).

**Docs:** `change-plan.md`, `workflow-conformance.md` (§10), `issues.md`, `assignment-brief.md` (B1.3, B1.4, D-13, G-19), `api-reference.md`, `authentication-authorization.md`, `backend.md`, `frontend.md`, `users-and-projects.md`, `testing.md`, `roadmap.md`, checklist.

---

## 2026-10-09 (batch 3a) — Change-plan batch 3a: attachments, checklists, comment replies, project activity (uncommitted)

Implements sub-batch 3a of [change-plan.md](change-plan.md) ([assignment-brief.md](../assignment-brief.md) B1.5/B1.6, B3.4, B10, D-07, D-17). Deployed after a `pg_dump`; `V13` tried and re-run on a restored copy, and a fresh database built from `01-init.sql` + `02-seed.sql` matched the migrated copy.

**Added**
- **File attachments** on tasks and projects: `POST /api/attachments` (multipart, `file` + `taskId` or `projectId`), `GET /api/attachments/task/{id}`, `/project/{id}`, `GET /api/attachments/{id}/download`, `DELETE /api/attachments/{id}`. **10 MB per file, 25 files per task or project, an allow-list of types** (images, PDF, text, CSV, JSON, Office / OpenDocument, ZIP), content checked against the type, file names cleaned, bytes stored in the database (`attachment_contents`), downloads always `Content-Disposition: attachment` with `nosniff` and a sandboxing CSP, available only to members. The uploader may always delete their own file; the Owner and Team Leader may delete any.
- **Checklists:** `GET /api/checklist-items/task/{id}`, `POST`, `PUT /{id}`, `DELETE /{id}`. A task's progress now counts checklist items together with its subtasks (D-07), kept by the trigger `trg_checklist_items_sync_parent_task`; a completed task whose subtasks are all done stays 100. `TaskResponse` gains `totalChecklistItems` and `completedChecklistItems`.
- **Comment replies in the UI** (threaded under the comment, "Replying to…" on the composer) and a server check that a reply's parent belongs to the same task.
- **Project activity feed:** `GET /api/activity-logs/project/{id}?limit=` (newest first, 50 by default, at most 200) and an *Activity* card on the project page. New events: project created / updated (naming what changed) / completed, milestone created / completed, comment and reply added, file uploaded. `ActivityLogResponse` gains `taskId` and `taskTitle`.
- **Permissions:** two resources, `ATTACHMENT` (Owner / Team Leader: view, create, delete; Team Member: view, create; Viewer: view) and `CHECKLIST_ITEM` (Owner / Team Leader: view, create, edit, delete; Team Member: view, create, edit on tasks assigned to them; Viewer: view). The Roles & Permissions page shows them; the matrix grows from 163 to 198 rows.

**Fixed**
- **nginx refused request bodies over 1 MB** (its default), so profile photos up to the documented 5 MB failed in the Docker deployment. The API location now allows 12 MB; the 5 MB photo limit is checked in `UserService.uploadOwnProfilePhoto` (the multipart ceiling is now 10 MB), and the "file too large" message no longer claims 5 MB for every upload.

**Database — migration `V13__attachments_checklists.sql`** (idempotent): resources `ATTACHMENT` and `CHECKLIST_ITEM` in the `role_permissions` check and their grants; `attachments.file_url` made optional and the new table `attachment_contents`; `checklist_items.created_by`; `fn_compute_task_progress_from_subtasks(task, status)` counting checklist items (the old one-argument function is dropped) and the `checklist_items` trigger; grants for the application role. `01-init.sql`, `03-app-role.sh`, CI, the Flyway baseline (now 13) follow.

**Tests:** backend 175 → **226** (`FileTypeGuardTest`, `AttachmentServiceTest`, `ChecklistItemServiceTest`, `CommentServiceTest`, `ActivityLogServiceTest`, project / milestone feed events, the photo limit, the matrix test now reads `V10` and `V13`); Playwright 66 → **76** (`collaboration.spec.js`: upload / list / download headers / delete rules, type, content and size checks, checklist rules and progress, replies, the project feed and outsider access, the Viewer, three UI flows).

**Docs:** `change-plan.md`, `workflow-conformance.md` (§9), `issues.md`, `assignment-brief.md`, `api-reference.md`, `authentication-authorization.md`, `backend.md`, `database.md`, `frontend.md`, `security.md`, `tasks.md`, `testing.md`, `roadmap.md`, `overview.md`, `PRODUCT.md`, checklist, README.

---

## 2026-10-09 (batch 2) — Change-plan batch 2: the task approval workflow (uncommitted)

Implements Batch 2 of [change-plan.md](change-plan.md) ([assignment-brief.md](../assignment-brief.md) B3.8, project-workflow A6, D-05). Deployed after a `pg_dump`, with `V12` first tried (and re-run) on a restored copy of the live database; verified live.

**Added**
- **Approval records and a designated approver.** A task in review has an open request; an approver decides **Approved** (the task is completed, progress 100), **Changes requested** (back to In Progress) or **Rejected** (In Progress or Cancelled, the approver's choice). Changes and rejection need a comment. A task may name its approver (needs `ASSIGN`); then only that person, the project Owner or an Administrator decides. Nobody decides their own work (asked for the review, or assigned to the task) except the Owner and Administrators.
- **API:** `POST /api/tasks/{id}/approval/submit`, `POST /api/tasks/{id}/approval/decision`, `GET /api/tasks/{id}/approvals`, `PUT /api/tasks/{id}/approver`, `GET /api/approvals/pending`; `TaskResponse` gains `approver`, `approvalStatus`, `approvalRequestedBy`, `approvalRequestedAt`.
- **Activity and notifications for every request and decision:** actions `TASK_APPROVAL_REQUESTED`, `TASK_APPROVED`, `TASK_CHANGES_REQUESTED`, `TASK_REJECTED`, `TASK_APPROVER_SET`; notification types `APPROVAL_REQUESTED` (named approver, otherwise every active member who may approve) and `APPROVAL_DECIDED` (the requester). Notifications produced: 4 → 6 of 11 types.
- **UI:** an *Approval* section in the task panel (submit for review, awaiting-approval banner, Approve / Request changes / Reject with a comment, approver picker, history), an *Awaiting approval* / *Changes requested* chip on Tasks and Kanban, and an *Awaiting your approval* inbox on the Tasks page.

**Changed**
- Completing a task through `PUT /api/tasks/{id}` still needs `TASK:APPROVE`, now also follows the who-may-decide rules and is recorded as the approval (an approver who completes a task directly counts as approving it). Moving a task into review through the edit opens a request; moving it out of review withdraws the open request (`WITHDRAWN`). Moving a task to another project clears its approver.
- The quick-advance circle and the status dropdown only offer *Completed* to someone who may decide that task; an approver working on their own task submits it for review instead.

**Database — migration `V12__task_approval_workflow.sql`** (idempotent): `tasks.approver_id`; table `task_approvals` (one open request per task, enforced by a partial unique index); the `activity_logs.action` and `notifications.type` constraints widened; the 6 tasks already `IN_REVIEW` get an open request; grants for the application role. `01-init.sql`, `02-seed.sql`, `03-app-role.sh`, CI, the Flyway baseline (now 12) and `verify_invariants.sql` (two new checks: an open request only on a task in review; every task in review has one) follow.

**Tests:** backend 143 → **175** (`TaskApprovalServiceTest` 27; five new `TaskServiceTest` cases for the status hooks); Playwright 57 → **66** (`approvals.spec.js`: member submits → Team Leader requests changes → approves → project progress moves; rejection; own work; named approver; direct completion and withdrawal; open subtask; two UI flows).

**Docs:** `change-plan.md`, `workflow-conformance.md` (§8), `issues.md`, `assignment-brief.md` (B3.8, B9, G-08, D-05), `api-reference.md`, `authentication-authorization.md`, `backend.md`, `database.md`, `frontend.md`, `notifications.md`, `tasks.md`, `testing.md`, `roadmap.md`, ADR-0015, checklist, overview, PRODUCT.

**Also noticed:** `verify_invariants.sql` query 3 (I-21) now returns no rows on the live database.

---

## 2026-10-09 (batch 1) — Change-plan batch 1: seven quick fixes, `TODO` rename (uncommitted)

Implements Batch 1 of [change-plan.md](change-plan.md). Deployed to the running stack after a `pg_dump`, with `V11` first tried (and re-run) on a copy of the live database; verified live.

**Fixed / Changed**
- **Unknown API paths answer `404 "Resource not found"`**, not `500` with a stack trace (`GlobalExceptionHandler.handleNoResource`) — closes I-22.
- **Labels:** Kanban columns, Tasks groups, the Dashboard overview and the status filters say *To Do / In Progress / In Review / Completed*. The Tasks page now has one group per status (To Do, In Progress, In Review, Completed, Cancelled) instead of To do / Doing / Done.
- **Assignment notification** now reads `<assigner> assigned you to "<task>" in "<project>" — due <date>` (task, project, due date, who assigned it).
- **Sign in with username or e-mail** (`UserService.resolveLoginIdentifier`, `UserRepository.findByEmailIgnoreCase`); the form label is "Username or email" — closes X-02.
- **Own position and department:** the Profile page offers the managed lists; `PUT /api/users/me` accepts `positionId` / `departmentId` (`null` clears, an unknown id is `404`). The Team-page endpoint refuses self-targeting with a message pointing to Profile. (D-16)
- **Project filters** (status, priority, project manager) and **sorting** (name, start, end, priority, progress); **task filters** (status, assignee, due date) and sorting (latest, progress, status added); search widened (manager, status, dates, assignee). Done in the browser over the permission-scoped lists; server-side parameters remain open (brief G-16).
- **Stored status `TO_DO` → `TODO`** (D-15): entities, request patterns, `01-init.sql`, `02-seed.sql`, frontend, tests and docs; the label stays "To Do" (`TextFormat.humanizeEnum` and the frontend `humanizeEnum` special-case it; `NotificationService` now uses the shared helper).

**Database — migration `V11__rename_status_to_do_to_todo.sql`** (idempotent): drops the two `CHECK` constraints that list `TO_DO`, sets the new defaults, rewrites 26 tasks and 77 subtasks with the user triggers switched off (so `updated_at` and progress are untouched), re-adds the constraints and re-creates `v_team_workload`. `init/04-flyway-baseline.sql` now writes version 11. An earlier draft used `SET LOCAL session_replication_role`; the trial run showed Flyway did not honour it (rows got a new `updated_at`), so it was replaced by `ALTER TABLE … DISABLE/ENABLE TRIGGER USER` before anything touched the live database.

**Tests:** backend 130 → **143** (unknown path → 404; e-mail resolves to username; own position/department; assignment-notification text; `TextFormat`); Playwright 43 → **57** (`batch1.spec.js`). A `data-testid="task-row"` was added to the Tasks page rows.

**Docs:** `change-plan.md`, `workflow-conformance.md` (§7), `issues.md` (I-22, X-02 fixed; I-20 updated; F-24 … F-26), `assignment-brief.md` (B1.2, B1.9, B13.1: G-07, G-11, G-16, G-17; D-15, D-16), `api-reference.md`, `authentication-authorization.md`, `backend.md`, `database.md`, `frontend.md`, `notifications.md`, `tasks.md`, `testing.md`, `users-and-projects.md`, `roadmap.md`, ADR-0013/0015, checklist, README.

---

## 2026-10-08 (roles v10) — Two-level roles implemented: system roles and project roles (uncommitted)

Implements [ADR-0015](adr/0015-two-level-roles-system-and-project.md) and the approved specification ([assignment-brief.md](../assignment-brief.md) Part B). The earlier four-role model (`TEAM_LEADER` and `TEAM_MEMBER` as system roles) is replaced.

**Database — migration `V10__two_level_roles.sql`** (idempotent; applied to the live database after a `pg_dump`, tested first on a fresh volume and on a copy of the live data)
- System roles `ADMINISTRATOR`, `PROJECT_MANAGER`, `USER`; project roles `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`. `TEAM_LEADER` / `TEAM_MEMBER` removed (their accounts became `USER`); owners made Project Managers.
- Matrix rewritten (163 rows): a Team Member no longer creates tasks or deletes subtasks; Owner and Team Leader generate reports for their project; Project Manager keeps project creation and cross-project reports; a Team Leader may delete everything except the project (D-01).
- **Exactly one owner per project**: the V8 "at least one owner" trigger is replaced by the deferred `trg_project_members_single_owner`, which is skipped when the project is being deleted — **fixes I-19** (a project with a single owner could not be deleted).
- `init/01-init.sql` and `02-seed.sql` mirror the end state; new `init/04-flyway-baseline.sql` writes a Flyway baseline row at version 10 so a fresh volume does not replay `V9`; two new checks in `verify_invariants.sql`. Fixed `03-app-role.sh` having been saved with CRLF line endings (a fresh container could not run it).

**Backend**
- New `ProjectOwnership`: the one place that makes someone the owner (creating a project, an administrator naming another manager, a transfer). The new owner must be an active member who is a Project Manager or Administrator; the previous owner becomes `ADMIN`.
- `ProjectMemberService`: nobody is invited or added as `OWNER`; setting a member's role to `OWNER` transfers ownership; the owner cannot be demoted or removed directly. `UserService`: new accounts are `USER`; a person who owns a project cannot be moved to `USER`. `SubtaskService`: a Team Member edits only subtasks of tasks (or subtasks) assigned to them; deleting a subtask needs `SUBTASK:DELETE`.

**Frontend:** the add-member dialog defaults to User; the invite picker no longer offers Project Manager; Reports (link and route) are available through the system role *or* the role in any project (a Team Leader sees them); the Roles & Permissions page shows business labels (Owner = Project Manager of the project, Admin = Team Leader, Member = Team Member) and the project-level Reports grant; the manager picker lists only people who can own projects.

**Tests:** backend 113 → **130** (`ProjectOwnershipTest`, matrix test now reads `V10`, ownership/transfer/refusal cases, subtask limits, role-assignment guard); Playwright 40 → **43** (ownership transfer and single-owner delete, Team Member limits, Team Leader opens Reports). All 43 pass: the six `project-team.spec.js` cases that failed or were skipped are fixed (one stale CSS selector in a test; the leftover `newuser` invitation they assumed was already gone).

**Docs:** `authentication-authorization.md`, `database.md`, `backend.md`, `api-reference.md`, `users-and-projects.md`, `setup.md`, `testing.md`, ADR-0014/0015, checklist, issues (I-19 fixed; I-21, I-22 added), roadmap, and the brief's §B13.1 updated to the implemented model.

**Data repair:** my earlier test clean-up had left orphaned rows (activity-log entries, notifications, tasks of deleted test projects); they were removed and every foreign key re-scanned clean.

**Not done yet:** the approval workflow, creating extra system roles, own position/department, the `TO_DO` → `TODO` rename, and the missing required features ([workflow-conformance.md](workflow-conformance.md)).

---

## 2026-10-08 (test) — Live workflow conformance test; no code changed (uncommitted)

The running application was tested against [project-workflow.md](../project-workflow.md) and the approved specification: 79 API checks, a UI sweep of 10 screens and a source check. Result: of 44 application flows **12 pass, 22 are partial, 10 are missing**. Full table and the ranked differences: [workflow-conformance.md](workflow-conformance.md). Also found: unknown API paths return `500` instead of `404`; the UI says "Done"/"Review" where the specification says Completed/In Review. One clean-up mistake of mine (orphaned test rows) was repaired; two older orphaned test notifications still break `GET /api/notifications` for two seed users and await permission to delete.

---

## 2026-10-08 (specification) — Requirements resolved on paper; no code changed (uncommitted)

The assignment and the project workflow disagreed with each other in 18 places and left many rules undefined. They were resolved **before any further code**, and the project owner approved 18 decisions (D-01 … D-18).

**Added (documentation only)**
- [assignment-brief.md](../assignment-brief.md) **Part B — Resolved Specification**: contradiction log, definitions (statuses, overdue / active / pending / delayed, progress, subtask vs checklist, milestone, dependency, priority, search/filter/sort), feature classification (REQUIRED / OPTIONAL / UNDEFINED), non-functional requirements, the two-level role model and the permission matrix, approval workflow, data model, API requirements, the seven reports and five KPIs, notification and logging rules, acceptance criteria, known gaps and decisions. Part A (the assignment as received) is unchanged.
- [project-workflow.md](../project-workflow.md) rewritten: roles and statuses standardised, optional flows labelled, and nine supporting flows (A1–A9: registration, change password/logout, session management, task dependencies, project timeline, task approval, audit log, Gantt, documents).
- [ADR-0015](adr/0015-two-level-roles-system-and-project.md): the **target** role model — system roles `ADMINISTRATOR` / `PROJECT_MANAGER` / `USER`, project roles `OWNER` / `ADMIN` / `MEMBER` / `VIEWER`, one owner per project, Team Leader and Team Member as labels for `ADMIN` and `MEMBER`.

**Changed (documentation)**
- ADR-0014 is marked as the implemented model whose role set is to be replaced; [authentication-authorization.md](authentication-authorization.md) now opens with a "target vs. current" table; the checklist, issues (I-20), roadmap (§3a) and the requirement links in PRODUCT, overview and the docs README point to the new documents. Roles, permissions and approval moved from *Done* back to *Partially done* in the checklist because the application does not yet match the approved model.

**Decisions of note:** a Team Leader may delete everything except the project (D-01); a system role never widens a project role (D-02); only Project Managers and Administrators may own projects (D-03/D-04); every task needs approval (D-05); Team Members do not create tasks; checklist items count toward task progress (D-07); users edit their own position and department (D-16); administrators can create extra system roles (D-14).

**Not done:** no code, migration or test was changed. The application still follows ADR-0014; the work list is [roadmap.md](roadmap.md) §3a and brief §B13.1.

---

## 2026-10-08 (latest) — Four roles, seven permissions and a real permission matrix (uncommitted)

Brings the application in line with `Role_Requirment.md`: Administrator, Project Manager, Team Leader and Team Member, the permissions View / Create / Edit / Delete / Assign / Approve / Generate Reports, and a Role & Permission and a User & Role screen. Decision record: [ADR-0014](adr/0014-requirement-roles-and-permission-matrix.md) (partly supersedes ADR-0002).

**Added**
- **A data-driven permission matrix.** `role_permissions` now holds *(role, permission, resource, scope)* rows (164 of them) and **both the API and the UI read it**; before, the table existed but nothing used it and the rules were hard-coded twice (Java and JavaScript). `PermissionService` keeps an in-memory snapshot (refreshed after every edit); `ProjectAccessGuard` answers through it; the project-scoped model, the `404` for non-members and the ownership rules (comment author, assignee-only status, last owner) are kept.
- **Roles:** `PROJECT_MANAGER`, `TEAM_LEADER`, `TEAM_MEMBER` as system roles and as project roles (`OWNER`→Project Manager, `ADMIN`→Team Leader, `MEMBER`→Team Member), plus the project-only `VIEWER`. New accounts are Team Members.
- **Approval gate (`APPROVE`):** only Project Managers, Team Leaders and Administrators can set a task `COMPLETED`; Team Members submit work for review (`IN_REVIEW`, "Submit for review" / "Awaiting approval" in the UI).
- **Create a project (`PROJECT:CREATE`)** is limited to Project Managers and Administrators (checklist risk R-1 resolved).
- **Generate Reports (`REPORT:GENERATE_REPORTS`)** (Project Manager, Team Leader, Administrator) gates the Reports page, its route and its sidebar link. There are still no server-side report endpoints, so this is a UI-level gate only.
- **API (4 endpoints, 87 → 91):** `GET /api/users/me/permissions`, `PUT /api/users/{id}/role`, `GET /api/permissions/matrix`, `PUT /api/roles/{id}/permissions`. `POST /api/project-members/invite` accepts an optional `projectRole`.
- **UI:** *Administration → Users* (give each account a role) and *Administration → Roles & Permissions* (the role × resource × action grid, editable with Save / Discard; the Administrator role is read-only); a role picker in the invite form; `RequirePermission` route guard. Controls a user cannot use are **hidden, not disabled** across Tasks, Kanban, Calendar, Dashboard, Project detail, the task panel, Team and the position/department "+ Add New".
- **Specific `403` messages** (for example *"Only a Project Manager or an Administrator can create a project"*).
- **Guardrails:** the Administrator role is locked; a project role cannot lose `PROJECT:VIEW`; built-in roles cannot be renamed or deleted; the last Administrator cannot be demoted; a project-only role cannot be given to an account.

**Changed**
- `USER` role removed; the JWT `role` claim now carries one of the four names. `@PreAuthorize("hasRole('ADMINISTRATOR')")` replaced by `@permissions.require(authentication, 'RESOURCE', 'ACTION')`.
- `frontend/src/api/permissions.js` no longer contains any role names or rules; it only turns the server's permission list into `can` / `canSys` / `canAny`.
- Invite dialog and *Add member* use the four roles; *Add member* defaults to Team Member and offers no project-only role.

**Database**
- **Migration `V9__requirement_roles_and_permissions.sql`** (idempotent): `roles.scope / project_role / built_in`, `role_permissions.resource / scope`, the 164-row matrix, backfill of every account's role (owners → Project Manager, project admins → Team Leader, everyone else → Team Member), `USER` removed, grants for `taskmanager_app`. `01-init.sql` and `02-seed.sql` mirror the end state for fresh volumes.
- **Flyway now runs with Docker Compose:** a one-shot `migrate` service (baseline 8, then `V9`) runs before the backend (`depends_on: service_completed_successfully`), so existing volumes — which never re-run `database/init/` — are upgraded. Applied to the live database on 2026-10-08 after a `pg_dump` backup.
- `03-app-role.sh` and the CI grant list now match (17 read-write tables plus `SELECT` on `permissions`), closing the drift noted in X-05.

**Fixed**
- "+ Add New" position/department is hidden from people who cannot create them (was X-01).
- Built-in roles can no longer be renamed or deleted through the roles API (was I-10).

**Found, not fixed**
- **I-19:** a project whose only active owner is one person cannot be deleted — the V8 owner-integrity trigger blocks the cascade. Present before this change; documented in [issues.md](issues.md).

**Tests:** backend 67 → 113 (`PermissionServiceTest` checks every role × resource × action of the V9 matrix; guard, matrix-editing, role-assignment and invite-role tests). Playwright 33 → 40 (`roles-permissions.spec.js`: API and UI per role). Live checks per role after the migration passed (see [authentication-authorization.md](authentication-authorization.md#52-project-scope-matrix)).

**Docs:** [ADR-0014](adr/0014-requirement-roles-and-permission-matrix.md); [authentication-authorization.md](authentication-authorization.md) rewritten for the new model; `database.md`, `api-reference.md` (91 endpoints), `backend.md`, `frontend.md`, `setup.md`, `security.md`, `architecture.md`, `tasks.md`, `testing.md`, `issues.md`, `users-and-projects.md` and the checklist updated.

---

## 2026-10-08 (later) — Folder READMEs merged into `docs/`, requirements checklist (uncommitted)

**Changed (documentation structure)**
- **Removed** `api/README.md`, `backend/README.md`, `frontend/README.md` and `database/README.md`. `docs/` is now the only place for project documentation; the team no longer has to update a README and `api/openapi.yaml` alongside the code, only the matching `docs/` page.
- **Added** [backend.md](backend.md) (stack, run, structure, endpoint groups, security reasoning, logging, invitations, task rules, notifications, status, next steps) and [frontend.md](frontend.md) (stack, scripts, structure, routes, behaviours, time tracking, design tokens, end-to-end tests).
- **Extended** [database.md](database.md) with the content only the database README had: running, connecting and inspecting (§11), deliberate design decisions including progress, overdue and report rules (§12), authorization and the unused permission tables (§13), API/backend coverage (§14), and the Flyway layout, migration rules and CLI command (§8.1, §8.2). Corrected `work_logs` (now implemented) and the grant list (16 tables).
- **Extended** [api-reference.md](api-reference.md) with "Behaviour worth knowing" and "Known quirks" (from `api/README.md`) and a new §18 on the legacy `openapi.yaml`; counts corrected to 87 endpoints and 18 controllers.
- **Updated** [README.md](README.md): new entries in the contents, a "Where the old folder READMEs went" map, and the rule "change behaviour → update `docs/`".
- **Re-linked** every reference to the removed READMEs: the root `README.md` (41 links), `docs/` pages and decision records, comments in six Java files, `database/init/01-init.sql`, `03-app-role.sh`, `.env.example` and `api/openapi.yaml`. The historical migration files `V1`–`V8` were deliberately not edited (a migration's checksum must not change) and still mention the old README in comments.
- Corrected statements that had gone stale: tests (60 → 67 backend, 30 → 33 Playwright), "work logs not implemented", entity count (15 → 16).
- `api/openapi.yaml` header now says it is partly out of date and **no longer maintained**; [api-reference.md](api-reference.md) is the reference. Review of 2026-10-08: 57 of 87 endpoints documented, 30 missing, 23 mentions of removed roles, 6 drifted schemas, no `operationId`s.

**Added (requirements audit)**
- [checklist/](checklist/done.md): `done.md` (25), `partially_done.md` (33), `not_done.md` (11), `not_fully_satisfy.md` (20 items and 7 risks) and `unclear.md`, from an audit of the code against `Role_Requirment.md` (completion about 60%). "User Functions" was resolved (the permission matrix exists); debugging and the final presentation were taken out of scope.

---

## 2026-10-08 — Time tracking, accessibility and mobile pass (uncommitted)

**Added**
- **Time tracking:** `WorkLog` entity, `/api/work-logs` (list by task, create, delete), `TaskResponse.actualHours`, and a *Time tracking* section in the task panel with estimated-vs-logged summary, a persistent start/stop timer, a manual entry form and an entry list; `1h 30m / 13h` chips on task rows and board cards. The estimate field now accepts hours, minutes or 8-hour days. `WorkLogServiceTest` (7) and Playwright `time-tracking.spec.js` (3). See [tasks.md](tasks.md#time-tracking-estimated-vs-actual).
- Design documents: [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md).

**Changed (frontend)** — dark-mode charcoal inversion and `on-charcoal` tokens, darker text and status colours for contrast, a global focus ring, `prefers-reduced-motion`, a shared `.field` input class, a `.hit-area` tap-target helper, a two-row dashboard (hero and duplicate Kanban preview removed; the list is now "Due & Overdue"), Reports axis labels, Team list scrolls inside its card, Calendar phone dots, 26px minimum avatar. Details and the remaining items are in [DESIGN.md](DESIGN.md#known-drift).

**Database** — `database/init/03-app-role.sh` now grants the application role `work_logs`. A database created before this change needs the same grant applied once (`GRANT SELECT, INSERT, UPDATE, DELETE ON work_logs TO taskmanager_app;`), otherwise `GET /api/tasks` fails with `permission denied for table work_logs`.

---

## 2026-10-06 (later) — Security and permission fixes (uncommitted)

**Fixed (security)**
- **User lookups are scoped:** `GET /api/users/{id}` and `/api/users/username/{username}` return a user only to an administrator, the user themself, or someone sharing an active project; everyone else gets the same `404` as for a missing user. *(was I-01)*
- **Membership lookups are scoped:** `GET /api/project-members/user/{userId}` returns only active memberships in projects the caller belongs to (administrators see all). *(was I-02)*
- **No more cross-project moves:** `PUT /api/tasks/{id}` and `PUT /api/milestones/{id}` need manage rights on the **target** project when `projectId` changes; `PUT /api/project-members/{id}` can change only the role (a different project/user is `400`). *(was I-03, I-05)*
- **`VIEWER` is read-only:** creating/editing/deleting subtasks and adding comments need content-edit rights; an assigned `VIEWER` can no longer change a task's status. The task panel hides the comment box and subtask controls from viewers. *(was I-04, I-07)*
- **Deactivated accounts lose access immediately:** every authenticated request checks the account is still `ACTIVE` while the JWT is decoded (`ActiveAccountJwtValidator`, one status-only query per request); suspended, inactive, pending or deleted accounts get `401`. *(was I-06)*

**Fixed (tests)** — the *Add-member picker* e2e test deleted the seeded `dev.tomas` invitation on each run; it now removes only the invitation it sent (the seed row was restored).

**Added** — `ActiveAccountJwtValidatorTest` (5), `TaskServiceTest` (6), `MilestoneServiceTest` (2), `ViewerWriteAccessTest` (6), extra cases in `UserServiceTest` (+5) and `ProjectMemberServiceTest` (+6); Playwright `permissions.spec.js` (9). Backend total 30 → **60**, Playwright 21 → **30**.

**Changed (API behaviour)** — `UserService.getUserById/getUserByUsername` and `ProjectMemberService.getProjectsByUserId` now take the caller's username; `UserRepository.findAccountStatusByUsername` added. Clients that relied on reading arbitrary users (the frontend does not — it only loads the logged-in user) will now see `404`.

**Docs** — `issues.md`, `security.md`, `authentication-authorization.md`, `api-reference.md`, `users-and-projects.md`, `tasks.md`, `testing.md`, `roadmap.md`, ADRs 0001–0004 and the READMEs updated to match.

---

## 2026-10-06 — Invitations, password UX, My Tasks, Java 25 (commits `52a93b4`, `115d52a`; docs uncommitted)

**Added**
- Live **password-requirements checklist** on Register, Profile → Password and *Invite Member*, with specific error messages; backend field errors are surfaced instead of the generic "One or more fields are invalid". Login deliberately unchanged.
- **Auto-generated project codes** (`PRJ-####`); the code field was removed from *New Project* and is read-only on Edit. *New Project* now opens as a right-side drawer matching *New Task*.
- **Add member** on the project page, with a debounced, database-backed **invitable-user search** across the whole organisation (`GET /api/project-members/project/{id}/invitable-users`).
- **Pending-invitation count** endpoint (`GET …/invitations/count`) and a corrected "N pending invitations" line (managers only).
- **My Tasks** is now a filter on the Tasks page; the sidebar entry and page title are renamed **Tasks**.
- Team page hides *Invite to team* for inactive/suspended users and explains why.
- Backend tests: `ProjectServiceTest` (7), `ProjectMemberServiceTest` (12), 3 new `GlobalExceptionHandlerTest` cases. Playwright: `project-team.spec.js` (9), `team.spec.js` (6).

**Changed**
- Inactive, suspended and unverified accounts can no longer be invited or directly added to a project (enforced in the backend).
- `projectCode` is optional in `ProjectRequest`; blank on update keeps the existing code.
- `PendingInvitationCountResponse` / `InvitableUserResponse` DTOs added; `InvitableUserResponse` is deliberately narrow (no email/phone).

**Fixed**
- Duplicate project code now returns a clean **`409 "Project code already exists."`** (new `ConflictException`, plus a safety net for the `projects_project_code_key` constraint) instead of the raw PostgreSQL message.
- "N pending invitations" always counted zero because it was derived from the active-members list.
- `projects.spec.js` selector `getByText(/^Tasks/)` matched both the sidebar link and the project heading.

**Architecture / Build**
- **Java 21 → 25** (`52a93b4`, produced by the automated upgrade recorded in `.github/modernize/java-upgrade/20261006031004/`): `pom.xml`, CI (Temurin 25), both Dockerfiles, READMEs. Compilation passed; the upgrade run's baseline had 7 of 8 tests passing with the database-dependent context test failing for lack of a local database (same before and after). A scan of 14 direct dependencies found no known CVEs.
- `api/openapi.yaml` gained the two new endpoints and the `409` response.

**Docs (this change, not yet committed)** — new `docs/` folder (setup, overview, architecture, authentication & authorization, users & projects, tasks, notifications, database, API reference, security, testing, issues, roadmap, this changelog, decision records); corrections to the root, backend, frontend, database and API READMEs and a banner on `openapi.yaml`.

---

## 2026-09-17 — PR #44 `project/update_Task_Project_kenban_pages` (`5aab491`, `8f7048d`)

**Changed** — Task, Project and Kanban pages refreshed (16 files: pages, UI primitives, `TaskDetailPanel`/`TaskFormModal`-area components, styles).

## 2026-09-15 — PR #43 `project/polishing_taskpage` (`14ef3d9`, `57adf57`, `727f010`)

**Added**
- **Activity log** (per task): `activity_logs` entity/service/controller, `GET /api/activity-logs/task/{taskId}`, an Activity section in the task panel. (`727f010`)
- **Task dependencies** in the UI and API with **blocked-task** detail (the blocking task is named, a lock icon with tooltip, a Blocked Kanban column) and **overdue** tracking (computed flag, badge). (`727f010`, `57adf57`)
- **Project detail page** (status/priority/dates/manager/progress, filterable task list, members, milestones). (`57adf57`)
- **Playwright end-to-end suite** (`auth.spec.js`, `projects.spec.js`, helpers, config) — first frontend tests. (`57adf57`)

**Fixed** — task/subtask **completion consistency**: a task cannot be completed with open subtasks; subtask-derived task progress; consistency triggers added to the schema. (`727f010`)

**Docs** — all READMEs refreshed. (`57adf57`)

## 2026-09-14 — PRs #41 `project/mod_profile_pages`, #42 `project/polishin_frontend_and_update_role/permission` (`35c6daf`, `9f0a872`)

**Architecture — authorization moved from global roles to per-project roles** (`35c6daf`): every project/task permission now comes from `project_members.project_role` (`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`), checked in `ProjectAccessGuard`; `users.role_id` became optional and the system roles shrank to `USER` and `ADMINISTRATOR`. See [ADR-0002](adr/0002-project-level-authorization.md).

**Database** — `V5__project_scoped_authorization.sql`; `V6__store_profile_photo_in_database.sql` (photo bytes + random token in `users`); later in the same PR `V7__add_default_global_user_role.sql` (the `USER` role) and `V8__enforce_project_owner_integrity.sql` (trigger: a project always keeps an active owner). (`9f0a872`)

**Added** — profile/settings pages reworked; project **ownership rules** (last-owner protection in service and database); task/subtask completion validation; UI fixes. (`9f0a872`)

## 2026-09-13 — PRs #38 `project/front_integration`, #40 `project/integration_newdbtable` (`5170e6a`, `5f21740`, `87ccf00`)

The largest day in the history (three commits, ~170 files changed).

**Architecture / Security** — **project-membership data isolation**: task, project, milestone, assignee, member and dependency reads are scoped to the caller's active memberships (administrator sees all), via the new `ProjectAccessGuard`. (`5170e6a`, `87ccf00`)

**Added** — **self-registration with emailed OTP** (`OtpService`, `MailService`, `Register`/`VerifyOtp` pages, Mailpit in Docker Compose, `V3` migration) and the shared **password policy** and change-password endpoint (`5170e6a`); **positions and departments**, **subtasks**, **comments** and the **team-invitation workflow** (`V4` migration, `TeamInviteRequest`, accept/decline) (`87ccf00`); **login rate limiting** (`LoginRateLimiter`) and the **least-privilege database role** `taskmanager_app` (`03-app-role.sh`, compose/env wiring) (`5f21740`, `5170e6a`).

**Database** — the old database layer was **replaced with the new schema** and the backend/frontend re-integrated against it (73 files changed in `87ccf00`; 25 in `5f21740`).

## 2026-09-12 — PRs #35 `database/Harden_database`, #36 `project/update_CIworkflow` (`b692d3b`, `586a834`)

**Database** — hardening: `permissions`/`role_permissions`, **auto-derived project/milestone progress**, dependency-order and assignment-integrity triggers, **overdue view and function**, **reporting views**, `report_exports`, `kpi_snapshots` (`V2__add_permissions_progress_and_integrity_rules.sql`). (`b692d3b`)

**Build / CI** — CI now **fails when `database/verify_invariants.sql` returns rows**. (`586a834`)

## 2026-09-10 — PR #34 `project/wire_function` (`8416ac9`, `52f08b7`, `dfbec1a`, `31ae2ff`)

**Added** — frontend **wired to the real backend** (11 API modules, pages fetch live data); **notifications** (entity, service, controller, bell UI) and **settings**; **file logging** to `backend/logs/log.txt`. (`8416ac9`, `52f08b7`)

**Fixed** — **database trigger errors** surfaced as `500`: validation triggers now raise with `ERRCODE '23514'` so they map to a readable `400`; the seed's login hash corrected so seeded accounts can log in. (`52f08b7`, `8416ac9`)

**Docs** — notifications, settings and the trigger error-code fix documented. (`dfbec1a`)

## 2026-09-09 — PRs #30 `database/flyway-migrations`, #33 `backend/security-and-dto-hardening` (`3a90be9`, `27c9aca`, `d79566e`)

**Security** — backend hardening: **role checks, DTOs on every endpoint, BCrypt password hashing, restricted CORS, request validation**, global exception handler (50 files). (`27c9aca`)

**Database** — expanded schema, **seed data** (`02-seed.sql`) and the **Flyway project** with the `V1` baseline migration. (`3a90be9`)

## 2026-09-08 — PRs #23–#29

**Added** — **authentication foundation** and **JWT login** (`062034f`, `d3a49b5`, PR #25, #29); UI update and **migration of styling to Tailwind CSS** (`f5c9f12`, `4bf2131`, PRs #23, #24); **Docker Compose** stack and CI/CD workflow (`c2a0209`, PR #27); frontend lint fix in CI (`6989966`).

## 2026-09-01 → 2026-09-07 — PRs #14–#21

**Added** — backend **security configuration** (`a20b7a7`), **entities, repositories, services and controllers** (30 files, `4a631da`, PR #20/#21); **database setup 2.0** with Docker and `.env.example` (`a4b92f7`, PR #18); frontend UI updates (`365d2bb`, PR #14); UI placeholder pending a new design (`a403057`); an **ERD design** (`database/erd-design/erd.md`, 579 lines) committed in `c9e1391` and removed again in `541ea49` ("remove db sub folder"); CD workflow and Tailwind configuration (`dfea1c1`). Markdown/documentation updates (`11b4738`, PRs #15, #16).

## 2026-08-27 → 2026-08-31 — Project start (PRs #8–#13)

**Added** — repository created with `Role_Requirment.md` (`5f8edae`, `1d37570`); `Contributing.md` and the git workflow (`d25ac74`, `e6f9a98`, `efa48a1`); GitHub **agent definitions** under `.github/agents/` (`f592d12`, `bd78088`); `.gitignore` (`5377a48`); **frontend scaffold** React + Vite (`4b91d27`); **database setup** scripts (`6e03427`, `261f2be`); **backend initialisation and health endpoint** (`5f597b5`, `a725975`); UI setup (`661fb8a`).

---

## Schema change history (from the migration files)

| Version | Introduced |
|---|---|
| V1 | Baseline: users, roles, projects, members, milestones, tasks, assignees, dependencies, subtasks, checklist items, comments, attachments, work logs, notifications, activity logs |
| V2 | Permissions tables; derived progress; dependency/assignment/milestone rules; overdue view and function; reporting views; `report_exports`; `kpi_snapshots` |
| V3 | Registration OTP and `PENDING_VERIFICATION`; theme and notification preferences |
| V4 | Positions and departments; invitation columns on `project_members`; new notification types |
| V5 | Project-scoped authorization (`role_id` nullable; `OWNER`/`ADMIN`/`MEMBER`/`VIEWER`; old global roles removed) |
| V6 | Profile photo stored in the database with a public token |
| V7 | `USER` role |
| V8 | Last-owner integrity trigger |
| *(init only)* | Task/subtask completion-consistency triggers and functions exist in `01-init.sql` but have **no migration** — see [database.md](database.md#8-migrations-vs-the-init-script) |

## Contributors seen in the history

Commit authors, as recorded by git: Sovannarith, Henze (also `henze`), Skyee (also `Skyeezz`), Kheng David; plus an automated upgrade co-author on `52a93b4`. Roles and ownership are described in `Contributing.md`; the README states that contributor names are not otherwise tracked.
