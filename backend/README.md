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
├── exception/                 # NotFoundException + GlobalExceptionHandler (@RestControllerAdvice)
└── config/                    # SecurityConfig (JWT, CORS, method security)

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
| Users | `/api/users` | Write operations `ADMINISTRATOR`-only |
| Roles | `/api/roles` | Write operations `ADMINISTRATOR`-only |
| Projects | `/api/projects` | Write operations `ADMINISTRATOR`/`PROJECT_MANAGER` |
| Milestones | `/api/milestones` | Write operations `ADMINISTRATOR`/`PROJECT_MANAGER`/`TEAM_LEADER` |
| Tasks | `/api/tasks` | Create/delete restricted; update open to any authenticated role (see [Security](#security)) |
| Project Members | `/api/project-members` | Write operations `ADMINISTRATOR`/`PROJECT_MANAGER`/`TEAM_LEADER` |
| Task Assignees | `/api/task-assignees` | Write operations `ADMINISTRATOR`/`PROJECT_MANAGER`/`TEAM_LEADER` |
| Task Dependencies | `/api/task-dependencies` | Write operations `ADMINISTRATOR`/`PROJECT_MANAGER`/`TEAM_LEADER` |
| Notifications | `/api/notifications` | No `@PreAuthorize` — every endpoint scopes to "the caller's own" by JWT identity instead (see [Notifications](#notifications)) |

Also: `PUT /api/users/me` — self-service profile/password update, any authenticated user, no role gate beyond being logged in (see [Security](#security)).

Not yet implemented (no controller at all): comments, attachments, work logs, activity logs, subtasks/checklists — these exist as tables in the schema but have no API surface.

Every write endpoint validates its request body (`@Valid` + Bean Validation) and every "not found" returns a real `404` with a clean JSON body (`{"status":404,"error":"Not Found","message":"..."}`) via `GlobalExceptionHandler` — not a raw stack trace.

## Security

Configured in `config/SecurityConfig.java`.

**Authentication**: `POST /api/auth/login` (username + password) issues a JWT (HS512, signed with `app.jwt.secret` — override via the `JWT_SECRET` env var, expiry via `JWT_EXPIRATION_MS`, default 1 hour). Every other endpoint except `/api/health` requires `Authorization: Bearer <token>`. Passwords are hashed with BCrypt (`PasswordEncoder` bean) both at registration (`POST /api/users`) and on update, if a new password is supplied.

**Authorization**: role-based via `@PreAuthorize` (`@EnableMethodSecurity`). The JWT embeds the user's role as a custom `role` claim (not the OAuth2-standard `scope`/`scp`), so a custom `JwtAuthenticationConverter` bean maps it to a `ROLE_<name>` granted authority — without this, every `hasRole(...)` check would silently fail regardless of the token's actual role. Policy, per resource, is coarse role gates (not per-row ownership):

* `ADMINISTRATOR`-only: user and role management.
* `ADMINISTRATOR` / `PROJECT_MANAGER`: create/update/delete projects.
* `ADMINISTRATOR` / `PROJECT_MANAGER` / `TEAM_LEADER`: milestones, project members, task assignment, task dependencies, and task *creation*/*deletion*.
* Any authenticated role: all `GET` endpoints, and `PUT /api/tasks/{id}` specifically — a `TEAM_MEMBER` needs to update the status/progress of tasks assigned to them, and there's no per-row ownership check yet to scope that more tightly. In practice this means any authenticated user can currently update any task, not just their own — a known gap, not an oversight.
* Any authenticated role, but self-scoped rather than role-gated: `PUT /api/users/me` (own profile/password) and every `/api/notifications` endpoint. These are the first endpoints in the codebase to take a plain `Authentication authentication` controller parameter and resolve the acting user from `authentication.getName()` (the JWT's `sub` claim) instead of a path variable — so there's no id to tamper with in the first place. `NotificationService.markAsRead` additionally checks the row's `user_id` actually matches before mutating it, throwing `NotFoundException` (not `AccessDeniedException`) if it doesn't, so a client can't distinguish "not yours" from "doesn't exist."

**CORS**: configured via a `CorsConfigurationSource` bean, origins set by `app.cors.allowed-origins` (comma-separated; `CORS_ALLOWED_ORIGINS` env var), defaulting to the Vite dev server and the docker-compose frontend port.

**Error responses**: `exception/GlobalExceptionHandler.java` maps `NotFoundException` → 404, Bean Validation failures → 400 with per-field messages, `DataIntegrityViolationException` (including the Postgres triggers from `database/init/01-init.sql` — cycle prevention, due-date-within-project, etc.) → 400, Spring Security's `AuthenticationException`/`AccessDeniedException` → 401/403, and anything else → a generic 500 (logged server-side, not leaked to the client). The trigger-raised messages are also cleaned up before they reach the client — Postgres wraps them in an `ERROR: ` prefix and a `Where: PL/pgSQL function ...` line meant for a developer, which `cleanPostgresMessage()` strips so only the actual sentence (e.g. "Task due_date (...) cannot be later than its project end_date (...)") survives. This only works at all because the triggers set `ERRCODE = '23514'` — without an explicit error code, Postgres's default (`P0001`) isn't in the SQLSTATE class Hibernate maps to `ConstraintViolationException`/`DataIntegrityViolationException`, so the error silently fell through to the generic 500 handler instead (a real bug this project hit, not a hypothetical).

**Known gaps** (not fixed in this pass): no ownership-scoped authorization (see the `TEAM_MEMBER` task note above), no refresh-token flow, no rate limiting on login, no pagination on list endpoints. Live-tested (login → JWT → RBAC-gated create → nested-response leak check → 404/400/401 handling) against a real Postgres instance while building this — see the git history for what specifically broke and got fixed along the way (a real `LazyInitializationException` from DTO mapping happening outside the transaction, `AuthenticationException` initially falling through to the generic 500 handler, and `createdAt`/`updatedAt` never being populated in Java so every create endpoint 400'd on the DB's `NOT NULL` constraint).

## Database

Connected to the schema owned by [database/init/01-init.sql](../database/init/01-init.sql) — 9 core tables (`users`, `roles`, `projects`, `project_members`, `milestones`, `tasks`, `task_assignees`, `task_dependencies`, `notifications`) plus 6 more (`subtasks`, `checklist_items`, `comments`, `attachments`, `work_logs`, `activity_logs`) that don't have JPA entities or a controller yet.

`spring.jpa.hibernate.ddl-auto=validate` — Hibernate checks the entity mappings against the real schema on startup and never alters it. See [database/README.md](../database/README.md) for the schema itself, seed data, business-rule triggers, and the Flyway migration setup.

## Logging

Errors and notable events are written to a rotating log file (`backend/logs/log.txt`), not just the console — configured via `logging.*` properties in `application.properties` (Spring Boot's default Logback setup, no separate config file). Rotation: 10MB per file, 14 days of history, 100MB total cap.

`GlobalExceptionHandler` logs every handled failure path, not just unhandled ones: `WARN` for not-found, validation failures, DB constraint violations, access-denied, and failed logins; `ERROR` (with full stack trace) for anything unexpected (500s). SQL statements (`spring.jpa.show-sql=true`) and Spring Security debug output also land in the same file.

In Docker, the file lives inside the `backend` container at `/app/logs/log.txt`; `docker-compose.yml` mounts `./backend/logs:/app/logs` so it's also visible on the host at `backend/logs/log.txt` (gitignored). Running via `./mvnw spring-boot:run` from `backend/` writes it to that same relative path directly.

## Notifications

`entity/Notification.java` maps the `notifications` table (which existed in the schema with no code behind it until now — see [database/README.md](../database/README.md)). Every endpoint (`controller/NotificationController.java`) is scoped to "the caller's own" by JWT identity rather than gated by role — see [Security](#security) above for the ownership-check details.

Notifications are created by `service/NotificationService.java`, called from other services right after the triggering change is saved — not by a database trigger (see the root README's [Key Design Decisions](../README.md#key-design-decisions) for why):

* `TaskAssigneeService.createTaskAssignee` → `notifyTaskAssigned` — fires on every new assignment.
* `TaskService.updateTask` → `notifyTaskStatusChanged` — fires only when `status` actually changed (compared before/after `applyRequest`), notifying every current assignee of that task.

Of the 7 `type` values the `notifications.type` column's `CHECK` constraint allows, only these two are ever produced by the app today. `COMMENT_ADDED` needs a comment feature that doesn't exist yet; `DEADLINE_REMINDER`/`OVERDUE_TASK` aren't triggered by any user action at all, so they'd need a scheduled job, not just another service call; `PROJECT_UPDATED`/`MILESTONE_UPDATED` would be straightforward to add (same pattern, hung off `ProjectService`/`MilestoneService`) but haven't been.

## Frontend Integration

Done — the React frontend (`frontend/`) calls this API directly over HTTP for every page (login, dashboard, projects, tasks, kanban, team, reports, calendar). It calls relative `/api/...` paths: nginx reverse-proxies those to this backend in the Docker build ([frontend/nginx.conf](../frontend/nginx.conf)), and a matching Vite dev-server proxy does the same for `npm run dev` — so no CORS round-trip or hardcoded backend URL is needed in either environment. `app.cors.allowed-origins` still exists as a fallback for any direct cross-origin call.

Known integration gaps: task subtasks/comments have no backend entity, so they're local-only in the UI (not persisted); there's no per-user activity/audit-log endpoint, so the frontend's Team page doesn't show one anymore (previously mocked).

## Current Status

```text
Backend project setup        done
Spring Boot                  done
Java 21                      done
Database connection          done
JPA entities & repositories  done
Business REST APIs           done — 9 resources + auth + health
DTOs (no raw entities in/out) done
Bean Validation on requests  done
Global exception handling    done (404/400/401/403, no leaked stack traces)
JWT authentication           done
Role-based authorization     done — coarse, not per-row ownership (see Security)
CORS                         done
Password hashing             done
Unit tests                   partial — UserService + GlobalExceptionHandler covered, no controller/repository tests yet
File logging                 done — errors/security events to a rotating backend/logs/log.txt (see Logging above)
Notifications                 done — TASK_ASSIGNED/TASK_STATUS_CHANGED only, see Notifications above
Self-service profile update  done — PUT /api/users/me, see Security above
Frontend/backend integration done — see frontend/README.md
```

## Next Steps

Roughly in priority order:

1. Ownership-scoped authorization — a `TEAM_MEMBER` can currently update any task, not just their own; needs a per-row check, not just the coarse role gate.
2. Pagination and search/filter on list endpoints (`GET /api/projects`, `/api/tasks`, etc. return everything, unbounded).
3. Entities/controllers for the remaining 6 tables (`subtasks`, `checklist_items`, `comments`, `attachments`, `work_logs`, `activity_logs`). Comments in particular would unlock the `COMMENT_ADDED` notification type, which the schema already allows but nothing produces.
4. Business-rule enforcement in application logic that the requirements doc calls for but isn't implemented anywhere yet: task-dependency completion ordering ("can't start until depends-on is COMPLETED" — the DB only prevents *cycles*, not out-of-order starts) and progress roll-up (task → milestone → project).
5. Broader test coverage — controller/integration tests, not just the two service-level unit test classes so far.
6. Wire Flyway (see [database/README.md](../database/README.md#migrations)) so schema migrations apply automatically instead of via `docker-entrypoint-initdb.d`.
7. Backend entities/controllers for subtasks and comments, so the frontend's local-only checklist/comment UI in `TaskDetailPanel` can actually persist (see [frontend/README.md](../frontend/README.md)).

## Contributing

See the root `README.md` and `Contributing.md` for branch naming (`backend/<task>`) and the project PR workflow.
