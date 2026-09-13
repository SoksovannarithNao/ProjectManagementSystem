# Backend

Spring Boot REST API for the Task & Project Management System.

## Stack

* Java 21
* Spring Boot 4.0.8 (Web MVC, Data JPA, Security, Validation)
* PostgreSQL — connected, schema owned by [database/init/01-init.sql](../database/init/01-init.sql) (`spring.jpa.hibernate.ddl-auto=validate`, Hibernate never touches the schema itself)
* JWT auth (`jjwt` + Spring Security's OAuth2 resource server support, HS512)
* Maven 3.9.16

## Getting Started

The backend now genuinely needs a running Postgres — `ddl-auto=validate` means Hibernate checks the entity mappings against the real schema on startup, so there's no DB-less fallback mode anymore. Start Postgres first (from the repo root):

```bash
docker compose up -d postgres
```

Then run the backend:

```bash
./mvnw spring-boot:run
```

Backend API:

```text
http://localhost:8080
```

(Use `-Dspring-boot.run.arguments="--server.port=8081"` if you need a different port — e.g. to run alongside the docker-compose `backend` container, which already occupies 8080.)

Run tests:

```bash
./mvnw test
```

Requires the same running Postgres as above — `BackendApplicationTests` boots the full application context, JPA/DataSource included.

## Project Structure

```text
src/main/java/backend/
├── BackendApplication.java    # Application entry point
├── controller/                # REST controllers — bind/validate requests, delegate to services
├── service/                   # Business logic, transaction boundaries, DTO <-> entity mapping
├── entity/                    # JPA entities, one per database/init/01-init.sql table (except roles' created_at, deliberately unmapped)
├── repository/                # Spring Data JPA repositories
├── dto/                       # Request/response shapes — every controller uses these now, none bind/return raw entities
├── exception/                 # NotFoundException, TooManyRequestsException + GlobalExceptionHandler (@RestControllerAdvice)
└── config/                    # SecurityConfig (JWT, CORS, method security), JwtSecretGuard (dev-secret warning)

src/main/resources/
└── application.properties     # Application configuration

src/test/java/backend/         # Tests
```

## API Endpoints

The authoritative, endpoint-by-endpoint contract lives in [api/openapi.yaml](../api/openapi.yaml) — kept in sync with this backend rather than duplicated here. Resource groups currently implemented:

| Resource | Base path | Notes |
| --- | --- | --- |
| Health | `/api/health` | Public, no auth |
| Auth | `/api/auth/login` | Public — issues a JWT |
| Users | `/api/users` | Write operations `ADMINISTRATOR`-only, except `PUT /api/users/{id}/position-department` (see below) |
| Roles | `/api/roles` | Write operations `ADMINISTRATOR`-only |
| Positions | `/api/positions` | Org-wide lookup list. Read: any authenticated user. Create: `ADMINISTRATOR`/`PROJECT_MANAGER`/`TEAM_LEADER` |
| Departments | `/api/departments` | Same shape as Positions |
| Projects | `/api/projects` | Write operations `ADMINISTRATOR`/`PROJECT_MANAGER` |
| Milestones | `/api/milestones` | Write operations `ADMINISTRATOR`/`PROJECT_MANAGER`/`TEAM_LEADER` |
| Tasks | `/api/tasks` | Create/delete: `ADMINISTRATOR`/`PROJECT_MANAGER`/`TEAM_LEADER`. Update: those roles can edit any task in full; a `TEAM_MEMBER` may only update status/progress on a task assigned to them (see [Security](#security)) |
| Subtasks | `/api/subtasks` | Any ACTIVE member of the parent task's project (see [Security](#security)) |
| Comments | `/api/comments` | Create/read: any ACTIVE project member. Edit: comment author only. Delete: author, or `ADMINISTRATOR`/`PROJECT_MANAGER`/`TEAM_LEADER` on that project |
| Project Members | `/api/project-members` | Direct add/update/delete: `ADMINISTRATOR`/`PROJECT_MANAGER`/`TEAM_LEADER`. Team-invitation sub-endpoints (`/invite`, `/project/{id}/accept`, `/project/{id}/decline`, `/project/{id}/invitations`) — see [Team Invitations](#team-invitations) |
| Task Assignees | `/api/task-assignees` | Write operations `ADMINISTRATOR`/`PROJECT_MANAGER`/`TEAM_LEADER` |
| Task Dependencies | `/api/task-dependencies` | Write operations `ADMINISTRATOR`/`PROJECT_MANAGER`/`TEAM_LEADER` |
| Notifications | `/api/notifications` | No `@PreAuthorize` — every endpoint scopes to "the caller's own" by JWT identity instead (see [Notifications](#notifications)) |

Also: `PUT /api/users/me` — self-service profile/password update, any authenticated user, no role gate beyond being logged in (see [Security](#security)). It no longer accepts `position`/`department` at all — those are Team-Admin-managed only, via `PUT /api/users/{id}/position-department` (not role-gated at the annotation level; `UserService.updateMemberPositionDepartment` enforces that the caller administers a project the target user also belongs to, and refuses self-targeting even for `ADMINISTRATOR`).

Not yet implemented (no controller at all): attachments, work logs, activity logs, checklist items — these exist as tables in the schema but have no API surface. (Subtasks and comments *were* on this list — see [Team Invitations](#team-invitations) and the Notifications section below for what changed.)

Every write endpoint validates its request body (`@Valid` + Bean Validation) and every "not found" returns a real `404` with a clean JSON body (`{"status":404,"error":"Not Found","message":"..."}`) via `GlobalExceptionHandler` — not a raw stack trace.

## Security

Configured in `config/SecurityConfig.java`.

**Authentication**: `POST /api/auth/login` (username + password) issues a JWT (HS512, signed with `app.jwt.secret` — override via the `JWT_SECRET` env var, expiry via `JWT_EXPIRATION_MS`, default 1 hour). Every other endpoint except `/api/health` requires `Authorization: Bearer <token>`. Passwords are hashed with BCrypt (`PasswordEncoder` bean) both at registration (`POST /api/users`) and on update, if a new password is supplied. `config/JwtSecretGuard.java` logs a `WARN` on startup if `app.jwt.secret` is still the built-in development default, so an accidental deployment without `JWT_SECRET` set is loud rather than silent (it doesn't fail startup — there's no profile system or real deploy target yet, so failing fast would just break local dev/CI).

**Login rate limiting**: `service/LoginRateLimiter.java` tracks failed attempts in memory, keyed by `remoteAddr:username` (not username alone, so an attacker can't lock a known victim out of their own account by deliberately failing logins under that username from elsewhere; not IP alone, so legitimate users sharing an IP with an attacker aren't punished). After 5 failed attempts within 15 minutes for the same key, further attempts get `429 Too Many Requests` until the window rolls off; a successful login clears the counter. In-memory only — resets on restart, not shared across instances (fine for this single-instance app; would need a shared store like Redis to scale horizontally).

**Authorization**: role-based via `@PreAuthorize` (`@EnableMethodSecurity`). The JWT embeds the user's role as a custom `role` claim (not the OAuth2-standard `scope`/`scp`), so a custom `JwtAuthenticationConverter` bean maps it to a `ROLE_<name>` granted authority — without this, every `hasRole(...)` check would silently fail regardless of the token's actual role. Policy, per resource, is coarse role gates (not per-row ownership), with one ownership-scoped exception:

* `ADMINISTRATOR`-only: user and role management.
* `ADMINISTRATOR` / `PROJECT_MANAGER`: create/update/delete projects.
* `ADMINISTRATOR` / `PROJECT_MANAGER` / `TEAM_LEADER`: milestones, project members, task assignment, task dependencies, and task *creation*/*deletion*. These three roles may also fully edit **any** task via `PUT /api/tasks/{id}`.
* `TEAM_MEMBER` on `PUT /api/tasks/{id}`: ownership-scoped rather than role-gated. `TaskService.updateTask` checks whether the caller is a current assignee of that task (`task_assignees`) — if not, `403 Forbidden`. If they are, only `status`/`progress` from the request body take effect; every other field (title, project, milestone, dates, etc.) is silently left unchanged, even though the client still sends the full `TaskRequest` shape (the existing full-replace PUT contract).
* Any authenticated role: all `GET` endpoints — but see `ProjectAccessGuard` below; "any role can call it" doesn't mean "sees everything."
* Any authenticated role, but self-scoped rather than role-gated: `PUT /api/users/me` (own profile/password) and every `/api/notifications` endpoint. These take a plain `Authentication authentication` controller parameter and resolve the acting user from `authentication.getName()` (the JWT's `sub` claim) instead of a path variable — so there's no id to tamper with in the first place. `NotificationService.markAsRead` additionally checks the row's `user_id` actually matches before mutating it, throwing `NotFoundException` (not `AccessDeniedException`) if it doesn't, so a client can't distinguish "not yours" from "doesn't exist."

**Project-scoped reads (`ProjectAccessGuard`)**: every `GET` endpoint that returns a single resource or a "by parent id" list (`GET /api/tasks/{id}`, `/tasks/project/{id}`, `/tasks/milestone/{id}`, `/tasks/status/{status}`, `/projects/{id}`, `/milestones/*`, `/task-dependencies/*`, `/task-assignees/*`, `/project-members/{id}`, `/project-members/project/{id}`, plus the new `/subtasks/*` and `/comments/*`) now checks the caller is `ADMINISTRATOR` or an ACTIVE `project_members` row for that specific project — 404 (not 403), so existence isn't leaked either. This closed a real gap: those endpoints previously had **no ownership check at all** (unlike their already-scoped `getAllX()` counterparts), so any authenticated user — including a brand-new, zero-membership one — could read another project's tasks/milestones/dependencies by guessing an id. `ProjectAccessGuard` (`service/ProjectAccessGuard.java`) is the one shared helper for this check, used by every service listed above.

**Team Admin (per-project, not just role)**: a few actions need "does the caller actually administer *this* project," not just a coarse global role — `ProjectMemberService.inviteMember` and `UserService.updateMemberPositionDepartment` both require `ADMINISTRATOR`, or the project's designated manager, or an ACTIVE `PROJECT_MANAGER`/`TEAM_LEADER` `project_members` row for that specific project (not just anyone holding that global role). `updateMemberPositionDepartment` additionally refuses self-targeting outright, even for `ADMINISTRATOR` — Position/Department must be set by someone else.

**CORS**: configured via a `CorsConfigurationSource` bean, origins set by `app.cors.allowed-origins` (comma-separated; `CORS_ALLOWED_ORIGINS` env var), defaulting to the Vite dev server and the docker-compose frontend port.

**Error responses**: `exception/GlobalExceptionHandler.java` maps `NotFoundException` → 404, Bean Validation failures → 400 with per-field messages, `DataIntegrityViolationException` (including the Postgres triggers from `database/init/01-init.sql` — cycle prevention, due-date-within-project, etc.) → 400, Spring Security's `AuthenticationException`/`AccessDeniedException` → 401/403, `TooManyRequestsException` → 429, and anything else → a generic 500 (logged server-side, not leaked to the client). The trigger-raised messages are also cleaned up before they reach the client — Postgres wraps them in an `ERROR: ` prefix and a `Where: PL/pgSQL function ...` line meant for a developer, which `cleanPostgresMessage()` strips so only the actual sentence (e.g. "Task due_date (...) cannot be later than its project end_date (...)") survives. This only works at all because the triggers set `ERRCODE = '23514'` — without an explicit error code, Postgres's default (`P0001`) isn't in the SQLSTATE class Hibernate maps to `ConstraintViolationException`/`DataIntegrityViolationException`, so the error silently fell through to the generic 500 handler instead (a real bug this project hit, not a hypothetical).

**Known gaps** (not fixed in this pass): no refresh-token flow, no pagination on list endpoints, authorization still checks hardcoded role names rather than the `permissions`/`role_permissions` tables (see [database/README.md](../database/README.md#authorization--permissions)). Live-tested (login → JWT → RBAC-gated create → nested-response leak check → 404/400/401/403/429 handling) against a real Postgres instance while building this — see the git history for what specifically broke and got fixed along the way (a real `LazyInitializationException` from DTO mapping happening outside the transaction, `AuthenticationException` initially falling through to the generic 500 handler, and `createdAt`/`updatedAt` never being populated in Java so every create endpoint 400'd on the DB's `NOT NULL` constraint).

## Database

Connected to the schema owned by [database/init/01-init.sql](../database/init/01-init.sql) — 13 tables with JPA entities/controllers today (`users`, `roles`, `positions`, `departments`, `projects`, `project_members`, `milestones`, `tasks`, `subtasks`, `comments`, `task_assignees`, `task_dependencies`, `notifications`) plus `otp_verifications`, and 7 more (`checklist_items`, `attachments`, `work_logs`, `activity_logs`, `permissions`/`role_permissions`, `report_exports`/`kpi_snapshots`) that don't have JPA entities or a controller yet.

`spring.jpa.hibernate.ddl-auto=validate` — Hibernate checks the entity mappings against the real schema on startup and never alters it. See [database/README.md](../database/README.md) for the schema itself, seed data, business-rule triggers, and the Flyway migration setup.

**Connects as a least-privileged role, not the superuser.** `database/init/03-app-role.sh` creates `taskmanager_app` (`SELECT`/`INSERT`/`UPDATE`/`DELETE` on the tables above, plus sequence `USAGE` for their identity-column primary keys — no `SUPERUSER`/`CREATEDB`/`CREATEROLE`, can't touch other tables or alter the schema) and the backend connects as that role by default (`SPRING_DATASOURCE_USERNAME`/`PASSWORD`, `TASKMANAGER_APP_PASSWORD` in `.env.example`/`docker-compose.yml`) instead of reusing the `POSTGRES_USER` superuser, which remains reserved for container initialization/migrations. Adding a table's entity later means adding a matching `GRANT` line to that script (and to `.github/workflows/ci.yml`'s equivalent step). This only takes effect after a fresh volume — `docker compose down -v && docker compose up -d` locally.

## Logging

Errors and notable events are written to a rotating log file (`backend/logs/log.txt`), not just the console — configured via `logging.*` properties in `application.properties` (Spring Boot's default Logback setup, no separate config file). Rotation: 10MB per file, 14 days of history, 100MB total cap.

`GlobalExceptionHandler` logs every handled failure path, not just unhandled ones: `WARN` for not-found, validation failures, DB constraint violations, access-denied, failed logins, and rate-limited logins (429); `ERROR` (with full stack trace) for anything unexpected (500s). SQL statements (`spring.jpa.show-sql=true`) also land in the same file. Spring Security's own logger defaults to `INFO` (override with `SECURITY_LOG_LEVEL=DEBUG` locally for verbose JWT/role troubleshooting — not recommended left on generally, since it's noisy).

In Docker, the file lives inside the `backend` container at `/app/logs/log.txt`; `docker-compose.yml` mounts `./backend/logs:/app/logs` so it's also visible on the host at `backend/logs/log.txt` (gitignored, but the directory itself is kept in git via a `.gitkeep` so the bind mount has somewhere to attach on a fresh clone). Running via `./mvnw spring-boot:run` from `backend/` writes it to that same relative path directly. The runtime container runs as a non-root `spring` user — if `backend/logs` ends up root-owned on the host (some Linux Docker setups auto-create bind-mount directories as root), grant it write access once (e.g. `chmod 777 backend/logs`) before starting the stack.

## Team Invitations

There's no separate `teams` table — a `project` *is* a team, and its `project_members` rows are that team's membership. `ProjectMemberService` layers an invite/accept/decline workflow on top of the existing table rather than introducing a parallel structure:

* `project_members.status` (`PENDING`/`ACTIVE`/`DECLINED`, default `ACTIVE`) — the direct-add path (`POST /api/project-members`, used by e.g. `ProjectService.ensureManagerIsMember`) still creates rows `ACTIVE` immediately, unchanged. Only the new `inviteMember` path creates/reuses a `PENDING` row.
* `POST /api/project-members/invite` (`{projectId, username}`) — Team-Admin-only (see [Security](#security)). Looks the target up case-insensitively by username, rejects self-invites, already-`ACTIVE` members, and an already-`PENDING` invite; re-invites a `DECLINED` row rather than creating a duplicate (the `(project_id, user_id)` `UNIQUE` constraint means there can only ever be one row per pair).
* `POST /api/project-members/project/{projectId}/accept` / `.../decline` — the invited user only (resolved by JWT identity, not a role gate); flips `status` and stamps `responded_at`. Accepting is the only way a `PENDING` row becomes a real membership; declining leaves no membership at all, but the row (and its `DECLINED` status) persists rather than being deleted or hidden.
* `GET /api/project-members/project/{projectId}/invitations` — Team-Admin-only; lists that project's `PENDING` invitations.
* **A `PENDING` invitation grants no access whatsoever** — `ProjectMemberRepository.findProjectIdsByUserId` (the scoping boundary used by every `getAllX()` method) filters to `status = 'ACTIVE'`, and `check_assignee_is_project_member` (the DB trigger gating `task_assignees` inserts) does the same, so an invitee can't be assigned to a task, and can't see the project's tasks/milestones/members, until they actually accept.

## Notifications

`entity/Notification.java` maps the `notifications` table (which existed in the schema with no code behind it until now — see [database/README.md](../database/README.md)). Every endpoint (`controller/NotificationController.java`) is scoped to "the caller's own" by JWT identity rather than gated by role — see [Security](#security) above for the ownership-check details.

Notifications are created by `service/NotificationService.java`, called from other services right after the triggering change is saved — not by a database trigger (see the root README's [Key Design Decisions](../README.md#key-design-decisions) for why):

* `TaskAssigneeService.createTaskAssignee` → `notifyTaskAssigned` — fires on every new assignment.
* `TaskService.updateTask` → `notifyTaskStatusChanged` — fires only when `status` actually changed (compared before/after `applyRequest`), notifying every current assignee of that task.
* `ProjectMemberService.inviteMember` → `notifyTeamInvitation` — fires on every new/re-sent invitation, notifying the invitee.
* `ProjectMemberService.respondToInvitation` → `notifyInvitationResponded` — fires when the invitee accepts or declines, notifying whoever sent the invitation (`project_members.invited_by`). This is the "notify an Admin/Team Admin of a member's action" case that previously didn't exist anywhere in the codebase at all — there was no bug to fix, no event ever created this kind of notification; it's new, not repaired.

Of the 9 `type` values the `notifications.type` column's `CHECK` constraint allows, 4 are produced by the app today (the two above, plus `TEAM_INVITATION`/`TEAM_INVITATION_RESPONDED`). `COMMENT_ADDED` still isn't wired up (creating a comment doesn't notify anyone yet, even though comments themselves are now a real feature — see below); `DEADLINE_REMINDER`/`OVERDUE_TASK` aren't triggered by any user action at all, so they'd need a scheduled job, not just another service call; `PROJECT_UPDATED`/`MILESTONE_UPDATED` would be straightforward to add (same pattern, hung off `ProjectService`/`MilestoneService`) but haven't been.

## Frontend Integration

Done — the React frontend (`frontend/`) calls this API directly over HTTP for every page (login, dashboard, projects, tasks, kanban, team, reports, calendar). It calls relative `/api/...` paths: nginx reverse-proxies those to this backend in the Docker build ([frontend/nginx.conf](../frontend/nginx.conf)), and a matching Vite dev-server proxy does the same for `npm run dev` — so no CORS round-trip or hardcoded backend URL is needed in either environment. `app.cors.allowed-origins` still exists as a fallback for any direct cross-origin call.

Known integration gaps: there's no per-user activity/audit-log endpoint, so the frontend's Team page doesn't show one (previously mocked); comments don't trigger a `COMMENT_ADDED` notification yet (see above).

## Current Status

```text
Backend project setup        done
Spring Boot                  done
Java 21                      done
Database connection          done
JPA entities & repositories  done
Business REST APIs           done — 13 resources + auth + health
DTOs (no raw entities in/out) done
Bean Validation on requests  done
Global exception handling    done (404/400/401/403, no leaked stack traces)
JWT authentication           done
Role-based authorization     done — coarse, plus ownership-scoped task updates (see Security)
CORS                         done
Password hashing             done
Login rate limiting          done — in-memory, 5 attempts/15 min per IP+username (see Security)
Least-privilege DB role      done — backend connects as taskmanager_app, not the Postgres superuser (see Database)
Unit tests                   partial — UserService + GlobalExceptionHandler covered, no controller/repository tests yet
File logging                 done — errors/security events to a rotating backend/logs/log.txt (see Logging above)
Notifications                 done — TASK_ASSIGNED/TASK_STATUS_CHANGED/TEAM_INVITATION/TEAM_INVITATION_RESPONDED, see Notifications above
Self-service profile update  done — PUT /api/users/me, see Security above (no longer accepts position/department)
Team invitations              done — see Team Invitations above
Subtasks & comments           done — real entities/controllers, project-membership-scoped (see API Endpoints above)
Position/Department          done — Team-Admin-managed lookup lists, see Security above
Project-scoped read ownership done — ProjectAccessGuard closes the by-id/by-parent-id gap, see Security above
Frontend/backend integration done — see frontend/README.md
```

## Next Steps

Roughly in priority order:

1. Wire authorization to the `permissions`/`role_permissions` tables instead of hardcoded role names (see [database/README.md](../database/README.md#authorization--permissions)).
2. Pagination and search/filter on list endpoints (`GET /api/projects`, `/api/tasks`, etc. return everything, unbounded).
3. Entities/controllers for the remaining 7 DB-only tables (`checklist_items`, `attachments`, `work_logs`, `activity_logs`, `permissions`, `role_permissions`, `report_exports`, `kpi_snapshots`, plus the reporting views).
4. Business-rule enforcement in application logic that the requirements doc calls for but isn't implemented anywhere yet: task-dependency completion ordering ("can't start until depends-on is COMPLETED" — the DB only prevents *cycles*, not out-of-order starts).
5. Broader test coverage — controller/integration tests, not just the three service/handler-level unit test classes so far.
6. Wire Flyway (see [database/README.md](../database/README.md#migrations)) so schema migrations apply automatically instead of via `docker-entrypoint-initdb.d`.
7. `COMMENT_ADDED` notification — comments are now a real, persisted feature (see Team Invitations/API Endpoints above), but creating one doesn't notify anyone yet.
8. Refresh-token flow — access tokens currently just expire (default 1 hour) with no renewal path short of logging in again.

## Contributing

See the root `README.md` and `Contributing.md` for branch naming (`backend/<task>`) and the project PR workflow.
