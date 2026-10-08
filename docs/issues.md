# Bug & Issue Tracking

A register of what is wrong, what was fixed, what is planned and what is intentionally limited. It was compiled on **2026-10-06** from the code, the running application, the git history (79 commits), existing READMEs and TODO markers. There is no issue tracker file in the repository (`.github/agents/issue-triager.agent.md` describes an automated triage helper, but no issue list is stored in the repo), so **GitHub Issues, if used, were not available to this scan** — items there are **Unknown**.

Evidence tags: **verified live** (reproduced against the running stack) · **by code reading** (not run) · **needs verification**.

Severity: **High** = breaks a stated security or data-isolation requirement · **Medium** = wrong behaviour or notable exposure with limited reach · **Low** = polish, hardening, or documentation.

## 1. Summary

| Group | Count |
|---|---|
| Open defects and risks (section 2) | 13 (I-08, I-09, I-11 … I-18, I-20, I-21, I-22; I-01 … I-07 were fixed on 2026-10-06, I-10 and I-19 on 2026-10-08) |
| Cross-layer inconsistencies (section 3) | 4 open (X-01, X-03, X-05 and X-07 fixed or addressed; X-06 partly) |
| Documentation drift (section 4) | 9 (5 corrected on 2026-10-06) |
| Fixed (section 5) | 23 recorded |
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
| I-13 | Low | No UI to **list or cancel** pending invitations (only a count); no UI to **change a member's project role** (invitees always join as `MEMBER`) | by code reading | `ProjectDetail.jsx`, `Team.jsx` |
| I-14 | Low | **Abandoned registrations** keep the username and email reserved forever; no expiry or cleanup | by code reading | `UserService.registerSelfServiceUser` |
| I-15 | Low | Not validated anywhere: a reply's parent comment may belong to another task; a task dependency may join tasks in different projects | by code reading | `CommentService.createComment`, `TaskDependencyService`, schema |
| I-16 | Low | `TASK_DELETED` activity entries are stored without a task link and are **not returned by any endpoint** (the only read is per task); other allowed actions (project, milestone, comment, file events) are never written; there is no project-wide feed | by code reading | `ActivityLogService.recordForDeletedTask` |
| I-17 | Low | Notification behaviour: a status change notifies **the actor too**; the subtask auto-promotion changes status but creates **no notification**; unassigning notifies nobody | by code reading | `NotificationService`, `SubtaskService.startTaskIfStillToDo` |
| I-18 | Low | Project data rules: a project can be marked `COMPLETED` with unfinished tasks; no project completion date is stored; `kpi_snapshots (snapshot_date, project_id)` is unique but NULLs are distinct, so org-wide snapshots are not de-duplicated; project-code generation can race (the loser gets a `409` and must retry) | by code reading | `ProjectService`, `01-init.sql` |
| I-20 | Medium | **The application still differs from the approved specification in a few places** ([ADR-0015](adr/0015-two-level-roles-system-and-project.md), [assignment-brief.md](../assignment-brief.md) §B13.1). The two-level role model, one owner per project and the Team Member limits are done (`V10`); still open: the approval workflow (request / approve / changes requested / reject, designated approver, notifications), creating extra system roles (D-14), users editing their own position/department (D-16), the stored status `TO_DO` vs `TODO` (D-15). Missing required features: checklists, attachments, KPIs, Team Tasks, project timeline, Delayed calculation, named reports, auto-logout, login by email, reminders, project filters | comparison of the code with the approved specification; [workflow-conformance.md](workflow-conformance.md) | see B13.1 |
| I-21 | Low | **Live data: three task assignments point at people who are not members of the task's project** (tasks 2, 3 and 5 of PRJ-2001 are assigned to `lead.owen`, who has no PRJ-2001 membership in the live database though the seed gives him one). `verify_invariants.sql` query 3 returns these rows on the live database; it passes on a freshly seeded one. Already present in a backup taken before any of the 2026-10-08 work; probably left by an earlier test run. Not touched | `database/verify_invariants.sql` query 3 against the live database | live data only |
| I-22 | Low | **An unknown API path returns `500 "An unexpected error occurred"`, not `404`.** Spring's "no static resource" exception reaches the catch-all handler in `GlobalExceptionHandler`, so every mistyped URL logs a stack trace. Seen on all 17 probes of missing endpoints in [workflow-conformance.md](workflow-conformance.md) | live probes | `exception/GlobalExceptionHandler.java` |

## 3. Inconsistencies between frontend, backend, database and tests

| ID | Inconsistency | Evidence |
|---|---|---|
| X-01 | ~~Team page offered "+ Add New" position/department to anyone who administers a project, though `POST /api/positions` and `/api/departments` need `LOOKUP:CREATE`~~ — **fixed 2026-10-08:** the option is hidden unless the caller holds `LOOKUP:CREATE` (`LookupSelect` without `onAddNew`) | `Team.jsx`, `LookupSelect.jsx` |
| X-02 | **Login accepts the username only**, while the requirements (and the register/login screens' wording elsewhere) imply "Username or Email" | verified in `CustomUserDetailsService`, `LoginRequest` |
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
| D-08 | `.github/workflows/ci.yml`, `database/README.md` | Document the CI grant list drift already (X-05) but it remains | **Open** (code) |
| D-09 | Code comments | See X-06 | **Open** |

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

## 6. In progress

None found. The working tree contained only the new `docs/` folder when this was compiled. No open branch other than `appmod/java-upgrade-20261006031004` (the Java upgrade, already committed) was inspected for unmerged work; other local branches (`backend/*`, `database/*`, `Project/*`, `fronrtend/updateUI`) exist and their state was **not** reviewed.

## 7. Planned

Items the project's own documents list as future work (root `README.md` → *Future Enhancements*, `backend.md` → *Next Steps*, `database.md`, requirement files) — see [roadmap.md](roadmap.md) for the full classification:

1. A refresh-token flow.
2. Server-side report endpoints gated by `REPORT:GENERATE_REPORTS` (today only the Reports page is gated).
3. A scheduled job for overdue and deadline notifications.
4. The remaining notification types (`COMMENT_ADDED`, `PROJECT_UPDATED`, `MILESTONE_UPDATED`, `DEADLINE_REMINDER`).
5. Pagination and search/filtering on list endpoints.
6. Wiring Flyway into startup.
7. Entities/controllers for `checklist_items`, `attachments`, `work_logs`.
8. Endpoints over the reporting views, `report_exports`, `kpi_snapshots`.
9. Broader automated tests; Playwright in CI.
10. A deploy target for the CD pipeline.
11. A project-wide or per-user activity/audit feed.
12. Closing the CI/`03-app-role.sh` grant drift.

## 8. Known limitations (accepted or by design)

- **No pagination** on any list endpoint; full-replace `PUT`, no `PATCH`.
- **Stateless JWT with no refresh and no logout endpoint**; tokens last 1 hour; no forgot-password flow.
- **In-memory login limiter** (reset on restart, not shared across instances).
- **No live updates:** data and notifications refresh on load and after the user's own actions.
- **Single task assignee in the UI** although the API supports several.
- **Authorization is code, not data:** adding a role or permission needs a code change.
- **Flyway is not run by the application;** the init SQL is the schema.
- **Notifications:** 4 of 9 types are produced.
- **Reports** are charts computed in the browser; no export.
- **Profile photos live in the database** (portable, but bloats the `users` table and every backup).
- **Seed data and development secrets** are for development only.
- **Responsive layout** has not been audited screen by screen.
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
