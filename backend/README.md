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

Not yet implemented (no controller at all): comments, attachments, work logs, notifications, activity logs, subtasks/checklists — these exist as tables in the schema but have no API surface.

Every write endpoint validates its request body (`@Valid` + Bean Validation) and every "not found" returns a real `404` with a clean JSON body (`{"status":404,"error":"Not Found","message":"..."}`) via `GlobalExceptionHandler` — not a raw stack trace.

## Security

Configured in `config/SecurityConfig.java`.

**Authentication**: `POST /api/auth/login` (username + password) issues a JWT (HS512, signed with `app.jwt.secret` — override via the `JWT_SECRET` env var, expiry via `JWT_EXPIRATION_MS`, default 1 hour). Every other endpoint except `/api/health` requires `Authorization: Bearer <token>`. Passwords are hashed with BCrypt (`PasswordEncoder` bean) both at registration (`POST /api/users`) and on update, if a new password is supplied.

**Authorization**: role-based via `@PreAuthorize` (`@EnableMethodSecurity`). The JWT embeds the user's role as a custom `role` claim (not the OAuth2-standard `scope`/`scp`), so a custom `JwtAuthenticationConverter` bean maps it to a `ROLE_<name>` granted authority — without this, every `hasRole(...)` check would silently fail regardless of the token's actual role. Policy, per resource, is coarse role gates (not per-row ownership):

* `ADMINISTRATOR`-only: user and role management.
* `ADMINISTRATOR` / `PROJECT_MANAGER`: create/update/delete projects.
* `ADMINISTRATOR` / `PROJECT_MANAGER` / `TEAM_LEADER`: milestones, project members, task assignment, task dependencies, and task *creation*/*deletion*.
* Any authenticated role: all `GET` endpoints, and `PUT /api/tasks/{id}` specifically — a `TEAM_MEMBER` needs to update the status/progress of tasks assigned to them, and there's no per-row ownership check yet to scope that more tightly. In practice this means any authenticated user can currently update any task, not just their own — a known gap, not an oversight.

**CORS**: configured via a `CorsConfigurationSource` bean, origins set by `app.cors.allowed-origins` (comma-separated; `CORS_ALLOWED_ORIGINS` env var), defaulting to the Vite dev server and the docker-compose frontend port.

**Error responses**: `exception/GlobalExceptionHandler.java` maps `NotFoundException` → 404, Bean Validation failures → 400 with per-field messages, `DataIntegrityViolationException` (including the Postgres triggers from `database/init/01-init.sql` — cycle prevention, due-date-within-project, etc.) → 400, Spring Security's `AuthenticationException`/`AccessDeniedException` → 401/403, and anything else → a generic 500 (logged server-side, not leaked to the client).

**Known gaps** (not fixed in this pass): no ownership-scoped authorization (see the `TEAM_MEMBER` task note above), no refresh-token flow, no rate limiting on login, no pagination on list endpoints. Live-tested (login → JWT → RBAC-gated create → nested-response leak check → 404/400/401 handling) against a real Postgres instance while building this — see the git history for what specifically broke and got fixed along the way (a real `LazyInitializationException` from DTO mapping happening outside the transaction, `AuthenticationException` initially falling through to the generic 500 handler, and `createdAt`/`updatedAt` never being populated in Java so every create endpoint 400'd on the DB's `NOT NULL` constraint).

## Database

Connected to the schema owned by [database/init/01-init.sql](../database/init/01-init.sql) — 8 core tables (`users`, `roles`, `projects`, `project_members`, `milestones`, `tasks`, `task_assignees`, `task_dependencies`) plus 7 more (`subtasks`, `checklist_items`, `comments`, `attachments`, `work_logs`, `notifications`, `activity_logs`) that don't have JPA entities or a controller yet.

`spring.jpa.hibernate.ddl-auto=validate` — Hibernate checks the entity mappings against the real schema on startup and never alters it. See [database/README.md](../database/README.md) for the schema itself, seed data, business-rule triggers, and the Flyway migration setup.

## Frontend Integration

The frontend team is currently developing and updating the frontend application.

Backend/frontend integration will begin once the frontend API requirements and database schema are available.

The integration will connect the React frontend to the Spring Boot REST API through HTTP requests.

The API contract will define:

* Endpoint URLs
* HTTP methods
* Request data
* Response data
* Authentication requirements
* Validation rules
* Error responses

Planned integration flow:

```text
React Frontend
      |
      | HTTP / REST API
      v
Spring Boot Backend
      |
      v
Service Layer
      |
      v
Repository Layer
      |
      v
PostgreSQL
```

The backend team will coordinate with the frontend team to ensure that frontend API requests match the implemented backend endpoints.

## Current Status

```text
Backend project setup        done
Spring Boot                  done
Java 21                      done
Database connection          done
JPA entities & repositories  done
Business REST APIs           done — 8 resources + auth + health
DTOs (no raw entities in/out) done
Bean Validation on requests  done
Global exception handling    done (404/400/401/403, no leaked stack traces)
JWT authentication           done
Role-based authorization     done — coarse, not per-row ownership (see Security)
CORS                         done
Password hashing             done
Unit tests                   partial — UserService + GlobalExceptionHandler covered, no controller/repository tests yet
Frontend/backend integration pending — frontend still runs entirely on mock data (see frontend/README.md)
```

## Next Steps

Roughly in priority order:

1. Ownership-scoped authorization — a `TEAM_MEMBER` can currently update any task, not just their own; needs a per-row check, not just the coarse role gate.
2. Pagination and search/filter on list endpoints (`GET /api/projects`, `/api/tasks`, etc. return everything, unbounded).
3. Entities/controllers for the remaining 7 tables (`subtasks`, `checklist_items`, `comments`, `attachments`, `work_logs`, `notifications`, `activity_logs`).
4. Business-rule enforcement in application logic that the requirements doc calls for but isn't implemented anywhere yet: task-dependency completion ordering ("can't start until depends-on is COMPLETED" — the DB only prevents *cycles*, not out-of-order starts) and progress roll-up (task → milestone → project).
5. Broader test coverage — controller/integration tests, not just the two service-level unit test classes so far.
6. Wire Flyway (see [database/README.md](../database/README.md#migrations)) so schema migrations apply automatically instead of via `docker-entrypoint-initdb.d`.
7. Connect the React frontend to this API — see [frontend/README.md](../frontend/README.md) and [api/openapi.yaml](../api/openapi.yaml).

## Contributing

See the root `README.md` and `Contributing.md` for branch naming (`backend/<task>`) and the project PR workflow.
