# Task & Project Management System

A full-stack task and project management app — React (Vite) frontend, Spring Boot REST API backend, PostgreSQL database, containerized with Docker and built via GitHub Actions.

## Features

- **JWT Authentication**: username/password login issuing a signed JWT (HS512); passwords hashed with BCrypt, never stored or returned in plaintext
- **Role-Based Authorization**: four roles (Administrator, Project Manager, Team Leader, Team Member), enforced via Spring Security method security on every write endpoint
- **Project & Task Management API**: full CRUD for projects, tasks, milestones, project members, task assignees, and task dependencies, with filtering by project/milestone/status
- **Task Dependencies**: model "task X can't start until task Y is done," with database-level cycle prevention
- **Database-enforced business rules**: auto-managed timestamps, date-range validation (task/milestone due dates constrained to their project's dates), case-insensitive username/email uniqueness
- **Frontend UI** (React, currently built against mock data — not yet wired to the API): dashboard, Kanban board, calendar, project list, task list, team view, and reports/KPI charts

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
- React Context (`layout/LayoutContext.jsx`) — local UI state (sidebar, layout); no data-fetching/global state library yet, since the app isn't wired to the API

## Architecture Overview

### Backend Architecture

```
backend/src/main/java/backend/
├── BackendApplication.java   # Entry point
├── controller/                # REST controllers — bind/validate requests, delegate to services
├── service/                   # Business logic, transaction boundaries, DTO <-> entity mapping
├── entity/                    # JPA entities (8 of 15 database tables mapped so far)
├── repository/                # Spring Data JPA repositories
├── dto/                       # Request/response DTOs — no controller binds/returns raw entities
├── exception/                 # NotFoundException + GlobalExceptionHandler (@RestControllerAdvice)
└── config/                    # SecurityConfig — JWT, CORS, method security
```

### Frontend Architecture

```
frontend/src/
├── main.jsx            # Entry point
├── App.jsx             # Route definitions
├── pages/               # One file per route (Dashboard, Projects, Tasks, Kanban, Team, Calendar, Reports)
├── components/          # Shared components (ProjectCard, StatCard, TaskDetailPanel)
├── components/ui/       # Small presentational primitives (Avatar, Badge, DonutChart, ProgressBar, ProgressRing)
├── layout/              # App shell — Sidebar, TopBar, layout state (React Context)
├── data/mockData.js     # Hardcoded demo data every page currently renders from
└── styles/global.css    # Tailwind entry point
```

### Key Design Decisions

1. **Stateless JWT auth over sessions** — the JWT carries the user's role as a custom claim; a custom `JwtAuthenticationConverter` maps it into a Spring Security authority, since the default converter only reads OAuth2 `scope` claims.
2. **Coarse role-based authorization, not per-row ownership** — `@PreAuthorize` gates by role (e.g. only Administrator/Project Manager can create projects), but there's no row-level check yet — a Team Member can currently update any task, not just their own.
3. **DTOs on every endpoint, not raw entities** — prevents leaking fields like `passwordHash` through nested associations (e.g. a project's `manager`), and decouples the API shape from the JPA entity graph.
4. **Schema owned by hand-written SQL, not Hibernate** — `ddl-auto=validate`, so the app fails fast if entities drift from the real schema instead of silently auto-migrating.
5. **Business rules pushed into the database via triggers** where they're cross-row (cycle prevention on task dependencies, date-range checks) — Java-level validation only covers what's expressible per-request (Bean Validation).
6. **Frontend built decoupled from the backend**, against static mock data — lets UI work proceed in parallel with backend API work; wiring them together is an explicit remaining step, not yet done.

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

Frontend has no `.env` of its own yet — it doesn't call the API at all currently (see [Future Enhancements](#future-enhancements)).

## Database Migrations

Schema currently lives in [database/init/01-init.sql](database/init/01-init.sql), applied automatically by Postgres (`docker-entrypoint-initdb.d`) the first time the container's data volume is created, or manually via `psql -f database/init/01-init.sql`. A parallel Flyway project ([database/taskmanager/](database/taskmanager/)) tracks the same schema as versioned migrations (`V1__initial_schema.sql` onward) for when Flyway gets wired into the actual startup path — see [database/README.md](database/README.md#migrations).

Main tables: `roles`, `users`, `projects`, `project_members`, `milestones`, `tasks`, `task_assignees`, `task_dependencies`, `subtasks`, `checklist_items`, `comments`, `attachments`, `work_logs`, `notifications`, `activity_logs`.

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

### Resources

| Resource | Base path | Write access |
|---|---|---|
| Users | `/api/users` | Administrator only |
| Roles | `/api/roles` | Administrator only |
| Projects | `/api/projects` | Administrator, Project Manager |
| Milestones | `/api/milestones` | Administrator, Project Manager, Team Leader |
| Tasks | `/api/tasks` | Create/delete: Administrator, Project Manager, Team Leader. Update: any authenticated role |
| Project Members | `/api/project-members` | Administrator, Project Manager, Team Leader |
| Task Assignees | `/api/task-assignees` | Administrator, Project Manager, Team Leader |
| Task Dependencies | `/api/task-dependencies` | Administrator, Project Manager, Team Leader |

All `GET` endpoints require only a valid token (any role). Not yet implemented: comments, attachments, work logs, notifications, activity logs, subtasks/checklists — these have database tables but no API.

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

## Security Features

1. Passwords hashed with BCrypt on create/update — never stored or returned in plaintext.
2. Stateless JWT authentication (HS512) with a configurable secret and expiry.
3. Role-based authorization on every write endpoint via `@PreAuthorize` (`@EnableMethodSecurity`).
4. CORS restricted to a configurable allow-list of origins (`app.cors.allowed-origins`), not wide open.
5. Every request DTO validated with Jakarta Bean Validation (`@Valid`) — required fields, `@Email`, string length limits, and enum-like fields pinned to the values the database `CHECK` constraints allow.
6. No raw JPA entities in request/response bodies — a DTO layer on every endpoint, which also means nested associations (e.g. a project's `manager`) never leak `passwordHash`.
7. Errors don't leak internals — a global exception handler returns clean JSON for 404/400/401/403; unexpected exceptions are logged server-side and returned as a generic 500 with no stack trace sent to the client.
8. Database-level integrity: case-insensitive unique username/email, `CHECK` constraints on enum-like columns, and triggers preventing task-dependency cycles and out-of-range dates.

Not yet implemented: per-row ownership checks (see [Key Design Decisions](#key-design-decisions)), refresh tokens, rate limiting on login.

## Testing the API

No Postman collection or Swagger UI wired in yet — test manually with `curl` (or import [api/openapi.yaml](api/openapi.yaml) into Postman/Insomnia). Example:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"nikky.sharma","password":"<password>"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")

curl http://localhost:8080/api/projects -H "Authorization: Bearer $TOKEN"
```

Automated backend tests: `cd backend && ./mvnw test` (requires a running Postgres matching the schema — currently 2 unit test classes, `UserServiceTest` and `GlobalExceptionHandlerTest`; no controller/integration tests yet). No frontend test suite exists yet (`npm test` isn't wired into `package.json`).

## Troubleshooting

**Backend**
- `Web server failed to start. Port 8080 was already in use` — another instance (often the docker-compose `backend` container) is already running on that port; stop it, or run with `-Dspring-boot.run.arguments="--server.port=8081"`.
- Schema-validation errors on startup (missing table/column) — the running Postgres has an older schema than `database/init/01-init.sql`; `docker compose down -v && docker compose up -d` to rebuild it from scratch (init scripts only run against an empty data volume).
- 401 on every request except login/health — check the `Authorization: Bearer <token>` header is present and the token hasn't expired (`JWT_EXPIRATION_MS`, default 1 hour).

**Frontend**
- Nothing reflects real backend data no matter what you do — expected for now; every page reads from `src/data/mockData.js`, not the API (see [Future Enhancements](#future-enhancements)).

**Database**
- `docker-entrypoint-initdb.d` scripts silently not applying — they only run the first time a container's data volume is created; `docker compose down -v` first if you've changed `database/init/*.sql`.

## License

TODO — no license file is present in the repo yet.

## Contributors

See [Contributing.md](Contributing.md) and [Role_Requirment.md](Role_Requirment.md) for the team's area assignments (Frontend, Backend, API, Database). Individual contributor names aren't tracked in this README — see the Git history.

## Future Enhancements

- Wire the frontend to the real API (it currently runs entirely on mock data).
- Per-row ownership authorization (e.g. a Team Member restricted to their own assigned tasks).
- Entities/controllers for the remaining 7 tables: subtasks, checklist items, comments, attachments, work logs, notifications, activity logs.
- Pagination and search/filtering on list endpoints.
- Wire Flyway into the actual startup path instead of the current plain-SQL `docker-entrypoint-initdb.d` bootstrap.
- Application-level enforcement of task-dependency ordering ("can't start until depends-on is COMPLETED") and progress roll-up (task → milestone → project) — currently unenforced outside the DB's cycle-prevention trigger.
- Broader automated test coverage (controller/integration tests, frontend tests).
- An actual deploy target for the CD pipeline's built images (currently build-and-push only).
