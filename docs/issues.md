# Bug & Issue Tracking

A register of what is wrong, what was fixed, what is planned and what is intentionally limited. It was compiled on **2026-10-06** from the code, the running application, the git history (79 commits), existing READMEs and TODO markers. There is no issue tracker file in the repository (`.github/agents/issue-triager.agent.md` describes an automated triage helper, but no issue list is stored in the repo), so **GitHub Issues, if used, were not available to this scan** — items there are **Unknown**.

Evidence tags: **verified live** (reproduced against the running stack) · **by code reading** (not run) · **needs verification**.

Severity: **High** = breaks a stated security or data-isolation requirement · **Medium** = wrong behaviour or notable exposure with limited reach · **Low** = polish, hardening, or documentation.

## 1. Summary

| Group | Count |
|---|---|
| Open defects and risks (section 2) | 12 (I-08, I-09, I-11 … I-18, I-20, I-21; I-01 … I-07 were fixed on 2026-10-06, I-10 and I-19 on 2026-10-08, I-22 on 2026-10-09) |
| Cross-layer inconsistencies (section 3) | 3 open (X-01, X-02, X-03, X-05 and X-07 fixed or addressed; X-06 partly) |
| Documentation drift (section 4) | 10 (5 corrected on 2026-10-06, D-08 and D-10 on 2026-10-10) |
| Fixed (section 5) | 36 recorded |
| In progress (section 6) | none found |
| Planned (section 7) | 12 |

The seven security and permission defects originally listed as I-01 … I-07 (the verified data-isolation gaps) were fixed on 2026-10-06 — see section 5 (F-12 … F-18). The remaining open items were not touched.

## 2. Open defects and risks

IDs I-01 … I-07 are intentionally absent: those defects are fixed and recorded in section 5 under the same IDs.

