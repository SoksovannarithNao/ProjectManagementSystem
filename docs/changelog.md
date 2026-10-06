# Change Log

Significant changes, newest first, reconstructed from the git history (79 commits, 2026-08-27 → 2026-10-06), the merged pull requests (#8 → #44), the migration files, and the existing READMEs. There are **no git tags or release numbers** (`pom.xml` is `0.0.1-SNAPSHOT`, `frontend/package.json` is `0.0.0`, `api/openapi.yaml` declares `0.2.0`), so entries are grouped by date and pull request.

Categories: **Added** · **Changed** · **Fixed** · **Database** · **Architecture** · **Build / CI / Docs**. Commit hashes are given so each entry can be inspected with `git show <hash>`. Entries summarise the commit message; extra detail comes from the cited README/migration text. Anything inferred rather than stated is marked *(inferred)*.

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
