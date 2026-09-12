# Task & Project Management System

A full-stack task and project management app — React (Vite) frontend, Spring Boot REST API backend, PostgreSQL database, containerized with Docker and built via GitHub Actions.

## Features

- **JWT Authentication**: username/password login issuing a signed JWT (HS512); passwords hashed with BCrypt, never stored or returned in plaintext
- **Role-Based Authorization**: four roles (Administrator, Project Manager, Team Leader, Team Member), enforced via Spring Security method security on every write endpoint
- **Project & Task Management API**: full CRUD for projects, tasks, milestones, project members, task assignees, and task dependencies, with filtering by project/milestone/status
- **Task Dependencies**: model "task X can't start until task Y is done," with database-level cycle prevention
- **Database-enforced business rules**: auto-managed timestamps, date-range validation (task/milestone due dates constrained to their project's dates), case-insensitive username/email uniqueness, task-dependency ordering (a task can't go active while a dependency is incomplete, checked from both directions), assignment integrity (assignee must be an active project member), task/milestone/project consistency, and project/milestone progress auto-derived from task completion (writable but not authoritative — recomputed on every relevant change)
- **Role-level permissions**: a `permissions`/`role_permissions` matrix models the View/Create/Edit/Delete/Assign/Approve/Generate Reports action set per role — not yet consumed by the backend, which still authorizes by role name directly (see [database/README.md](database/README.md#authorization--permissions))
- **Overdue detection**: a `v_overdue_tasks` view plus a `fn_generate_overdue_notifications()` DB function generate `OVERDUE_TASK` notifications, deduped per task/assignee/day — not yet wired to a scheduler (see [Future Enhancements](#future-enhancements))
- **Frontend UI** (React, wired to the live backend API): login, dashboard, Kanban board, calendar, project list, task list, team view, reports/KPI charts, and account settings — all fetching real data, with working sort/search/filter and a task create/edit/delete flow (not just reads)
- **Task workflow**: a task's status advances one stage per click (To Do → Doing → Done) instead of jumping straight to done, matching the intended Kanban flow
- **Notifications**: real per-user notifications (not mocked) — created automatically on task assignment and task status change, with a read/unread bell dropdown in the UI — see [Notifications](backend/README.md#notifications)
- **Self-service account settings**: any authenticated user can update their own profile and password (`PUT /api/users/me`) without needing an Administrator
- **Backend file logging**: errors and security/business events (validation failures, access-denied, failed logins, unhandled exceptions) are written to a rotating log file (`backend/logs/log.txt`), not just the console — see [Logging](backend/README.md#logging)

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
3. [Prerequisites](#prerequisites)
4. [Setup Instructions](#setup-instructions)
5. [Environment Variables](#environment-variables)
6. [Database Migrations](#database-migrations)
7. [Running the Application](#running-the-application)
8. [Deployment](#deployment)
9. [API Documentation](#api-documentation)
10. [Project Structure](#project-structure)
11. [Security Features](#security-features)
12. [Testing the API](#testing-the-api)
13. [Troubleshooting](#troubleshooting)
14. [License](#license)
15. [Contributors](#contributors)
16. [Future Enhancements](#future-enhancements)

## Tech Stack

### Backend

- Java 21
- Spring Boot 4.0.8 — REST API framework (Web MVC, Data JPA, Security, Validation, OAuth2 Resource Server starters)
- Spring Data JPA / Hibernate 7.2.24 — ORM/data layer
- Spring Security + JWT (`jjwt` 0.12.6, HS512) — stateless authentication and method-level `@PreAuthorize` authorization
- Jakarta Bean Validation — request validation
- PostgreSQL JDBC driver — database connectivity (`ddl-auto=validate`; schema owned by SQL files, not Hibernate)
- Maven (bundled `./mvnw` wrapper) — build tool

### Database

- PostgreSQL 18 (`postgres:18-alpine` in Docker; CI uses `postgres:16` as a throwaway test instance)
- Plain SQL schema ([database/init/01-init.sql](database/init/01-init.sql)), no ORM-driven schema generation
- Flyway (via Redgate Flyway Desktop) — versioned migration history ([database/taskmanager/](database/taskmanager/)), not yet wired into the app's startup path

### Frontend

- React 19.2 — UI library
- Vite 8.2 — build tool / dev server
- React Router DOM 7.18 — routing
- Recharts 3.10 — charts (Reports/Dashboard)
- Tailwind CSS 4.3 (`@tailwindcss/vite`) — styling
- lucide-react — icon set
- React Context — `layout/LayoutContext.jsx` (local UI state: sidebar/layout), `auth/AuthContext.jsx` (JWT + logged-in user), `data/UsersContext.jsx` (fetched user directory, for avatar/assignee lookups), `data/NotificationsContext.jsx` (unread count + list, backing the top-bar bell). No react-query/SWR/Redux — a small custom `useApi` hook (`api/useApi.js`) covers fetch-on-mount/refetch for a project this size
- Small reusable UI primitives (`components/ui/`) — `Modal`, `Dropdown` (generic popover, used for filter/sort menus, the notifications bell, and per-row action menus), `ConfirmDialog`, `Toast`, `Skeleton`, `EmptyState` — built once and reused rather than one-off per page

## Architecture Overview

### Backend Architecture

```
backend/src/main/java/backend/
├── BackendApplication.java   # Entry point
├── controller/                # REST controllers — bind/validate requests, delegate to services
├── service/                   # Business logic, transaction boundaries, DTO <-> entity mapping
├── entity/                    # JPA entities (9 of 19 database tables mapped so far)
├── repository/                # Spring Data JPA repositories
├── dto/                       # Request/response DTOs — no controller binds/returns raw entities
├── exception/                 # NotFoundException + GlobalExceptionHandler (@RestControllerAdvice)
└── config/                    # SecurityConfig — JWT, CORS, method security
```

### Frontend Architecture

```
frontend/src/
├── main.jsx            # Entry point — wraps App in AuthProvider + UsersProvider + NotificationsProvider + ToastProvider
├── App.jsx             # Route definitions (/login public, everything else behind ProtectedRoute)
├── pages/               # One file per route (Login, Dashboard, Projects, Tasks, Kanban, Team, Calendar, Reports, Settings)
├── components/          # Shared components (ProjectCard, StatCard, TaskDetailPanel, TaskFormModal, NewProjectModal, AddMemberModal, HelpModal)
├── components/ui/       # Presentational primitives (Avatar, Badge, DonutChart, ProgressBar, ProgressRing, Modal, Dropdown, ConfirmDialog, Toast, Skeleton, EmptyState)
├── layout/              # App shell — Sidebar, TopBar (search/filter/notifications bell), layout state (React Context)
├── auth/                # AuthContext (JWT/login/logout/refreshProfile) + ProtectedRoute
├── api/                 # Fetch client + per-resource calls (projects, tasks, users, roles, notifications, ...) + stats/format/permissions helpers
├── data/                # UsersContext.jsx (getMember(id) for avatar/assignee lookups), NotificationsContext.jsx (unread count + list)
└── styles/global.css    # Tailwind entry point
```

### Key Design Decisions

1. **Stateless JWT auth over sessions** — the JWT carries the user's role as a custom claim; a custom `JwtAuthenticationConverter` maps it into a Spring Security authority, since the default converter only reads OAuth2 `scope` claims.
2. **Coarse role-based authorization, not per-row ownership** — `@PreAuthorize` gates by role (e.g. only Administrator/Project Manager can create projects), but there's no row-level check yet — a Team Member can currently update any task, not just their own.
3. **DTOs on every endpoint, not raw entities** — prevents leaking fields like `passwordHash` through nested associations (e.g. a project's `manager`), and decouples the API shape from the JPA entity graph.
4. **Schema owned by hand-written SQL, not Hibernate** — `ddl-auto=validate`, so the app fails fast if entities drift from the real schema instead of silently auto-migrating.
5. **Business rules pushed into the database via triggers** where they're cross-row (cycle prevention and ordering on task dependencies, date-range checks, assignee/project-membership integrity, task/milestone/project consistency, project/milestone progress kept in sync with task completion) — Java-level validation only covers what's expressible per-request (Bean Validation). Each `RAISE EXCEPTION` explicitly sets `ERRCODE = '23514'` (check_violation) — without it, Postgres's default error code isn't in the SQLSTATE class Hibernate treats as a constraint violation, so the error would fall through to a generic unhandled 500 instead of a clean 400 with the actual reason. Full list: [database/README.md](database/README.md#business-rules-enforced-at-the-db-level).
6. **Notifications are created by application code, not database triggers** (`NotificationService`, called from `TaskAssigneeService`/`TaskService`) — unlike the cross-row rules above, "who should be notified" already requires looking up related rows (assignees) that the service layer has on hand anyway, and keeping it in Java keeps the notification text/type logic in one reusable place instead of duplicated PL/pgSQL.
7. **First use of `Authentication` as a controller parameter** (`UserController.updateOwnProfile`, `NotificationController`) — every other endpoint operates on an explicit `{id}` path variable; self-service endpoints instead resolve "who is this?" from `authentication.getName()` (the JWT's `sub` claim), so a user can only ever act on their own row.
8. **Frontend calls the backend via relative `/api/...` paths, not an absolute URL** — nginx already reverse-proxies `/api/` to the backend container in the Docker build ([frontend/nginx.conf](frontend/nginx.conf)), and a matching Vite dev-server proxy (`frontend/vite.config.js`) makes the same code work under `npm run dev`. No frontend env var for the API base URL is needed.
9. **Some frontend UI state has no backend entity to persist to** — task subtasks/comments in `TaskDetailPanel` are local-only per session (no `subtasks`/`comments` table is wired to a controller yet), and are shown as such in the UI rather than silently pretending to save.

## Prerequisites

- Java 21 (backend)
- Node.js 20 (pinned in CI) and npm (frontend)
- PostgreSQL 18, or Docker + Docker Compose to run it in a container
- Maven (or the bundled `./mvnw` wrapper)
- Git

## Setup Instructions

1. Clone the repo.
2. Copy the root env file: `cp .env.example .env` (used by Docker Compose for Postgres/backend/frontend ports and credentials).
3. Backend: `cd backend && ./mvnw spring-boot:run` — reads DB connection from `SPRING_DATASOURCE_*` env vars (defaults match `.env.example`) and the JWT secret from `JWT_SECRET`.
4. Frontend: `cd frontend && npm install && npm run dev`.

## Environment Variables

### Root `.env` (Docker Compose)

| Variable | Description | Example |
|---|---|---|
| POSTGRES_USER | Postgres superuser | postgres |
| POSTGRES_PASSWORD | Postgres password | postgres |
| POSTGRES_DB | Database name | taskmanager |
| POSTGRES_PORT | Host port for Postgres | 5432 |
| BACKEND_PORT | Host port for the backend container | 8080 |
| FRONTEND_PORT | Host port for the frontend container | 5173 |

### Backend (`application.properties`, overridable via env)

| Variable | Description | Example |
|---|---|---|
| SPRING_DATASOURCE_URL | JDBC connection string | jdbc:postgresql://localhost:5432/taskmanager |
| SPRING_DATASOURCE_USERNAME | DB username | postgres |
| SPRING_DATASOURCE_PASSWORD | DB password | postgres |
| JWT_SECRET | HMAC signing key for JWTs | (long random string — change in every real deployment) |
| JWT_EXPIRATION_MS | Token lifetime in ms | 3600000 |
| CORS_ALLOWED_ORIGINS | Comma-separated allowed origins | http://localhost:5173,http://localhost:80 |

Frontend has no `.env` of its own — it calls the backend via relative `/api/...` paths (proxied by nginx in Docker, by Vite's dev server otherwise), so no API base URL needs configuring.

## Database Migrations

Schema currently lives in [database/init/01-init.sql](database/init/01-init.sql), applied automatically by Postgres (`docker-entrypoint-initdb.d`) the first time the container's data volume is created, or manually via `psql -f database/init/01-init.sql`. A parallel Flyway project ([database/taskmanager/](database/taskmanager/)) tracks the same schema as versioned migrations (`V1__initial_schema.sql`, `V2__add_permissions_progress_and_integrity_rules.sql`) for when Flyway gets wired into the actual startup path — see [database/README.md](database/README.md#migrations). [database/verify_invariants.sql](database/verify_invariants.sql) has a standalone set of zero-rows-expected sanity checks for the business rules below.

Main tables: `roles`, `permissions`, `role_permissions`, `users`, `projects`, `project_members`, `milestones`, `tasks`, `task_assignees`, `task_dependencies`, `subtasks`, `checklist_items`, `comments`, `attachments`, `work_logs`, `notifications`, `activity_logs`, `report_exports`, `kpi_snapshots` — plus derived reporting views (`v_overdue_tasks`, `v_project_status_summary`, `v_task_completion_by_project`, `v_team_performance`, `v_team_workload`).

## Running the Application

### Full stack (Docker)

```bash
cp .env.example .env
docker compose up -d --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8080/api |
| Postgres | localhost:5432 |

The frontend's nginx container proxies `/api/*` to the backend, so the app and API are reachable from the same origin.

### Backend only

```bash
cd backend
./mvnw spring-boot:run
```

→ http://localhost:8080

### Frontend only

```bash
cd frontend
npm run dev
```

→ http://localhost:5173 (Vite dev server)

## Deployment

Both services build as Docker images ([backend/Dockerfile](backend/Dockerfile), [frontend/Dockerfile](frontend/Dockerfile)) — the frontend image serves the built app through nginx, proxying `/api/*` to the backend container.

CI/CD is GitHub Actions:

- [ci.yml](.github/workflows/ci.yml) — every PR into `dev`/`main`: frontend lint + build, backend `mvn verify` against a throwaway Postgres instance (schema loaded from `database/init/*.sql` first), and a Docker build check for both images.
- [cd.yml](.github/workflows/cd.yml) — on push to `dev`/`main` (i.e. after a merge): builds and pushes both images to GitHub Container Registry (`ghcr.io`) — `main` → tag `latest`, `dev` → tag `dev`.

There's no automated deploy step yet (a commented-out SSH-deploy example sits in `cd.yml`) — getting the built images onto wherever the demo actually runs is still manual.

## API Documentation

Full endpoint-by-endpoint contract (request/response schemas): [api/openapi.yaml](api/openapi.yaml) — documents current backend behavior exactly, including known quirks (see [api/README.md](api/README.md)).

Base URL: `http://localhost:8080` (or the docker-compose frontend's `/api/*` proxy).

### Authentication

```
POST /api/auth/login
Content-Type: application/json

{ "username": "nikky.sharma", "password": "..." }
```

Response:

```json
{ "token": "<JWT>", "username": "nikky.sharma", "role": "PROJECT_MANAGER" }
```

Send the token on every other request: `Authorization: Bearer <token>`.

Any authenticated user can also update their own profile/password without Administrator rights:

```
PUT /api/users/me
Authorization: Bearer <token>
Content-Type: application/json

{ "fullName": "...", "email": "...", "password": "..." }
```

(`password` optional — omit/blank to leave it unchanged; no `roleId`/`accountStatus`/`username` — see [Key Design Decisions](#key-design-decisions).)

### Resources

| Resource | Base path | Write access |
|---|---|---|
| Users | `/api/users` | Administrator only (except `PUT /api/users/me`, see above — any authenticated user) |
| Roles | `/api/roles` | Administrator only |
| Projects | `/api/projects` | Administrator, Project Manager |
| Milestones | `/api/milestones` | Administrator, Project Manager, Team Leader |
| Tasks | `/api/tasks` | Create/delete: Administrator, Project Manager, Team Leader. Update: any authenticated role |
| Project Members | `/api/project-members` | Administrator, Project Manager, Team Leader |
| Task Assignees | `/api/task-assignees` | Administrator, Project Manager, Team Leader |
| Task Dependencies | `/api/task-dependencies` | Administrator, Project Manager, Team Leader |
| Notifications | `/api/notifications` | Any authenticated user — always scoped to "your own" by JWT identity, not by role |

All `GET` endpoints require only a valid token (any role). Not yet implemented: comments, attachments, work logs, activity logs, subtasks/checklists, permissions/role_permissions, report_exports/kpi_snapshots, and the reporting views — these have database tables/views but no API (see [database/README.md](database/README.md#api--backend-coverage) for the full DB-only list).

### Status Codes

| Code | Meaning |
|---|---|
| 200 | OK (reads, updates) |
| 201 | Created (all `POST` endpoints) |
| 204 | No Content (all `DELETE` endpoints) |
| 400 | Validation failure or a database constraint/trigger violation |
| 401 | Missing/invalid token, or bad login credentials |
| 403 | Authenticated but not authorized for this action |
| 404 | Resource not found |
| 500 | Unexpected server error (logged server-side, not leaked to the client) |

## Project Structure

Data models as returned by the API (full column-level detail, including tables with no API yet, is in [database/README.md](database/README.md)):

**User**
- id: Long
- fullName, username, email: String
- passwordHash: String — BCrypt hash, never returned by the API
- gender, dateOfBirth, phoneNumber, profilePhotoUrl, position, department: optional profile fields
- role: Role
- accountStatus: String — ACTIVE | INACTIVE | SUSPENDED
- createdAt, updatedAt: OffsetDateTime

**Role**
- id: Long
- name: String — ADMINISTRATOR | PROJECT_MANAGER | TEAM_LEADER | TEAM_MEMBER
- description: String

**Project**
- id: Long
- projectCode, name, description: String
- startDate, endDate: LocalDate
- manager: User
- priority: String — LOW | MEDIUM | HIGH | CRITICAL
- status: String — PLANNING | IN_PROGRESS | ON_HOLD | COMPLETED | CANCELLED
- progress: BigDecimal (0–100)
- createdAt, updatedAt: OffsetDateTime

**Milestone**
- id: Long
- project: Project
- title, description: String
- dueDate: LocalDate
- status: String — PENDING | IN_PROGRESS | COMPLETED
- progress: BigDecimal (0–100)
- createdAt, updatedAt: OffsetDateTime

**Task**
- id: Long
- project: Project
- milestone: Milestone (optional)
- title, description: String
- priority: String — LOW | MEDIUM | HIGH | URGENT
- status: String — TO_DO | IN_PROGRESS | IN_REVIEW | COMPLETED | CANCELLED
- startDate, dueDate: LocalDate (optional)
- estimatedHours, progress: BigDecimal
- completedAt: OffsetDateTime (optional)
- createdBy: User (optional)
- createdAt, updatedAt: OffsetDateTime

**ProjectMember**
- id: Long
- project: Project
- user: User
- projectRole: String — PROJECT_MANAGER | TEAM_LEADER | TEAM_MEMBER
- joinedAt: OffsetDateTime

**TaskAssignee**
- id: Long
- task: Task
- user: User
- assignedAt: OffsetDateTime

**TaskDependency**
- task: Task
- dependsOnTask: Task — `task` can't start until `dependsOnTask` is `COMPLETED` (enforced in application logic, not the DB); cycles are rejected at the database level

**Notification**
- id: Long
- type: String — TASK_ASSIGNED | TASK_STATUS_CHANGED | COMMENT_ADDED | PROJECT_UPDATED | DEADLINE_REMINDER | OVERDUE_TASK | MILESTONE_UPDATED (only the first two are ever created by *application* code today — see [Key Design Decisions](#key-design-decisions); `OVERDUE_TASK` can additionally be generated by calling the DB function `fn_generate_overdue_notifications()` directly, but nothing schedules that call yet)
- title, message: String
- project: Project (optional), task: Task (optional) — what the notification is about, if anything
- read: boolean
- createdAt: OffsetDateTime

## Security Features

1. Passwords hashed with BCrypt on create/update — never stored or returned in plaintext.
2. Stateless JWT authentication (HS512) with a configurable secret and expiry.
3. Role-based authorization on every write endpoint via `@PreAuthorize` (`@EnableMethodSecurity`).
4. CORS restricted to a configurable allow-list of origins (`app.cors.allowed-origins`), not wide open.
5. Every request DTO validated with Jakarta Bean Validation (`@Valid`) — required fields, `@Email`, string length limits, and enum-like fields pinned to the values the database `CHECK` constraints allow.
6. No raw JPA entities in request/response bodies — a DTO layer on every endpoint, which also means nested associations (e.g. a project's `manager`) never leak `passwordHash`.
7. Errors don't leak internals — a global exception handler returns clean JSON for 404/400/401/403; unexpected exceptions are logged server-side and returned as a generic 500 with no stack trace sent to the client.
8. Database-level integrity: case-insensitive unique username/email, `CHECK` constraints on enum-like columns, and triggers preventing task-dependency cycles and out-of-range dates.
9. Self-service profile updates (`PUT /api/users/me`) can only ever touch the caller's own row — the target user comes from the JWT (`authentication.getName()`), never a client-supplied id, and the request DTO has no `roleId`/`accountStatus` field for a user to escalate themselves with.
10. Notification endpoints are ownership-checked, not just role-gated — `GET /api/notifications` scopes to the caller's own rows, and marking one read verifies it actually belongs to the caller (404, not 403, if not — so a client can't probe which ids exist).

Not yet implemented: per-row ownership checks on tasks/projects (see [Key Design Decisions](#key-design-decisions)), refresh tokens, rate limiting on login.

## Testing the API

No Postman collection or Swagger UI wired in yet — test manually with `curl` (or import [api/openapi.yaml](api/openapi.yaml) into Postman/Insomnia). Every seeded user (`database/init/02-seed.sql`) shares the password `secret`. Example:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"nikky.sharma","password":"secret"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")

curl http://localhost:8080/api/projects -H "Authorization: Bearer $TOKEN"
```

Or just log into the frontend directly at http://localhost:5173 with any seeded `ACTIVE` username (e.g. `alex.admin`, `nikky.sharma`) and password `secret`.

Automated backend tests: `cd backend && ./mvnw test` (requires a running Postgres matching the schema — currently 2 unit test classes, `UserServiceTest` and `GlobalExceptionHandlerTest`; no controller/integration tests yet). No frontend test suite exists yet (`npm test` isn't wired into `package.json`).

## Troubleshooting

**Backend**
- `Web server failed to start. Port 8080 was already in use` — another instance (often the docker-compose `backend` container) is already running on that port; stop it, or run with `-Dspring-boot.run.arguments="--server.port=8081"`.
- Schema-validation errors on startup (missing table/column) — the running Postgres has an older schema than `database/init/01-init.sql`; `docker compose down -v && docker compose up -d` to rebuild it from scratch (init scripts only run against an empty data volume).
- 401 on every request except login/health — check the `Authorization: Bearer <token>` header is present and the token hasn't expired (`JWT_EXPIRATION_MS`, default 1 hour).

**Frontend**
- Login fails for every seeded user — check you're using the password `secret`; if it still fails, confirm the DB actually has the corrected seed hash (`docker compose down -v && docker compose up -d` reruns `database/init/02-seed.sql` from scratch, since `docker-entrypoint-initdb.d` only runs against an empty data volume).
- Blank/stuck page after login, or data never loads — check `backend/logs/log.txt` (or `docker exec taskmanager-backend tail -f /app/logs/log.txt`) for the actual server-side error; the panel/page itself won't show a raw stack trace by design.
- CORS or network errors calling `/api/*` in `npm run dev` — make sure the backend is actually running on `localhost:8080`; the Vite dev proxy (`frontend/vite.config.js`) forwards there and has nothing to proxy to otherwise.

**Database**
- `docker-entrypoint-initdb.d` scripts silently not applying — they only run the first time a container's data volume is created; `docker compose down -v` first if you've changed `database/init/*.sql`.

## License

TODO — no license file is present in the repo yet.

## Contributors

See [Contributing.md](Contributing.md) and [Role_Requirment.md](Role_Requirment.md) for the team's area assignments (Frontend, Backend, API, Database). Individual contributor names aren't tracked in this README — see the Git history.

## Future Enhancements

- Per-row ownership authorization (e.g. a Team Member restricted to their own assigned tasks).
- Entities/controllers for the remaining 6 core tables: subtasks, checklist items, comments, attachments, work logs, activity logs.
- Wire the backend to check `role_permissions` (View/Create/Edit/Delete/Assign/Approve/Generate Reports) instead of hardcoded role names — the permission model exists in the database ([database/README.md](database/README.md#authorization--permissions)) but nothing in the backend consults it yet.
- A scheduled job (Spring `@Scheduled`, or `pg_cron`) to actually call `fn_generate_overdue_notifications()` on a cadence — the DB-side detection/generation logic exists, it just isn't invoked automatically yet.
- The remaining notification types (`COMMENT_ADDED`, `PROJECT_UPDATED`, `DEADLINE_REMINDER`, `MILESTONE_UPDATED`) — only `TASK_ASSIGNED`/`TASK_STATUS_CHANGED` are wired up in application code so far; the rest need a comment feature and/or a scheduled job.
- Pagination and search/filtering on list endpoints.
- Wire Flyway into the actual startup path instead of the current plain-SQL `docker-entrypoint-initdb.d` bootstrap.
- Endpoints over the reporting views (`v_project_status_summary`, `v_task_completion_by_project`, `v_team_performance`, `v_team_workload`) and over `report_exports`/`kpi_snapshots` — all exist in the database with no API yet.
- Broader automated test coverage (controller/integration tests, frontend tests).
- An actual deploy target for the CD pipeline's built images (currently build-and-push only).
- Persist task subtasks/comments to the backend (currently local-only in the UI — no `subtasks`/`comments` controller exists yet, see [Key Design Decisions](#key-design-decisions)).
- A real per-user activity/audit feed on the Team page (removed the mock version — no `activity_logs` API exists yet to back it).

Note: task-dependency ordering ("can't go active until every dependency is COMPLETED") and progress roll-up (task → milestone → project) are **already enforced at the database level** via triggers (not merely the cycle-prevention check) — see [database/README.md](database/README.md#task-integrity-rules). What's still missing is any *application-level* pre-check that surfaces a friendlier error before the request round-trips to the database.
