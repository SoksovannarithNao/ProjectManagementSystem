# Backend Guide

Spring Boot REST API for the Task & Project Management System. This page is the developer guide that used to live in `backend/README.md`; the folder README was removed and everything in it now lives under `docs/`. Deeper reference pages are linked from each section.

## Stack

- Java 25 (LTS)
- Spring Boot 4.0.8: Web MVC, Data JPA, Security, OAuth2 Resource Server, Validation, Mail
- PostgreSQL 18, with the schema owned by [database/init/01-init.sql](../database/init/01-init.sql). `spring.jpa.hibernate.ddl-auto=validate` means Hibernate checks the entity mappings on startup and never changes the schema
- JWT authentication (`jjwt` 0.12.6 with Spring Security's resource-server support, HS512)
- Maven 3.9.16 (Maven Wrapper)

## Getting started

The backend needs a running Postgres: with `ddl-auto=validate` there is no database-less mode. From the repository root:

```bash
docker compose up -d postgres mailpit
cd backend
./mvnw spring-boot:run
```

The API is then at `http://localhost:8080`. To use another port (for example next to the Compose `backend` container, which already holds 8080):

```bash
./mvnw spring-boot:run -Dspring-boot.run.arguments="--server.port=8081"
```

Run the tests with `./mvnw test`. They need the same running Postgres, because `BackendApplicationTests` boots the full application context, JPA and DataSource included. Full setup, ports and variables: [setup.md](setup.md). Test inventory: [testing.md](testing.md).

## Project structure

```text
src/main/java/backend/
├── BackendApplication.java    # Application entry point
├── controller/                # 19 REST controllers: bind and validate requests, delegate to services
├── service/                   # Business logic, transaction boundaries, DTO <-> entity mapping
├── entity/                    # 18 JPA entities, one per table that has backend code
├── repository/                # Spring Data JPA repositories
├── dto/                       # Request/response shapes; no controller binds or returns a raw entity
├── security/                  # Resource and Action enums, PermissionChecker (the @permissions bean used in @PreAuthorize)
├── exception/                 # NotFoundException, ConflictException, TooManyRequestsException + GlobalExceptionHandler (@RestControllerAdvice)
├── config/                    # SecurityConfig (JWT, CORS, method security), JwtSecretGuard, ActiveAccountJwtValidator
└── util/                      # TextFormat

src/main/resources/
└── application.properties     # Application configuration

src/test/java/backend/         # Tests (see testing.md)
```

How the layers and services relate: [architecture.md](architecture.md#2-backend-architecture).

## API endpoints

The complete endpoint-by-endpoint reference (all 91 endpoints, permissions, request and response shapes, error codes) is [api-reference.md](api-reference.md). Resource groups:

| Resource | Base path | Notes |
|---|---|---|
| Health | `/api/health` | Public, no auth |
| Auth | `/api/auth/login`, `/register`, `/verify-otp`, `/resend-otp` | All public. `login` issues a JWT; the other three are the self-registration and email-OTP flow (see [Security](#security)) |
| Photos | `/api/photos/{token}` | Public. An `<img>` tag cannot send a JWT, so profile photos are served by an unguessable per-upload token (see [Security](#security)) |
| Users | `/api/users` | `USER:*` permissions (Administrator) for create/update/delete and `PUT /api/users/{id}/role`; `GET /api/users/me/permissions` and the other self-service `/me` endpoints for the caller; `PUT /api/users/{id}/position-department` needs `MEMBER:EDIT` in a shared project |
| Roles, permissions | `/api/roles`, `/api/permissions/matrix` | `ROLE:VIEW` to read; `ROLE:EDIT` for `PUT /api/roles/{id}/permissions` (the Administrator role is locked) |
| Positions, Departments | `/api/positions`, `/api/departments` | Org-wide lookup lists. Read: any authenticated user. Create: `LOOKUP:CREATE` (Administrator) |
| Projects | `/api/projects` | Create: system `PROJECT:CREATE` (Project Manager, Administrator); the creator becomes that project's `OWNER`. Update: `PROJECT:EDIT`; delete: `PROJECT:DELETE` in that project |
| Milestones | `/api/milestones` | Write operations: `MILESTONE:CREATE/EDIT/DELETE` in that project |
| Tasks | `/api/tasks` | Create: `TASK:CREATE`. Update: `TASK:EDIT` holders (Project Manager, Team Leader) edit any task in full; anyone else may only update status and progress on a task assigned to them (`TASK_STATUS:EDIT`). Setting `COMPLETED` needs `TASK:APPROVE`. Delete: `TASK:DELETE`. The response carries `estimatedHours` and the read-only `actualHours` |
| Subtasks | `/api/subtasks` | `SUBTASK:CREATE/EDIT/DELETE` in the parent task's project (not Viewer) |
| Comments | `/api/comments` | Read: any active member. Create: `COMMENT:CREATE`. Edit: author only. Delete: author, or `COMMENT:DELETE` (Project Manager, Team Leader) |
| Work logs | `/api/work-logs` | Time tracking. Read: any active member. Create: `WORK_LOG:CREATE`, for themselves. Delete: author, or `WORK_LOG:DELETE` (Project Manager, Team Leader). See [tasks.md](tasks.md#time-tracking-estimated-vs-actual) |
| Activity logs | `/api/activity-logs` | Read-only `GET /task/{taskId}`. Written internally by other services, never posted to directly |
| Project members | `/api/project-members` | Direct add (`MEMBER:CREATE`), update (`MEMBER:EDIT`), delete (`MEMBER:DELETE`); setting a member's role to `OWNER` is the ownership transfer and needs `PROJECT:ASSIGN`; nobody is added or invited as `OWNER`. Invitation sub-endpoints: see [Team invitations](#team-invitations) |
| Task assignees | `/api/task-assignees` | Write operations: `TASK:ASSIGN` |
| Task dependencies | `/api/task-dependencies` | Write operations: `TASK:ASSIGN` |
| Notifications | `/api/notifications` | No `@PreAuthorize`: every endpoint scopes to the caller's own by JWT identity (see [Notifications](#notifications)) |

Also: `PUT /api/users/me` (self-service profile update, any authenticated user) and its siblings `PUT /api/users/me/password`, `PUT /api/users/me/photo` (multipart) and `DELETE /api/users/me/photo`, `PUT /api/users/me/preferences` (theme and notification settings), and `GET /api/users/username/{username}`. `PUT /api/users/me` does not accept `position` or `department`: those are managed by a Team Admin through `PUT /api/users/{id}/position-department`, which `UserService.updateMemberPositionDepartment` restricts to someone who administers a project the target user also belongs to, and which refuses self-targeting even for `ADMINISTRATOR`.

Not implemented (no controller): attachments, checklist items, the permission tables, and the reporting tables and views. Every write endpoint validates its body (`@Valid` plus Bean Validation) and a missing row returns a clean `404` body (`{"status":404,"error":"Not Found","message":"..."}`) from `GlobalExceptionHandler`, never a stack trace.

Behaviour that applies to every endpoint (status codes, DTO-only responses, hashing, rate limiting, quirks) is in [api-reference.md](api-reference.md#2-conventions), under "Behaviour worth knowing" and "Known quirks".

## Security

Configured in `config/SecurityConfig.java`. The rules in full: [authentication-authorization.md](authentication-authorization.md) (account states, JWT, permission matrix) and [security.md](security.md) (validation, error handling, hardening checklist). What follows is the developer-level summary and the reasoning behind each choice.

**Authentication.** `POST /api/auth/login` (username and password) issues a JWT (HS512, signed with `app.jwt.secret`, overridable with the `JWT_SECRET` environment variable; expiry via `JWT_EXPIRATION_MS`, default 1 hour). Every endpoint except `/api/health`, `GET /api/photos/{token}` and the rest of `/api/auth/**` needs `Authorization: Bearer <token>`. Passwords are hashed with BCrypt both at registration and on every update that supplies a new one. `config/JwtSecretGuard.java` logs a `WARN` on startup when `app.jwt.secret` is still the built-in development default, so a deployment without `JWT_SECRET` is loud rather than silent. It does not fail startup, because there is no profile system or real deployment target yet and failing fast would only break local development and CI.

**Self-registration and email OTP.** `POST /api/auth/register` creates an account with `account_status = PENDING_VERIFICATION` and emails a one-time code (`OtpService` → `MailService`, SMTP through the Compose `mailpit` service locally; its web UI at `http://localhost:8025` is not a real inbox). `POST /api/auth/verify-otp` checks the code against `otp_verifications` (BCrypt-hashed, capped attempts, expiring) and flips the account to `ACTIVE`; `POST /api/auth/resend-otp` issues a fresh code. All three are public, like `login`. A `PENDING_VERIFICATION` account cannot log in, and every JWT-gated endpoint treats only `ACTIVE` accounts as valid (`ActiveAccountJwtValidator` re-checks the account's current status on each request, so a deactivated account's token stops working immediately).

**Login rate limiting.** `service/LoginRateLimiter.java` tracks failed attempts in memory, keyed by `remoteAddr:username`. It is not keyed by username alone, so an attacker cannot lock a known victim out by failing logins under that name from elsewhere, and not by IP alone, so legitimate users sharing an IP with an attacker are not punished. After 5 failed attempts within 15 minutes for the same key, further attempts get `429 Too Many Requests` until the window rolls off; a successful login clears the counter. It is in-memory only: it resets on restart and is not shared across instances (fine for this single-instance app; horizontal scaling would need a shared store such as Redis).

**Authorization is data-driven and two-level** ([ADR-0015](adr/0015-two-level-roles-system-and-project.md), specified in [assignment-brief.md](../assignment-brief.md) Part B). The `roles` table has the **system roles** `ADMINISTRATOR`, `PROJECT_MANAGER`, `USER` (on the account) and the **project roles** `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` (on a membership; business names Project Manager of the project, Team Leader, Team Member, Viewer). `role_permissions` says which role may do which of the seven permissions on which resource, at system scope or inside a project. `PermissionService` keeps that table in memory (refreshed after every matrix edit) and `service/ProjectAccessGuard.java` answers every check through it. A system role holds only system-scope grants, so it **never widens a project role**; `ADMINISTRATOR` holds everything and is also a bypass in code. The full matrix is in [authentication-authorization.md](authentication-authorization.md#52-project-scope-matrix). In summary:

- System-wide endpoints use `@PreAuthorize("@permissions.require(authentication, 'USER', 'CREATE')")` (`security/PermissionChecker`): users, roles and the matrix, positions and departments.
- Creating a project needs system `PROJECT:CREATE` (Project Manager, Administrator); new accounts are `USER`. The creator becomes the project's single `OWNER` (`service/ProjectOwnership`).
- Project writes call `projectAccessGuard.assertCan(caller, projectId, Resource.X, Action.Y)`: project/milestone/member/task/subtask/comment/work-log, each with its own grant. `403` carries a specific message (`GlobalExceptionHandler` passes it through, except the generic "Access Denied").
- Completing a task needs `TASK:APPROVE` (`TaskService.updateTask`): Team Members submit tasks for review (`IN_REVIEW`) instead.
- Anyone without `TASK:EDIT` on `PUT /api/tasks/{id}` is ownership-scoped: `TaskService.updateTask` needs `TASK_STATUS:EDIT` and a current assignee (`403` otherwise); then only `status` and `progress` from the body take effect and every other field is silently left unchanged, even though the client still sends the full `TaskRequest`.
- Rules about *who did it* stay in code: comment edit by the author only; comment and work-log delete by the author or a `*:DELETE` holder; invitations answered by the invitee; last-owner and last-Administrator protection.
- Any authenticated user may call every `GET`, but see the project-scoped reads below: "anyone can call it" does not mean "sees everything".
- Self-scoped endpoints (`PUT /api/users/me` and its `/me/*` siblings, `GET /api/users/me/permissions`, and every `/api/notifications` endpoint) take a plain `Authentication` parameter and resolve the acting user from `authentication.getName()` (the JWT `sub` claim), so there is no id in the request to tamper with. `NotificationService.markAsRead` also checks the row's `user_id` and throws `NotFoundException`, not `AccessDeniedException`, when it does not match, so a client cannot tell "not yours" from "does not exist".
- Editing the matrix (`RolePermissionService.replaceGrants`): the Administrator role is locked, unknown resources/permissions/scopes are rejected, a role cannot hold grants in a scope it does not have, and a project role must keep `PROJECT:VIEW`.
- Role assignment (`UserService.assignRole`, `PUT /api/users/{id}/role`, `USER:ASSIGN`): project-only roles are refused and the last Administrator cannot be demoted.

**A project has exactly one active `OWNER`**, who is also its manager. `service/ProjectOwnership` is the one place that moves ownership: it demotes the previous owner to `ADMIN` and promotes the new one in the same transaction, and requires the new owner to be an active member who can own projects (`PROJECT_MANAGER` or `ADMINISTRATOR`). `ProjectService` uses it when a project is created and when an administrator changes the manager; `ProjectMemberService` uses it when a member's role is set to `OWNER`. Nobody is invited or added as the owner, and the owner cannot be demoted or removed directly (`assertNotRemovingLastOwner`: "transfer ownership first"). The deferred trigger `trg_project_members_single_owner` is the backstop. `UserService` refuses to move a person who owns a project to `USER`.

**Project-scoped reads.** Every `GET` that returns a single resource or a "by parent id" list (`/api/tasks/{id}`, `/tasks/project/{id}`, `/tasks/milestone/{id}`, `/tasks/status/{status}`, `/projects/{id}`, `/milestones/*`, `/task-dependencies/*`, `/task-assignees/*`, `/project-members/{id}` and `/project/{id}`, `/subtasks/*`, `/comments/*`, `/work-logs/*`, `/activity-logs/task/{taskId}`) checks that the caller is `ADMINISTRATOR` or an active `project_members` row for that project, and answers `404`, not `403`, so existence is not leaked. `ProjectAccessGuard.assertAccess` is the one shared helper for this.

**Per-project administration.** `ProjectMemberService.inviteMember` needs `MEMBER:CREATE` in that specific project (the request may carry the project role `ADMIN`/`MEMBER`/`VIEWER`; `OWNER` is refused), and `UserService.updateMemberPositionDepartment` needs `MEMBER:EDIT` in a project the target also belongs to.

**Profile photos.** Uploaded with `PUT /api/users/me/photo` (multipart, stored as bytes on the `users` row, not in object storage) and served publicly at `GET /api/photos/{token}`. An `<img src>` cannot send a `Bearer` header, so the photo is keyed by an unguessable per-upload token (`User.profilePhotoToken`, rotated on every re-upload) rather than the user's id (which would make every photo enumerable) or a stable per-user URL (which a browser could keep serving stale after a re-upload). See [ADR 0009](adr/0009-profile-photos-in-database.md).

**CORS.** A `CorsConfigurationSource` bean; origins come from `app.cors.allowed-origins` (comma-separated, `CORS_ALLOWED_ORIGINS`), defaulting to the Vite dev server and the Compose frontend port. In normal use the frontend calls relative `/api` paths through a proxy and never makes a cross-origin call.

**Error responses.** `exception/GlobalExceptionHandler.java` maps `NotFoundException` → 404, Bean Validation failures → 400 with per-field messages, `DataIntegrityViolationException` (including the database triggers: cycle prevention, due date within project, and so on) → 400, Spring Security's `AuthenticationException` / `AccessDeniedException` → 401 / 403, `TooManyRequestsException` → 429, and anything else → a generic 500 that is logged server-side and not leaked. Trigger messages are cleaned before they reach the client: Postgres wraps them in an `ERROR: ` prefix and a `Where: PL/pgSQL function ...` line meant for developers, and `cleanPostgresMessage()` strips both so only the sentence survives (for example "Task due_date (...) cannot be later than its project end_date (...)"). This works only because every trigger sets `USING ERRCODE = '23514'`. Without an explicit code Postgres defaults to `P0001`, which is not in the SQLSTATE class that Hibernate and Spring translate into a `ConstraintViolationException` / `DataIntegrityViolationException`, so the error silently fell through to the generic 500 handler. This was a real bug in this project, not a hypothetical. **If you add a cross-row check as a trigger, set the same error code on its `RAISE EXCEPTION`.**

**Known gaps.** No refresh-token flow, no pagination on list endpoints, and `REPORT:GENERATE_REPORTS` gates only the Reports page (there are no server-side report endpoints; see [security.md](security.md)). The first version of the backend was live-tested end to end (login → JWT → role-gated create → nested-response leak check → 404/400/401/403/429 handling) against a real Postgres, which found and fixed three real defects: a `LazyInitializationException` from DTO mapping outside the transaction, `AuthenticationException` falling through to the generic 500 handler, and `createdAt` / `updatedAt` never being set in Java so every create endpoint returned 400 on the database's `NOT NULL`. Current open items: [issues.md](issues.md).

## Database

The backend connects to the schema owned by [database/init/01-init.sql](../database/init/01-init.sql). 18 of its 22 tables have JPA entities and controllers or services: `users`, `roles`, `permissions`, `role_permissions`, `positions`, `departments`, `otp_verifications`, `projects`, `project_members`, `milestones`, `tasks`, `subtasks`, `comments`, `task_assignees`, `task_dependencies`, `notifications`, `activity_logs`, `work_logs`. The other 4 (`checklist_items`, `attachments`, `report_exports`, `kpi_snapshots`) have none yet. `spring.jpa.hibernate.ddl-auto=validate` makes Hibernate check the mappings on startup and never alter the schema. Schema, seed data, triggers and migrations: [database.md](database.md).

**Connects as a least-privileged role, not the superuser.** `database/init/03-app-role.sh` creates `taskmanager_app` (`SELECT`/`INSERT`/`UPDATE`/`DELETE` on the 17 read-write tables above (plus `SELECT` on `permissions`), plus `USAGE` on the sequences behind their identity primary keys; no `SUPERUSER`, `CREATEDB` or `CREATEROLE`, so it cannot touch other tables or change the schema). The backend connects as that role by default (`SPRING_DATASOURCE_USERNAME` / `PASSWORD`, `TASKMANAGER_APP_PASSWORD` in `.env.example` and `docker-compose.yml`) and does not reuse the `POSTGRES_USER` superuser, which stays reserved for container initialization and migrations. Giving a new table an entity means adding a matching `GRANT` line to that script (and to the equivalent step in `.github/workflows/ci.yml`). Grants only take effect on a fresh volume (`docker compose down -v && docker compose up -d`); on an existing database apply the `GRANT` once by hand. Forgetting this produces a runtime `permission denied for table …` and a `500` on any endpoint that reads the table (this happened with `work_logs`).

## Logging

Errors and notable events are written to a rotating file (`backend/logs/log.txt`) as well as the console, configured with `logging.*` properties in `application.properties` (Spring Boot's default Logback setup, no separate config file). Rotation: 10 MB per file, 14 days of history, 100 MB total cap.

`GlobalExceptionHandler` logs every handled failure path, not only unhandled ones: `WARN` for not-found, validation failures, database constraint violations, access-denied, failed logins and rate-limited logins (429); `ERROR` with the full stack trace for anything unexpected (500s). SQL statements (`spring.jpa.show-sql=true`) land in the same file. Spring Security's own logger defaults to `INFO`; set `SECURITY_LOG_LEVEL=DEBUG` locally for verbose JWT and role troubleshooting, but not generally, because it is noisy.

In Docker the file is `/app/logs/log.txt` inside the `backend` container; `docker-compose.yml` mounts `./backend/logs:/app/logs`, so it is also visible on the host at `backend/logs/log.txt`. The file is git-ignored, but the directory is kept in git through a `.gitkeep` so the bind mount has somewhere to attach on a fresh clone. Running with `./mvnw spring-boot:run` from `backend/` writes to the same relative path. The runtime container runs as a non-root `spring` user: if `backend/logs` ends up root-owned on the host (some Linux Docker setups create bind-mount directories as root), grant it write access once, for example `chmod 777 backend/logs`, before starting the stack.

## Team invitations

There is no separate `teams` table: a project is a team and its `project_members` rows are the membership. `ProjectMemberService` layers an invite, accept and decline workflow on top of that table. Full state machine and rules: [users-and-projects.md](users-and-projects.md#4-invitations). Summary:

- `project_members.status` is `PENDING` / `ACTIVE` / `DECLINED` (default `ACTIVE`). The direct-add path (`POST /api/project-members`, used by `ProjectService.ensureManagerIsMember`) still creates `ACTIVE` rows immediately; only `inviteMember` creates or reuses a `PENDING` row.
- `POST /api/project-members/invite` (`{projectId, username}`) is Team-Admin-only. It looks the user up case-insensitively, rejects self-invites, already-`ACTIVE` members and an already-`PENDING` invite, and re-invites a `DECLINED` row instead of creating a duplicate (the `(project_id, user_id)` `UNIQUE` constraint allows one row per pair).
- `POST /api/project-members/project/{projectId}/accept` and `.../decline` are for the invited user only (resolved by JWT identity) and stamp `responded_at`. Accepting is the only way a `PENDING` row becomes a membership; declining leaves no membership, but the row and its `DECLINED` status persist.
- `GET .../project/{projectId}/invitations` lists `PENDING` invitations, `.../invitations/count` returns `{ "count": n }` counted from the `PENDING` status, and `.../invitable-users?q=&limit=` is a type-ahead of `ACTIVE` accounts anywhere in the organisation, excluding the caller and anyone `ACTIVE` or `PENDING` on the project, matched on username or full name and capped at 20. All three are Team-Admin-only.
- **Eligibility:** `INACTIVE`, `SUSPENDED` and `PENDING_VERIFICATION` accounts are rejected by both `inviteMember` and the direct-add `createProjectMember` (`assertEligibleForTeam`).
- **A `PENDING` invitation grants no access.** `ProjectMemberRepository.findProjectIdsByUserId`, the scoping boundary behind every `getAllX()` method, filters to `status = 'ACTIVE'`, and the trigger `check_assignee_is_project_member` does the same for task assignment, so an invitee cannot be assigned or see the project's tasks, milestones or members until they accept.

## Task & Subtask rules

Beyond the database gates (a task cannot become `COMPLETED` while a subtask is incomplete; a task cannot move to `IN_PROGRESS` / `IN_REVIEW` / `COMPLETED` while it depends on an incomplete task), the service layer adds two behaviours that live only in application code. Fuller treatment: [tasks.md](tasks.md).

- **Touching a subtask on a still-`TO_DO` task promotes it to `IN_PROGRESS`.** `SubtaskService.startTaskIfStillToDo` runs at the end of every `updateSubtask`. It is a one-way, one-time move: it fires only while the task is still `TO_DO` (so it never fights a caller who set the task back to `TO_DO` and never re-fires once the task has moved on), and it is skipped if the task is blocked by an incomplete dependency. Attempting the move anyway would trip the database's dependency gate and roll back the subtask update with it, so it first checks `TaskDependencyRepository.existsByTaskIdAndDependsOnTaskStatusNot` and leaves the task at `TO_DO` if so.
- **A task's "Blocked" state is surfaced, not only enforced.** `TaskService.toResponses` batches one query (`TaskDependencyRepository.findBlockingTasks`) across the whole task list to set `TaskResponse.blocked` and `blockingTaskTitles`. `blocked` is true whenever the task depends on at least one not-yet-`COMPLETED` task, and `blockingTaskTitles` names which ones, so a client can show why a task cannot start instead of failing silently against the database gate. The same batching sets `actualHours` from the work logs.

## Notifications

`entity/Notification.java` maps the `notifications` table; every endpoint in `controller/NotificationController.java` is scoped to the caller's own by JWT identity (see [Security](#security)). Notifications are created by `service/NotificationService.java`, called from other services right after the triggering change is saved, not by a database trigger (see [ADR 0007](adr/0007-application-created-notifications.md)). Full trigger table: [notifications.md](notifications.md).

- `TaskAssigneeService.createTaskAssignee` → `notifyTaskAssigned`: every new assignment.
- `TaskService.updateTask` → `notifyTaskStatusChanged`: only when `status` actually changed (compared before and after `applyRequest`), to every current assignee.
- `ProjectMemberService.inviteMember` → `notifyTeamInvitation`: every new or re-sent invitation, to the invitee.
- `ProjectMemberService.respondToInvitation` → `notifyInvitationResponded`: when the invitee accepts or declines, to whoever sent the invitation (`project_members.invited_by`). This "notify an Admin of a member's action" case did not exist anywhere before; it is new, not a repaired bug.

Of the 9 `type` values the `notifications.type` `CHECK` allows, 4 are produced today. `COMMENT_ADDED` is not wired up (creating a comment notifies nobody). `DEADLINE_REMINDER` and `OVERDUE_TASK` are not triggered by any user action, so they need a scheduled job, not just another service call. `PROJECT_UPDATED` and `MILESTONE_UPDATED` would be straightforward (same pattern, hung off `ProjectService` / `MilestoneService`) but have not been added.

## Frontend integration

The React frontend ([frontend.md](frontend.md)) calls this API directly for every page. It uses relative `/api/...` paths: nginx reverse-proxies them to this backend in the Docker build ([frontend/nginx.conf](../frontend/nginx.conf)), and a matching Vite dev-server proxy does the same for `npm run dev`, so neither environment needs CORS or a hardcoded backend URL. `app.cors.allowed-origins` remains as a fallback for any direct cross-origin call.

Known integration gaps: the activity log is per task only (`GET /api/activity-logs/task/{taskId}`, shown in the task panel's Activity section), with no project-wide or per-user feed; and comments do not trigger a `COMMENT_ADDED` notification.

## Current status

```text
Backend project setup         done
Spring Boot / Java 25         done
Database connection           done (least-privilege role, ddl-auto=validate)
JPA entities and repositories done (16 entities)
Business REST APIs            done: 19 controllers, 91 endpoints (17 resources + auth + health + photos + work logs + permissions)
DTOs (no raw entities in/out) done
Bean Validation on requests   done
Global exception handling     done (404/400/401/403/429, no leaked stack traces)
JWT authentication            done
Self-registration + OTP       done (register, verify-otp, resend-otp; email via Mailpit locally)
Authorization                 done (data-driven role x resource x action matrix, project-scoped, ADMINISTRATOR bypass, task approval gate)
CORS, password hashing        done
Login rate limiting           done (in-memory, 5 attempts / 15 min per IP+username)
Least-privilege DB role       done
Unit tests                    partial: 67 unit/context tests, no controller or repository tests; see testing.md
File logging                  done (rotating backend/logs/log.txt)
Notifications                 partial: 4 of 9 types produced
Self-service profile update   done (/me, /me/password, /me/photo, /me/preferences)
Team invitations              done
Subtasks and comments         done
Position / Department lists   done
Activity log (per task)       done; no project-wide feed
Task auto-promotion, Blocked  done
Last-owner protection         done
Time tracking (work logs)     done (added 2026-10-08)
Frontend/backend integration  done
```

## Next steps

Roughly in priority order. The prioritised plan with reasoning is in [roadmap.md](roadmap.md) and the requirements audit in [checklist/](checklist/).

1. Server-side report endpoints gated by `REPORT:GENERATE_REPORTS` (today only the page is gated).
2. Pagination and search/filter on list endpoints (`GET /api/projects`, `/api/tasks`, and so on return everything).
3. Entities and controllers for the remaining DB-only tables (`checklist_items`, `attachments`, `report_exports`, `kpi_snapshots`) and endpoints over the reporting views.
4. A project-wide or per-user activity and audit feed.
5. Broader test coverage: controller and integration tests, not only service and handler unit tests.
6. Flyway now runs as a one-shot Compose service (`migrate`); wiring it into CI and a production deployment is still open (see [database.md](database.md#8-migrations-vs-the-init-script)).
7. `COMMENT_ADDED`, deadline and overdue notifications (needs a scheduler).
8. A refresh-token flow: access tokens currently just expire (default 1 hour) with no renewal short of logging in again.

## Contributing

Branch naming and the pull-request workflow are in [../Contributing.md](../Contributing.md) (backend branches use `backend/<task>`). Keep this documentation current in the same pull request as the change; see [README.md](README.md#keeping-the-documentation-current).