| ID | Sev. | Issue | Evidence | Where |
|---|---|---|---|---|
| I-08 | Low | **Username/email enumeration:** `resend-otp` / `verify-otp` answer `404` for unknown usernames vs `400 "already verified"` for real ones; registration reveals taken usernames/emails. Login itself is uniform | verified live | `AuthService`, `UserService.registerSelfServiceUser` |
| I-09 | Medium | **Login rate limit may not work per client in Docker.** The key uses `getRemoteAddr()`; behind nginx with no forwarded-header handling it is probably the proxy's address for everyone, so one attacker could lock a username for all clients (the exact case the code comment says it avoids) | needs verification | `AuthController.login`, `LoginRateLimiter` |
| I-11 | Medium | **Raw database messages reach clients** for `CHECK` and most unique-constraint violations (`new row for relation "projects" violates check constraint "projects_check"`, `duplicate key value violates unique constraint "idx_users_username_lower"`). Only the project code is translated (to a 409). The frontend validates dates first, so users rarely see it, but API callers do | verified live | `GlobalExceptionHandler.handleDataIntegrityViolation` |
| I-12 | Medium | **Invitations are invisible if the invitee turned notifications off.** The notification is the only place the UI offers Accept/Decline, and every notification producer honours `task_notifications_enabled`. The `PENDING` row then waits indefinitely | by code reading | `NotificationService.notifyTeamInvitation`, `layout/TopBar.jsx` |
| I-13 | Low | No UI to **list or cancel** pending invitations (only a count). (The UI to change a member's project role and transfer ownership was added on 2026-10-09, F-30) | by code reading | `ProjectDetail.jsx`, `Team.jsx` |
| I-14 | Low | **Abandoned registrations** keep the username and email reserved forever; no expiry or cleanup | by code reading | `UserService.registerSelfServiceUser` |
| I-15 | Low | Not validated: a task dependency may join tasks in different projects. (A reply's parent comment belonging to another task is now refused, 2026-10-09, F-28) | by code reading | `CommentService.createComment`, `TaskDependencyService`, schema |
| I-16 | Low | ~~`TASK_DELETED` activity entries are stored without a task link and are not returned by any endpoint; project, milestone, comment and file events are never written; there is no project-wide feed~~ — **fixed 2026-10-09** (F-29): the project feed returns them and the events are written. Still true: the audit log (optional) does not exist | by code reading | `ActivityLogService.recordForDeletedTask` |
| I-17 | Low | Notification behaviour (approval notifications never go to the actor): a status change notifies **the actor too**; the subtask auto-promotion changes status but creates **no notification**; unassigning notifies nobody | by code reading | `NotificationService`, `SubtaskService.startTaskIfStillToDo` |
| I-18 | Low | Project data rules: a project can be marked `COMPLETED` with unfinished tasks; no project completion date is stored; `kpi_snapshots (snapshot_date, project_id)` is unique but NULLs are distinct, so org-wide snapshots are not de-duplicated; project-code generation can race (the loser gets a `409` and must retry) | by code reading | `ProjectService`, `01-init.sql` |
| I-20 | Medium | **The application still differs from the approved specification in a few places** ([ADR-0015](adr/0015-two-level-roles-system-and-project.md), [assignment-brief.md](../assignment-brief.md) §B13.1). The two-level role model, one owner per project and the Team Member limits are done (`V10`); still open: creating extra system roles (D-14). Done on 2026-10-09: own position/department (D-16), the stored status `TODO` (D-15) (batch 1) and the approval workflow with a designated approver and notifications (batch 2, `V12`). Missing required features: auto-logout and reminders (the KPIs and the seven named reports were built on 2026-10-09, batch 3c; Team Tasks, the project timeline and the Delayed calculation in batch 3b; checklists, attachments, comment replies in the UI and project activity were built on 2026-10-09, batch 3a) | comparison of the code with the approved specification; [workflow-conformance.md](workflow-conformance.md) | see B13.1 |
| I-21 | Low | **Live data: three task assignments point at people who are not members of the task's project** (tasks 2, 3 and 5 of PRJ-2001 are assigned to `lead.owen`, who has no PRJ-2001 membership in the live database though the seed gives him one). `verify_invariants.sql` query 3 returns these rows on the live database; it passes on a freshly seeded one. Already present in a backup taken before any of the 2026-10-08 work; probably left by an earlier test run. Not touched. **2026-10-09:** the query returns no rows any more (checked after batch 2); the cause of the change is not known, so keep watching it | `database/verify_invariants.sql` query 3 against the live database | live data only |
| I-22 | Low | ~~**An unknown API path returns `500 "An unexpected error occurred"`, not `404`.** Spring's "no static resource" exception reaches the catch-all handler in `GlobalExceptionHandler`, so every mistyped URL logs a stack trace. Seen on all 17 probes of missing endpoints in [workflow-conformance.md](workflow-conformance.md)~~ — **fixed 2026-10-09** (F-24) | live probes | `exception/GlobalExceptionHandler.java` |

> **I-22 fixed 2026-10-09** (F-24): `GlobalExceptionHandler.handleNoResource` answers `404 "Resource not found"`.

## 3. Inconsistencies between frontend, backend, database and tests

| ID | Inconsistency | Evidence |
|---|---|---|
| X-01 | ~~Team page offered "+ Add New" position/department to anyone who administers a project, though `POST /api/positions` and `/api/departments` need `LOOKUP:CREATE`~~ — **fixed 2026-10-08:** the option is hidden unless the caller holds `LOOKUP:CREATE` (`LookupSelect` without `onAddNew`) | `Team.jsx`, `LookupSelect.jsx` |
| X-02 | ~~**Login accepts the username only**, while the requirements imply "Username or Email"~~ — **fixed 2026-10-09:** the login accepts the e-mail address too (`UserService.resolveLoginIdentifier`) and the form says "Username or email" | `AuthService`, `Login.jsx`; `batch1.spec.js` |
| X-03 | ~~Frontend permission helpers vs backend disagreed about `VIEWER`~~ — **fixed 2026-10-06:** the backend now refuses `VIEWER` writes and the task panel hides the comment box and subtask controls from viewers | live + e2e |
| X-04 | **`init/01-init.sql` vs Flyway migrations:** the migrations lack the task/subtask consistency objects (`check_task_not_completed_with_open_subtasks`, `trg_tasks_not_completed_with_open_subtasks`, `fn_compute_task_progress_from_subtasks`, `trg_subtasks_sync_parent_task`, `trg_tasks_progress_derived_from_subtasks`). A database built from migrations would not enforce them | verified by search |
| X-05 | **CI vs local database:** CI uses `postgres:16`, local Compose uses `postgres:18-alpine`. The grant lists were brought back in line on 2026-10-08 (CI and `03-app-role.sh` now grant the same 17 tables plus `SELECT` on `permissions`) | verified in `ci.yml`, `03-app-role.sh` |
| X-06 | **Stale comments in code:** `01-init.sql` still says permissions are "on top of the 4 fixed roles" and that dependency ordering is "enforced in application business logic, not here" (triggers do enforce it) | by reading |
| X-07 | **Tests vs behaviour:** the permission defects above were not caught earlier because no test covered the permission matrix. Since 2026-10-08 `PermissionServiceTest` checks **every role × resource × action** of the `V9` matrix, and `roles-permissions.spec.js` covers the live API and UI. Cases that still depend on reading the code: the ownership rules (comment author, assignee-only status change) per role | `PermissionServiceTest`, `e2e/roles-permissions.spec.js` |

## 4. Documentation drift

> **Update 2026-10-08:** the READMEs in `api/`, `backend/`, `frontend/` and `database/` were removed and their content moved into [backend.md](backend.md), [frontend.md](frontend.md), [database.md](database.md) and [api-reference.md](api-reference.md) (map: [README.md](README.md#where-the-old-folder-readmes-went)). The rows below record corrections made to those READMEs and are kept as history. `api/openapi.yaml` is still out of date and is no longer maintained ([api-reference.md](api-reference.md#18-the-legacy-openapiyaml)).

| ID | Document | Problem | Status |
|---|---|---|---|
| D-01 | `api/openapi.yaml` | Documents 57 of 84 endpoints. Missing: registration/OTP, positions/departments, subtasks, comments, activity logs, photos, invitations (`invite`, `accept`, `decline`, `invitations`), `/users/me/password|photo|preferences`, `/users/{id}/position-department` | **Open** — [api-reference.md](api-reference.md) is complete |
| D-02 | `api/openapi.yaml` | Still describes authorization with the removed roles `PROJECT_MANAGER`/`TEAM_LEADER`/`TEAM_MEMBER` (24 mentions), a wrong `ProjectRole` enum, and says `managerId` is required on `ProjectRequest` (the backend makes it optional) | Banner added; `ProjectRole` enum corrected; remaining text **open** |
| D-03 | `api-reference.md#18-the-legacy-openapiyaml` | Said `GET /api/tasks/status/{status}` returns an empty list for an unknown status; it returns `400` (verified live) | **Corrected** |
| D-04 | `backend/README.md` | Claimed `openapi.yaml` is "kept in sync"; listed the unit tests as "UserService + GlobalExceptionHandler"; Team Invitations omitted the pending-count and invitable-user endpoints and the inactive-account rule | **Corrected** |
| D-05 | root `README.md` | Test section said 2 unit-test classes and no controller tests; described task-dependency ordering as "application logic, not the DB" | **Corrected** |
| D-06 | `frontend/README.md` | E2E coverage list was only `auth` and `projects`; routes table did not mention the *My Tasks* filter | **Corrected** |
| D-07 | `database/README.md` | Said the seed has "~13 users, 6 projects" (it has 24 users, 10 projects); said new migrations should be `V7__*` (V7 and V8 exist); claimed `01-init.sql` and the migrations are equivalent (they have drifted — X-04) | **Corrected** |
| D-08 | `.github/workflows/ci.yml`, `database/README.md` | Document the CI grant list drift already (X-05) but it remains | **Resolved** — the lists match (21 tables, re-checked 2026-10-10) |
| D-09 | Code comments | See X-06 | **Open** |
| D-10 | root `README.md`, `roadmap.md`, `backend.md`, `database.md`, `overview.md`, `PRODUCT.md`, `docs/checklist/*`, `assignment-brief.md` | Written before change-plan batches 1–3c and not fully updated: said project-scoped checks do not use the permission tables, the activity log is per task only, 4 notification types, 67 backend / 33 Playwright tests, 17 controllers, 15 entities, 22 tables, 17 granted tables, "no email login", "no named reports", "Flyway not run"; the checklist still listed finished items as open; `Project_requirement_plan.md` was linked from four files but no longer exists | **Corrected 2026-10-10** against the code (counts: 25 controllers, 119 endpoints, 22 entities, 24 tables, 290 backend and 99 Playwright tests) |

## 5. Fixed

| # | Fix | When / evidence |
|---|---|---|
| F-01 | Duplicate project code returned a raw database error → clean `409 "Project code already exists."` (pre-check + constraint safety net) | 2026-10-06, commit `115d52a`; `ProjectServiceTest`, `GlobalExceptionHandlerTest`, `project-team.spec.js` |
| F-02 | Project code is generated by the server (`PRJ-####`) and read-only after creation | 2026-10-06, `115d52a`; `ProjectServiceTest` |
| F-03 | "N pending invitations" always showed nothing (counted the active-members list) → counted from `PENDING` rows via a new endpoint | 2026-10-06, `115d52a`; `ProjectMemberServiceTest`, e2e |
| F-04 | Inactive/suspended users could be invited or directly added → rejected in the backend, hidden from suggestions and from the Team page | 2026-10-06, `115d52a`; unit + e2e tests |
| F-05 | Invitation suggestions only included users sharing a project → org-wide, database-level search | 2026-10-06, `115d52a`; unit + e2e |
| F-06 | `projects.spec.js` selector matched the sidebar link after the rename | 2026-10-06 |
| F-07 | Password UX: live checklist, specific errors, backend field messages surfaced; login unchanged | 2026-10-06, `115d52a` (no permanent automated test) |
| F-08 | Tasks page "My Tasks" became a filter; sidebar/page renamed | 2026-10-06, `115d52a` (no permanent automated test) |
| F-09 | Earlier fixes recorded in the history/READMEs: backend RBAC/DTO/password-hashing/CORS gaps (`27c9aca`), trigger errors surfacing as `500` (`52f08b7`), seed login hash (`8416ac9`), project-membership data isolation (`5170e6a`), project-level authorization and last-owner protection (`35c6daf`, `9f0a872`), task/subtask completion consistency (`727f010`, `9f0a872`) | see [changelog.md](changelog.md) |
| F-10 | Java target moved from 21 to 25 with CI and Docker images aligned | 2026-10-06, `52a93b4` |
| F-11 | Local note: Maven fails with "release version 25 not supported" if `JAVA_HOME` points at an older JDK — not a code bug; documented in [setup.md](setup.md#7-troubleshooting) | 2026-10-06 |
| F-12 *(was I-01)* | **User lookups are scoped.** `GET /api/users/{id}` and `/api/users/username/{username}` now return a user only to an administrator, the user themself, or someone who shares an active project with them; anyone else gets the same `404 "User not found"` as for a nonexistent user (no account enumeration through lookup) | 2026-10-06; `UserServiceTest` (+5), `permissions.spec.js` |
| F-13 *(was I-02)* | **Membership lookups are scoped.** `GET /api/project-members/user/{userId}` returns, for non-administrators, only the user's **active** memberships in projects the caller is an active member of | 2026-10-06; `ProjectMemberServiceTest` (+3), `permissions.spec.js` |
| F-14 *(was I-03)* | **A task can no longer be moved into a project the caller doesn't manage.** `PUT /api/tasks/{id}` also requires manage rights on the *target* project when `projectId` changes (`403` otherwise) | 2026-10-06; `TaskServiceTest`, `permissions.spec.js` |
| F-15 *(was I-04)* | **`VIEWER` is read-only for subtasks and comments:** creating, editing and deleting subtasks and adding comments need content-edit rights (`OWNER`/`ADMIN`/`MEMBER`); reading is unchanged. The task panel hides the controls from viewers | 2026-10-06; `ViewerWriteAccessTest`, `permissions.spec.js` (API + UI) |
| F-16 *(was I-05)* | **Milestones and memberships can't be re-pointed:** `PUT /api/milestones/{id}` needs manage rights on the target project when `projectId` changes; `PUT /api/project-members/{id}` can change only the role — a different `projectId`/`userId` is `400 "A membership's project and user cannot be changed…"` | 2026-10-06; `MilestoneServiceTest`, `ProjectMemberServiceTest`, `permissions.spec.js` |
| F-17 *(was I-06)* | **Tokens of deactivated accounts stop working immediately.** Every authenticated request now checks the account is still `ACTIVE` while the JWT is decoded (`ActiveAccountJwtValidator`, one status-only query per request): a suspended, inactive, pending or deleted account gets `401`, and the same token works again if the account is reactivated | 2026-10-06; `ActiveAccountJwtValidatorTest` (5), `permissions.spec.js` |
| F-18 *(was I-07)* | **An assigned `VIEWER` can no longer change the status/progress of their task** (content-edit rights are required before the assignment check) | 2026-10-06; `TaskServiceTest` |
| F-19 | **Test hygiene bug:** the *Add-member picker* e2e test cleaned up by deleting *every* pending invitation on `PRJ-2001`, which silently removed the seeded `dev.tomas` invitation on each run. The test now deletes only the invitation it sent (and the seed row was restored) | 2026-10-06; `project-team.spec.js` |
| F-20 | **Roles and permissions follow the requirements as understood on 2026-10-08 (the model was then reshaped by the approved specification, ADR-0015 — see I-20):** four roles (Administrator, Project Manager, Team Leader, Team Member) plus the project-only Viewer, seven permissions, a `role_permissions` matrix that the API and UI both read, Role & Permission and User & Role screens, a real approval gate on task completion, project creation limited to Project Managers and Administrators ([ADR-0014](adr/0014-requirement-roles-and-permission-matrix.md)). Closes the roles/permissions gaps in the checklist | 2026-10-08; migration `V9`, `PermissionServiceTest`, `roles-permissions.spec.js` |
| F-21 *(was I-10)* | **Built-in roles are protected:** a built-in role (`ADMINISTRATOR`, `PROJECT_MANAGER`, `USER`, `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`) cannot be renamed or deleted, so the administrator bypass cannot be broken through the roles API | 2026-10-08; `RoleService`, `roles.built_in` |
| F-22 *(was X-01)* | **"+ Add New" position/department is hidden** from people without `LOOKUP:CREATE` instead of failing with `403` | 2026-10-08; `LookupSelect.jsx`, `Team.jsx` |
| F-23 *(was I-19)* | **A project whose only active owner is one person can be deleted again.** The V8 "at least one owner" trigger blocked the cascade; `V10` replaces it with a deferred "exactly one owner" check that skips a project being deleted | 2026-10-08; `V10`, `e2e/roles-permissions.spec.js` (the owner deletes a single-owner project) |
| F-24 *(was I-22)* | **An unknown API path answers `404 "Resource not found"`** instead of `500` with a stack trace | 2026-10-09; `GlobalExceptionHandlerTest`, `batch1.spec.js` |
| F-25 *(was X-02)* | **Sign in with username or e-mail**; login form label updated | 2026-10-09; `UserServiceTest` (3), `batch1.spec.js` (2) |
| F-26 | **Change-plan batch 1 alignment with the specification:** Completed / In Review labels (C-01, X-4), assignment notification text, users set their own position/department (D-16), project and task filters and sorting (B1.9, in the browser), stored status `TODO` (D-15, `V11`) | 2026-10-09; [change-plan.md](change-plan.md) §3; `NotificationServiceTest`, `TextFormatTest`, `UserServiceTest`, `batch1.spec.js` |
| F-27 | **Task approval workflow** (B3.8, D-05): approval records, a designated approver, Approved / Changes requested / Rejected with comments, no approving your own work, activity entries and notifications; completing through the ordinary task edit is recorded as the approval | 2026-10-09; `V12`; `TaskApprovalServiceTest`, `TaskServiceTest`, `approvals.spec.js` |
| F-28 | **Comment replies** work from the UI, and a reply must belong to the same task as its parent (I-15, first half) | 2026-10-09; `CommentServiceTest`, `collaboration.spec.js` |
| F-29 | **Attachments, checklists and the project activity feed** (change-plan 3a): files up to 10 MB on tasks and projects with a type allow-list; checklist items counted in progress (D-07); project, milestone, comment and file events and `GET /api/activity-logs/project/{id}` (closes I-16); nginx now passes request bodies up to 12 MB (profile photos over 1 MB used to fail in Docker) | 2026-10-09; `V13`; `AttachmentServiceTest`, `ChecklistItemServiceTest`, `FileTypeGuardTest`, `ActivityLogServiceTest`, `collaboration.spec.js` |
| F-30 | **Manager views** (change-plan 3b): server-calculated dashboard statistics, Delayed projects, Team Tasks, Team Workload (D-13), the project timeline, and a role picker / ownership transfer on the project page; `PUT /api/project-members/{id}` now enforces B3.7 / B3.9 (nobody changes their own role; a Team Leader only moves Team Members and Viewers) | 2026-10-09; `DashboardServiceTest`, `TeamViewsServiceTest`, `WorkloadClassifierTest`, `DerivedTest`, `ProjectMemberServiceTest`, `manager-views.spec.js` |
| F-31 | **Flaky end-to-end specs**: `projects.spec.js` and `time-tracking.spec.js` opened "the first project card", which changes whenever a test creates or deletes a project (Postgres reuses freed rows). They open *Website Redesign* now | 2026-10-09; the specs |
| F-32 | **KPIs and the seven named reports** (change-plan 3c): `GET /api/reports/*` calculated on the server and gated by `REPORT:GENERATE_REPORTS` (Administrator all projects; others only projects where they hold the permission; `403` / `404` otherwise), the approved D-12 formulas with "—" for an empty denominator, and a tab for each on the Reports page. This closes the "only the Reports page is gated" gap | 2026-10-09; `ReportServiceTest` (25), `reports.spec.js` (13) |
| F-36 | **Error pages and a Help & Support page:** `ErrorPage` is one page for every error status (unknown address, `/error/:status`, the 403 guard, project pages that cannot load) in the existing `EmptyState` / `.btn` style, replacing three hand-written copies and the blank "not found" a mistyped address used to give; Help & Support is a page (`/help`) instead of a modal, with its FAQ corrected (the password is on the Profile page; people set their own position and department) and extended (approvals, reminders, schedule, troubleshooting) | 2026-10-10; `help-errors.spec.js` (5); screenshot-checked at 1360 and 390 px |
| F-35 | **Gantt chart prototype** (checklist #38, optional): the project's *Gantt* tab (`/projects/:id/gantt`, every member) draws a duration bar per task on a week / month axis with progress, a today line and dependency arrows; an arrow is red when a task is planned to start before its unfinished prerequisite is due; hovering a bar fades the tasks that do not overlap it. Front end only (`GanttChart.jsx`, `ProjectViews.jsx`): it reads `/tasks` and `/task-dependencies` | 2026-10-10; `gantt.spec.js` (4); screenshot-checked |
| F-34 | **Deadline reminders and overdue notices** (checklist #46, #47): `DeadlineScheduler` runs `DeadlineNotificationService` daily at 08:00 and once at startup — a reminder 3 days and 1 day before a task's or milestone's due date or a project's end date, and an overdue notice for an open task whose due date has passed; recipients are the assignees and the project Owner; each notification is created at most once (type + text + person + item); people with notifications off and inactive accounts are skipped. No schema change; the SQL function is no longer used by the app | 2026-10-10; `DeadlineNotificationServiceTest` (16); verified live: 53 created on the first run, 0 on the restart, no duplicates, no recipient outside assignee / Owner |
| F-33 | **Friendly network errors:** `frontend/src/api/client.js` now sends every request through one `send` helper, so an unreachable server shows "Could not reach the server. Check your connection and try again." instead of the browser's "Failed to fetch", and a non-JSON reply (an HTML error page from the proxy while the backend is down) shows "The server sent an unexpected response. Please try again." instead of a `JSON.parse` message. Checklist item #64 | 2026-10-10; `client.js` (lint and build clean; no frontend unit test exists) |

## 6. In progress

None found. On 2026-10-10 the working tree held only the documentation sync and the network-error fix (F-33); change-plan batches 1–3c are committed (`5cda340`). No open branch other than `appmod/java-upgrade-20261006031004` (the Java upgrade, already committed) was inspected for unmerged work; other local branches (`backend/*`, `database/*`, `Project/*`, `fronrtend/updateUI`) exist and their state was **not** reviewed.

## 7. Planned

Items the project's own documents list as future work (root `README.md` → *Future Enhancements*, `backend.md` → *Next Steps*, `database.md`, requirement files) — see [roadmap.md](roadmap.md) for the full classification:

1. A refresh-token flow.
2. ~~Server-side report endpoints gated by `REPORT:GENERATE_REPORTS`.~~ Done 2026-10-09 (batch 3c).
3. ~~A scheduled job for overdue and deadline notifications.~~ Done 2026-10-10 (F-34).
4. The remaining notification types (`COMMENT_ADDED`, `PROJECT_UPDATED`, `MILESTONE_UPDATED`).
5. Pagination and search/filtering on list endpoints.
6. Running Flyway in CI and a production deployment (Compose's `migrate` service runs it locally).
7. ~~Entities/controllers for `checklist_items`, `attachments`, `work_logs`.~~ Done (work logs earlier; checklists and attachments on 2026-10-09).
8. ~~Endpoints over the reporting views~~ (the reports are calculated in Java, 2026-10-09); PDF / Excel export with `report_exports` and `kpi_snapshots` remain.
9. Broader automated tests; Playwright in CI.
10. A deploy target for the CD pipeline.
11. ~~A project-wide activity feed~~ (done 2026-10-09); a per-user or administrator audit view remains.
12. ~~Closing the CI/`03-app-role.sh` grant drift~~ — the lists match.

## 8. Known limitations (accepted or by design)

- **No pagination** on any list endpoint; full-replace `PUT`, no `PATCH`.
- **Stateless JWT with no refresh and no logout endpoint**; tokens last 1 hour; no forgot-password flow.
- **In-memory login limiter** (reset on restart, not shared across instances).
- **No live updates:** data and notifications refresh on load and after the user's own actions.
- **Single task assignee in the UI** although the API supports several.
- **Authorization is data, with a fixed catalog:** an administrator edits which role holds which permission on which resource, but a new resource, action or system role needs a code change and a migration (G-06).
- **Flyway is not run by the application;** the init SQL is the schema for a fresh volume and Compose's one-shot `migrate` service applies later migrations.
- **Notifications:** 8 of 11 types are produced (no comment, project-update or milestone-update notice). Deadline and overdue notices are sent once, by a daily job at 08:00 and at startup: nothing is sent between runs, and a reminder day missed while the backend was down is not made up.
- **Reports:** the KPIs and the seven named reports are calculated on the server; the *Overview* charts are still computed in the browser; no PDF / Excel export (optional).
- **Profile photos and attachments live in the database** (portable, but they bloat the `users` and `attachment_contents` tables and every backup; at most 10 MB x 25 files per task or project).
- **Uploads are not virus-scanned and the upload endpoint has no rate limit of its own** (it needs a signed-in member with `ATTACHMENT:CREATE`; size, count and type are limited). A scanner and a per-user upload limit are the next hardening steps.
- **Seed data and development secrets** are for development only.
- **Responsive layout** was audited at 390, 768, 1024 and 1360 px on 2026-10-08; no later audit is recorded for the screens added since (approvals, reports, timeline, team views).
- **Each e2e run leaves a few `activity_logs` rows** (task created/deleted, subtask added/deleted for tasks the tests create and delete). They are detached from any task (`task_id` NULL) so no screen or endpoint shows them; there is no API to remove activity entries.

## 9. Technical debt

| Item | Why it matters |
|---|---|
| Services fetch the caller's project ids and filter in memory (`TaskService.getAllTasks`, `MilestoneService.getAllMilestones`, `TaskDependencyService.getAllTaskDependencies`) | Fine for the demo dataset; unbounded and un-paged as data grows. `MilestoneService` and `TaskDependencyService` load **all** rows then filter |
| `updateX` methods apply request-body relations (`projectId`, `userId`) after checking permission on the *old* relation | Root cause of the former I-03/I-05; now guarded in `TaskService`, `MilestoneService` and `ProjectMemberService`, but any **new** update endpoint that accepts a relation id must re-check the target |
| Two schema sources (`init/*.sql` and Flyway) maintained by hand | Already drifted (X-04) |
| Frontend loads whole collections (`/api/tasks`, `/api/task-assignees`, `/api/project-members`) and derives views client-side | Heavy per page; the My Tasks filter and dashboards depend on it |
| No automated tests for most services, controllers, triggers and screens | See [testing.md](testing.md#8-missing-or-weak-coverage) |
| `User.profilePhoto` is an eagerly loaded `byte[]` column, so every `User` entity load (also when nested via members, assignees, projects) reads up to 5 MB of photo | Likely heavy for list endpoints as photos accumulate (by code reading; not measured) |
| `spring.jpa.show-sql=true` in the default configuration | Noisy production logs |
| `PUT /api/users/{id}` has no uniqueness pre-check (database error instead of a sentence) | Part of I-11 |
| Dev defaults for passwords and the JWT secret in `docker-compose.yml`/`.env.example` | A warning is logged for the JWT secret only |
