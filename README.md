# Task & Project Management System

A full-stack task and project management app — React (Vite) frontend, Spring Boot REST API backend, PostgreSQL database, containerized with Docker and built via GitHub Actions.

**Documentation:** project-level documentation lives in [docs/](docs/README.md) — setup guide, architecture, authentication/authorization, API reference, database, testing, known issues, roadmap, changelog and decision records.

## Features

- **JWT Authentication + self-registration**: login with a username **or e-mail address** and a password, issuing a signed JWT (HS512); passwords hashed with BCrypt, never stored or returned in plaintext. New accounts can also self-register and must verify a one-time email code (sent via Mailpit locally) before they can log in
- **Project-scoped authorization**: three system roles (`USER` — the default, no special access; `PROJECT_MANAGER` — may create projects; `ADMINISTRATOR` — a global bypass for user/role management and every project) and four per-project roles (`OWNER` = the project's Project Manager, `ADMIN` = Team Leader, `MEMBER` = Team Member, `VIEWER` in `project_members`). Every check asks a data-driven resource × action matrix (`permissions` / `role_permissions`, editable by an administrator) through `ProjectAccessGuard` — an `OWNER` can do everything on the project except what the matrix withholds, an `ADMIN` manages content and approves work, a `MEMBER` works on tasks assigned to them, a `VIEWER` is read-only, and a project always has exactly one active `OWNER` (see [ADR-0015](docs/adr/0015-two-level-roles-system-and-project.md))
- **Project & Task Management API**: full CRUD for projects, tasks, milestones, project members, task assignees, task dependencies, subtasks, checklist items, comments (with replies), file attachments and time logs, plus the task approval workflow, the manager views (team tasks, workload, dashboard statistics) and server-side KPIs and reports — all 119 endpoints are in [docs/api-reference.md](docs/api-reference.md)
- **Task Dependencies**: model "task X can't start until task Y is done," with database-level cycle prevention; blocked tasks are surfaced to API/UI consumers by name, not just silently rejected
- **Subtask/task status rules**: a task can't be marked `COMPLETED` while it has an incomplete subtask; touching a subtask on a still-To-Do task auto-promotes it to In Progress (skipped if the task is itself blocked by an incomplete dependency) — see [Task & Subtask Rules](docs/backend.md#task--subtask-rules)
- **Database-enforced business rules**: auto-managed timestamps, date-range validation (task/milestone due dates constrained to their project's dates), case-insensitive username/email uniqueness, task-dependency ordering (a task can't go active while a dependency is incomplete, checked from both directions), assignment integrity (assignee must be an active project member), task/milestone/project consistency, and project/milestone/task progress auto-derived from completion (writable but not authoritative — recomputed on every relevant change)
- **Role-level permissions**: the `permissions` / `role_permissions` matrix (seven actions — View, Create, Edit, Delete, Assign, Approve, Generate Reports — over each resource, for both the system and the project roles) is what the backend enforces, cached and re-read when an administrator saves the grid in *Administration → Roles & Permissions* (see [docs/database.md](docs/database.md#13-authorization-and-permissions) and [ADR-0014](docs/adr/0014-requirement-roles-and-permission-matrix.md))
- **Overdue detection**: a `v_overdue_tasks` view plus a `fn_generate_overdue_notifications()` DB function feed the overdue state, and a daily scheduled job (`DeadlineScheduler`, 08:00 and at startup) sends the **deadline reminders** (3 and 1 days before) and **overdue notices** to the assignees and the project Owner, at most once each — see [docs/notifications.md](docs/notifications.md#8-deadline-reminders-and-overdue-notices-since-2026-10-10); overdue/blocked state is also surfaced directly on tasks in the UI (an "N overdue tasks" badge on the project detail page, a lock icon + tooltip naming the blocking task)
- **Frontend UI** (React, wired to the live backend API): login, self-registration + OTP verification, dashboard (project and task statistics, Delayed projects, recent activity, manager workload), Kanban board, calendar, project list with search, filters and sort, a full project detail page (status/priority/dates/manager/progress, a filterable task list with an Add Task action, members with a role picker, milestones, attachments, activity, plus team-tasks, workload, timeline and Gantt views), task list, team view, Reports (overview charts, the five KPIs and the seven named reports), administration (users, roles and permissions), profile, and settings (including a light/dark theme switcher) — all fetching real data, with working sort/search/filter and create/edit/delete flows (not just reads)
- **Task workflow**: a task's status advances one stage per click (To Do → In Progress → In Review → Completed) and never silently reopens a finished task. Entering review opens an **approval request**: a Team Leader or the Owner (or a designated approver) approves it, requests changes or rejects it with a comment, and nobody approves their own work except the Owner — see [docs/tasks.md](docs/tasks.md)
- **Notifications**: real per-user notifications (not mocked) — created automatically on task assignment (naming the assigner, project and due date), task status change, approval requests and decisions, deadline reminders, overdue notices and project invitations/responses, with a read/unread bell dropdown in the UI — see [Notifications](docs/notifications.md). Comments, project updates and milestone updates are not produced yet
- **Activity log**: a history feed (who did what, when) per task, per project and a recent-activity list for the dashboard — project, task, subtask, milestone, comment, file and approval events are written internally by the services, not directly postable
- **Self-service account settings**: any authenticated user can update their own profile, password, and photo (`PUT /api/users/me`, `/me/password`, `/me/photo`) without needing an Administrator
- **Backend file logging**: errors and security/business events (validation failures, access-denied, failed logins, unhandled exceptions) are written to a rotating log file (`backend/logs/log.txt`), not just the console — see [Logging](docs/backend.md#logging)

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

- Java 25 (LTS)
- Spring Boot 4.0.8 — REST API framework (Web MVC, Data JPA, Security, Validation, OAuth2 Resource Server starters)
- Spring Data JPA / Hibernate 7.2.24 — ORM/data layer
- Spring Security + JWT (`jjwt` 0.12.6, HS512) — stateless authentication; most authorization is project-scoped checks in service code (`ProjectAccessGuard`) rather than `@PreAuthorize`, which is now reserved for the handful of genuinely system-wide actions
- Jakarta Bean Validation — request validation
- Spring Mail (`spring-boot-starter-mail`) — sends the self-registration OTP email (SMTP via the docker-compose `mailpit` service locally)
- PostgreSQL JDBC driver — database connectivity (`ddl-auto=validate`; schema owned by SQL files, not Hibernate)
- Maven (bundled `./mvnw` wrapper) — build tool

### Database

- PostgreSQL 18 (`postgres:18-alpine` in Docker; CI uses `postgres:16` as a throwaway test instance)
- Plain SQL schema ([database/init/01-init.sql](database/init/01-init.sql)), no ORM-driven schema generation
- Flyway (via Redgate Flyway Desktop) — versioned migration history ([database/taskmanager/](database/taskmanager/)), applied to an existing database by the one-shot `migrate` service in `docker-compose.yml`; the Spring app itself does not run Flyway

### Frontend

- React 19.2 — UI library
- Vite 8.2 — build tool / dev server
- React Router DOM 7.18 — routing
- Recharts 3.10 — charts (Reports/Dashboard)
- Tailwind CSS 4.3 (`@tailwindcss/vite`) — styling, including a light/dark theme CSS-variable system
- lucide-react — icon set
- Playwright (`@playwright/test`) — end-to-end tests (`frontend/e2e/`) that drive the real app against the real backend, no mocking — see [docs/frontend.md](docs/frontend.md#testing)
- React Context — `layout/LayoutContext.jsx` (local UI state: sidebar/layout), `auth/AuthContext.jsx` (JWT + logged-in user), `theme/ThemeContext.jsx` (light/dark/system theme preference), `data/UsersContext.jsx` (fetched user directory, for avatar/assignee lookups), `data/NotificationsContext.jsx` (unread count + list, backing the top-bar bell). No react-query/SWR/Redux — a small custom `useApi` hook (`api/useApi.js`) covers fetch-on-mount/refetch for a project this size
- Small reusable UI primitives (`components/ui/`) — `Modal`, `Dropdown` (generic popover, used for filter/sort menus, the notifications bell, and per-row action menus), `ConfirmDialog`, `Toast`, `Skeleton`, `EmptyState`, `LookupSelect` (position/department pickers) — built once and reused rather than one-off per page

## Architecture Overview

### Backend Architecture

```
backend/src/main/java/backend/
├── BackendApplication.java   # Entry point
├── controller/                # REST controllers — bind/validate requests, delegate to services (25 controllers)
├── service/                   # Business logic, transaction boundaries, DTO <-> entity mapping
│                               # (includes ProjectAccessGuard — the shared project-scoped authorization check)
├── entity/                    # JPA entities (22 of the schema's 24 tables mapped; `report_exports` and `kpi_snapshots` are not)
├── repository/                # Spring Data JPA repositories
├── dto/                       # Request/response DTOs — no controller binds/returns raw entities
├── exception/                 # NotFoundException + GlobalExceptionHandler (@RestControllerAdvice)
├── util/                      # TextFormat — shared humanize/formatting helpers
└── config/                    # SecurityConfig — JWT, CORS, method security
```

### Frontend Architecture

```
frontend/src/
├── main.jsx            # Entry point — wraps App in AuthProvider + ThemeProvider + UsersProvider + NotificationsProvider + ToastProvider
├── App.jsx             # Route definitions (/login, /register, /verify-otp public, everything else behind ProtectedRoute)
├── pages/               # One file per route — Login, Register, VerifyOtp, Dashboard, Projects, ProjectDetail,
│                        # ProjectViews (team tasks / workload / timeline / Gantt), Tasks, Kanban, Team, Calendar, Reports,
│                        # Profile, Settings, Help (Help & Support), ErrorPage (404, 403, 500 … for every error status),
│                        # admin/UsersAdmin, admin/RolesPermissions
├── components/          # Shared components (ProjectCard, StatCard, TaskDetailPanel, TaskFormModal, NewProjectModal,
│                        # AddMemberModal, AddLookupModal)
├── components/ui/       # Presentational primitives (Avatar, Badge, DonutChart, ProgressBar, ProgressRing, LookupSelect,
│                        # Modal, Dropdown, ConfirmDialog, Toast, Skeleton, EmptyState)
├── layout/              # App shell — Sidebar, TopBar (search/filter/notifications bell), layout state (React Context)
├── auth/                # AuthContext (JWT/login/logout/refreshProfile) + ProtectedRoute
├── theme/               # ThemeContext (light/dark/system preference, persisted per-user)
├── api/                 # Fetch client + one file per backend resource (projects, tasks, subtasks, comments, milestones,
│                        # taskAssignees, taskDependencies, projectMembers, users, roles, positions, departments,
│                        # notifications, activityLog, auth, ...) + stats/format/relations/permissions/validation helpers
├── data/                # UsersContext.jsx (getMember(id) for avatar/assignee lookups), NotificationsContext.jsx (unread count + list)
└── styles/global.css    # Tailwind entry point + light/dark theme CSS variables

frontend/e2e/            # Playwright end-to-end specs — see docs/frontend.md#testing
```

### Key Design Decisions

1. **Stateless JWT auth over sessions** — the JWT carries the user's role as a custom claim; a custom `JwtAuthenticationConverter` maps it into a Spring Security authority, since the default converter only reads OAuth2 `scope` claims.
2. **Project-scoped, row-level authorization, not global role gates** — `@PreAuthorize` is now reserved for the few genuinely system-wide actions (user/role management, creating org-wide Positions/Departments); almost everything else is checked in service code (`ProjectAccessGuard`) against the caller's own `project_members.project_role` for that *specific* project (`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`), not a global role. Task updates layer one more row-level check on top: anyone who isn't a project `OWNER`/`ADMIN` may only update a task they're personally assigned to, and only its status/progress.
3. **DTOs on every endpoint, not raw entities** — prevents leaking fields like `passwordHash` through nested associations (e.g. a project's `manager`), and decouples the API shape from the JPA entity graph.
4. **Schema owned by hand-written SQL, not Hibernate** — `ddl-auto=validate`, so the app fails fast if entities drift from the real schema instead of silently auto-migrating.
5. **Business rules pushed into the database via triggers** where they're cross-row (cycle prevention and ordering on task dependencies, date-range checks, assignee/project-membership integrity, task/milestone/project consistency, project/milestone progress kept in sync with task completion) — Java-level validation only covers what's expressible per-request (Bean Validation). Each `RAISE EXCEPTION` explicitly sets `ERRCODE = '23514'` (check_violation) — without it, Postgres's default error code isn't in the SQLSTATE class Hibernate treats as a constraint violation, so the error would fall through to a generic unhandled 500 instead of a clean 400 with the actual reason. Full list: [docs/database.md](docs/database.md#5-triggers-and-functions).
6. **Notifications are created by application code, not database triggers** (`NotificationService`, called from `TaskAssigneeService`, `TaskService`, `TaskApprovalService` and `ProjectMemberService`) — unlike the cross-row rules above, "who should be notified" already requires looking up related rows (assignees) that the service layer has on hand anyway, and keeping it in Java keeps the notification text/type logic in one reusable place instead of duplicated PL/pgSQL.
7. **First use of `Authentication` as a controller parameter** (`UserController.updateOwnProfile`, `NotificationController`) — every other endpoint operates on an explicit `{id}` path variable; self-service endpoints instead resolve "who is this?" from `authentication.getName()` (the JWT's `sub` claim), so a user can only ever act on their own row.
8. **Frontend calls the backend via relative `/api/...` paths, not an absolute URL** — nginx already reverse-proxies `/api/` to the backend container in the Docker build ([frontend/nginx.conf](frontend/nginx.conf)), and a matching Vite dev-server proxy (`frontend/vite.config.js`) makes the same code work under `npm run dev`. No frontend env var for the API base URL is needed.
9. **A subtask touch can promote its parent task, but never demote or complete it** — checking a box on a still-To-Do task's subtask auto-promotes the task to In Progress (a clear "work has started" signal), but nothing ever auto-completes a task just because every subtask is done, and unchecking a subtask never reverts the parent — task status stays otherwise entirely manual, so a user's own explicit status change is never second-guessed. See [Task & Subtask Rules](docs/backend.md#task--subtask-rules).

## Prerequisites

- Java 25 (backend)
- Node.js 20 (pinned in CI) and npm (frontend)
- PostgreSQL 18, or Docker + Docker Compose to run it in a container
- Maven (or the bundled `./mvnw` wrapper)
- Git

## Setup Instructions

1. Clone the repo.
2. Copy the root env file: `cp .env.example .env` (used by Docker Compose for Postgres/backend/frontend ports and credentials).
3. Backend: `cd backend && ./mvnw spring-boot:run` — reads DB connection from `SPRING_DATASOURCE_*` env vars (defaults match `.env.example`) and the JWT secret from `JWT_SECRET`. Self-registration needs somewhere to send the OTP email — either point `MAIL_*` at a real SMTP server, or just run the docker-compose stack (below), which starts a local Mailpit catcher automatically.
4. Frontend: `cd frontend && npm install && npm run dev`.

Running the full stack via Docker Compose (`docker compose up -d --build`, see [Running the Application](#running-the-application)) covers steps 3–4 for you, plus Postgres and Mailpit — the fastest way to get everything running together.

## Environment Variables

### Root `.env` (Docker Compose)

| Variable | Description | Example |
|---|---|---|
| POSTGRES_USER | Postgres superuser (init/migrations only — the backend doesn't connect as this) | postgres |
| POSTGRES_PASSWORD | Postgres superuser password | postgres |
| POSTGRES_DB | Database name | taskmanager |
| POSTGRES_PORT | Host port for Postgres | 5432 |
| TASKMANAGER_APP_PASSWORD | Password for `taskmanager_app`, the least-privileged role the backend actually connects as (see [docs/database.md](docs/database.md#7-least-privilege-application-role)) | (long random string — change in every real deployment) |
| BACKEND_PORT | Host port for the backend container | 8080 |
| FRONTEND_PORT | Host port for the frontend container | 5173 |
| MAIL_HOST / MAIL_PORT | SMTP server for the registration OTP email | mailpit / 1025 (docker-compose default) |
| MAIL_USERNAME / MAIL_PASSWORD | SMTP auth, if the server needs it | (blank for Mailpit) |
| MAIL_SMTP_AUTH / MAIL_SMTP_STARTTLS | SMTP auth/STARTTLS toggles | false / false (Mailpit needs neither) |
| MAIL_FROM | "From" address on the OTP email | no-reply@taskflow.dev |
| MAILPIT_SMTP_PORT / MAILPIT_UI_PORT | Host ports for Mailpit's SMTP listener and its web UI (`http://localhost:8025`) | 1025 / 8025 |

### Backend (`application.properties`, overridable via env)

| Variable | Description | Example |
|---|---|---|
| SPRING_DATASOURCE_URL | JDBC connection string | jdbc:postgresql://localhost:5432/taskmanager |
| SPRING_DATASOURCE_USERNAME | DB username | taskmanager_app |
| SPRING_DATASOURCE_PASSWORD | DB password | taskmanager_app_password |
| JWT_SECRET | HMAC signing key for JWTs | (long random string — change in every real deployment; a startup `WARN` fires if this is left at the built-in default) |
| JWT_EXPIRATION_MS | Token lifetime in ms | 3600000 |
| CORS_ALLOWED_ORIGINS | Comma-separated allowed origins | http://localhost:5173,http://localhost:80 |
| SECURITY_LOG_LEVEL | Log level for Spring Security's own logger | INFO (default); DEBUG for local JWT/role troubleshooting |
| DEADLINES_ENABLED / DEADLINES_CRON / DEADLINES_RUN_ON_STARTUP | Deadline reminders and overdue notices: on/off, schedule (Spring cron, server time), and whether to also run once at startup | true / `0 0 8 * * *` / true |
| MAIL_HOST / MAIL_PORT / MAIL_USERNAME / MAIL_PASSWORD / MAIL_SMTP_AUTH / MAIL_SMTP_STARTTLS / MAIL_FROM | SMTP config for the self-registration OTP email | see the root `.env` table above — same variables, consumed directly by the backend |

Frontend has no `.env` of its own — it calls the backend via relative `/api/...` paths (proxied by nginx in Docker, by Vite's dev server otherwise), so no API base URL needs configuring.

## Database Migrations

Schema currently lives in [database/init/01-init.sql](database/init/01-init.sql), applied automatically by Postgres (`docker-entrypoint-initdb.d`) the first time the container's data volume is created, or manually via `psql -f database/init/01-init.sql`. A parallel Flyway project ([database/taskmanager/](database/taskmanager/)) tracks the same schema as versioned migrations (`V1__initial_schema.sql` … `V13__attachments_checklists.sql`), which the Compose `migrate` service applies to a database that already exists — see [docs/database.md](docs/database.md#8-migrations-vs-the-init-script). [database/verify_invariants.sql](database/verify_invariants.sql) has a standalone set of zero-rows-expected sanity checks for the business rules below.

Main tables: `roles`, `permissions`, `role_permissions`, `positions`, `departments`, `users`, `otp_verifications`, `projects`, `project_members`, `milestones`, `tasks`, `task_assignees`, `task_dependencies`, `subtasks`, `checklist_items`, `comments`, `attachments`, `work_logs`, `notifications`, `activity_logs`, `report_exports`, `kpi_snapshots` (22 total, plus `task_approvals` and `attachment_contents` from V12 and V13) — plus derived reporting views (`v_overdue_tasks`, `v_project_status_summary`, `v_task_completion_by_project`, `v_team_performance`, `v_team_workload`).

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
| Mailpit (local SMTP catcher for OTP emails) | http://localhost:8025 (UI) / localhost:1025 (SMTP) |

The frontend's nginx container proxies `/api/*` to the backend, so the app and API are reachable from the same origin. The backend waits on both Postgres and Mailpit's healthchecks before starting.

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

- [ci.yml](.github/workflows/ci.yml) — every PR into `dev`/`main`: frontend lint + build (the Playwright E2E suite exists but isn't wired into this job yet — see [docs/frontend.md](docs/frontend.md#testing)); backend job loads `database/init/*.sql` into a throwaway Postgres instance, runs `database/verify_invariants.sql` and fails the build if any check returns rows, then runs `mvn verify`; plus a Docker build check for both images.
- [cd.yml](.github/workflows/cd.yml) — on push to `dev`/`main` (i.e. after a merge): builds and pushes both images to GitHub Container Registry (`ghcr.io`) — `main` → tag `latest`, `dev` → tag `dev`.

There's no automated deploy step yet (a commented-out SSH-deploy example sits in `cd.yml`) — getting the built images onto wherever the demo actually runs is still manual.

## API Documentation

Endpoint-by-endpoint contract (request/response schemas): [api/openapi.yaml](api/openapi.yaml) — covers the core resources but has drifted from a few newer additions (registration/OTP, positions/departments, subtasks, comments, activity logs, photos); see [docs/api-reference.md#18-the-legacy-openapiyaml](docs/api-reference.md#18-the-legacy-openapiyaml) for exactly what's missing from it and [docs/backend.md](docs/backend.md#api-endpoints) for the authoritative current endpoint list.

Base URL: `http://localhost:8080` (or the docker-compose frontend's `/api/*` proxy).

### Authentication

```
POST /api/auth/login
Content-Type: application/json

{ "username": "admin.system", "password": "..." }
```

(`username` also accepts the account's e-mail address, in any letter case.) Response:

```json
{ "token": "<JWT>", "username": "admin.system", "role": "ADMINISTRATOR" }
```

(`role` is `ADMINISTRATOR`, `PROJECT_MANAGER` or `USER` — the three system roles; a normal project member's real authority comes from their per-project role, not this field — see [Key Design Decisions](#key-design-decisions).)

Send the token on every other request: `Authorization: Bearer <token>`.

New accounts can also self-register instead of being created by an Administrator — `POST /api/auth/register` (creates a `PENDING_VERIFICATION` account and emails a one-time code), then `POST /api/auth/verify-otp` to activate it (`POST /api/auth/resend-otp` to get a fresh code). All three are public, like `login`.

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
| Auth | `/api/auth/*` | Public — `login`, `register`, `verify-otp`, `resend-otp` |
| Photos | `/api/photos/{token}` | Public — serves a profile photo by its unguessable upload token |
| Users | `/api/users` | Administrator only (except the `/me*` self-service endpoints — any authenticated user, see above) |
| Roles | `/api/roles` | Administrator only |
| Positions / Departments | `/api/positions`, `/api/departments` | Create: Administrator only. Read: any authenticated user |
| Projects | `/api/projects` | Create: `PROJECT:CREATE` — Project Manager or Administrator (the creator becomes that project's `OWNER`). Update: that project's `OWNER`/`ADMIN`. Delete: the `OWNER` or an Administrator |
| Milestones | `/api/milestones` | That project's `OWNER`/`ADMIN`, or Administrator |
| Tasks | `/api/tasks` | Create: that project's `OWNER`/`ADMIN` (a Team Member cannot). Update: `OWNER`/`ADMIN` can edit any task in full; an assigned `MEMBER` may only change status/progress. Delete: `OWNER`/`ADMIN`. Moving a task to In Review opens an approval request (`/api/tasks/{id}/approval/submit`) |
| Subtasks / checklist items | `/api/subtasks`, `/api/checklist-items` | Members who may edit content; a Team Member only on tasks assigned to them |
| Comments | `/api/comments` | Read: any active project member; create: any member except a Viewer. Edit: comment author only. Delete: author, or that project's `OWNER`/`ADMIN`. Replies carry a `parentCommentId` of the same task |
| Attachments / Work logs | `/api/attachments`, `/api/work-logs` | Per the permission matrix: members upload files and log time, the uploader or a Team Leader deletes |
| Task approvals | `/api/tasks/{id}/approval/*`, `/api/tasks/{id}/approver`, `/api/approvals/pending` | Request: an assigned member. Decide: an approver (`TASK:APPROVE`) — never on your own work, except the Owner and Administrators |
| Dashboard, team views, reports | `/api/dashboard`, `/api/projects/{id}/team-tasks`, `/api/projects/{id}/workload`, `/api/reports/*` | Read-only; scoped to the caller's projects. Reports need `REPORT:GENERATE_REPORTS`, checked on the server |
| Activity Logs | `/api/activity-logs` | Read-only (`/task/{taskId}`, `/project/{projectId}`, `/recent`) — any active member of that project |
| Project Members | `/api/project-members` | Direct add/update/delete: that project's `OWNER`/`ADMIN`. Invite/accept/decline sub-endpoints: see [docs/backend.md](docs/backend.md#team-invitations) |
| Task Assignees | `/api/task-assignees` | That project's `OWNER`/`ADMIN` |
| Task Dependencies | `/api/task-dependencies` | That project's `OWNER`/`ADMIN` |
| Notifications | `/api/notifications` | Any authenticated user — always scoped to "your own" by JWT identity, not by role |

All `GET` endpoints require only a valid token, further scoped to the caller's own project memberships (see [docs/backend.md](docs/backend.md#security)). Not yet implemented: `report_exports` / `kpi_snapshots` have tables but no entity or API (the reports and KPIs are calculated live by `/api/reports/*` instead; see [docs/database.md](docs/database.md#14-api--backend-coverage) for the full DB-only list).

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
| 429 | Too many failed login attempts — try again after the rate-limit window |
| 500 | Unexpected server error (logged server-side, not leaked to the client) |

## Project Structure

Data models as returned by the API (full column-level detail, including tables with no API yet, is in [docs/database.md](docs/database.md)):

**User**
- id: Long
- fullName, username, email: String
- passwordHash: String — BCrypt hash, never returned by the API
- gender, dateOfBirth, phoneNumber: optional profile fields
- position: Position (optional), department: Department (optional)
- profilePhotoUrl: String — computed, `/api/photos/{token}` if a photo is set, else null (the photo bytes themselves aren't returned inline)
- role: Role
- accountStatus: String — ACTIVE | INACTIVE | SUSPENDED | PENDING_VERIFICATION
- themePreference: String — LIGHT | DARK | SYSTEM
- taskNotificationsEnabled: boolean
- createdAt, updatedAt: OffsetDateTime

**Role**
- id: Long
- name: String — system roles ADMINISTRATOR | PROJECT_MANAGER | USER, and project roles OWNER | ADMIN | MEMBER | VIEWER (see [ADR-0015](docs/adr/0015-two-level-roles-system-and-project.md); a user's real authority inside a project comes from `ProjectMember.projectRole`)
- description: String

**Position** / **Department**
- id: Long
- name: String
- Org-wide lookup lists, Administrator-managed, referenced by `User.position`/`User.department`.

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
- status: String — TODO | IN_PROGRESS | IN_REVIEW | COMPLETED | CANCELLED
- startDate, dueDate: LocalDate (optional)
- estimatedHours, progress: BigDecimal
- completedAt: OffsetDateTime (optional)
- createdBy: User (optional)
- createdAt, updatedAt: OffsetDateTime

**ProjectMember**
- id: Long
- project: Project
- user: User
- projectRole: String — OWNER | ADMIN | MEMBER | VIEWER (this project's actual authority — see [Key Design Decisions](#key-design-decisions))
- status: String — PENDING | ACTIVE | DECLINED (invitation state — a PENDING row grants no access at all)
- invitedBy: User (optional)
- respondedAt: OffsetDateTime (optional)
- joinedAt: OffsetDateTime

**Subtask**
- id: Long
- task: Task
- title: String
- assignee: User (optional)
- dueDate: LocalDate (optional)
- status: String — TODO | IN_PROGRESS | COMPLETED
- createdAt, updatedAt: OffsetDateTime

**Comment**
- id: Long
- task: Task
- user: User (author)
- parentComment: Comment (optional — for replies)
- message: String
- createdAt, updatedAt: OffsetDateTime

**ActivityLog**
- id: Long
- user: User (who performed the action)
- project: Project, task: Task (optional)
- action: String — e.g. PROJECT_CREATED, TASK_STATUS_CHANGED, SUBTASK_COMPLETED, COMMENT_ADDED, FILE_UPLOADED, TASK_APPROVED
- description: String — human-readable summary
- createdAt: OffsetDateTime

**TaskAssignee**
- id: Long
- task: Task
- user: User
- assignedAt: OffsetDateTime

**TaskDependency**
- task: Task
- dependsOnTask: Task — `task` can't start until `dependsOnTask` is `COMPLETED` (enforced by database triggers — a dependent task cannot move to In Progress/In Review/Completed while a prerequisite is incomplete); cycles are rejected at the database level

**Notification**
- id: Long
- type: String — 11 values are allowed; eight are created by *application* code today (TASK_ASSIGNED, TASK_STATUS_CHANGED, the two approval types, TEAM_INVITATION, TEAM_INVITATION_RESPONDED, and — from the daily scheduled job — DEADLINE_REMINDER and OVERDUE_TASK; see [docs/notifications.md](docs/notifications.md)). COMMENT_ADDED, PROJECT_UPDATED and MILESTONE_UPDATED are not produced
- title, message: String
- project: Project (optional), task: Task (optional) — what the notification is about, if anything
- read: boolean
- createdAt: OffsetDateTime

## Security Features

1. Passwords hashed with BCrypt on create/update — never stored or returned in plaintext.
2. Stateless JWT authentication (HS512) with a configurable secret and expiry.
3. Self-registration requires email OTP verification before an account can log in — `PENDING_VERIFICATION` accounts are rejected by `login`.
4. Project-scoped authorization on every write endpoint — a project `OWNER`/`ADMIN`/`MEMBER`/`VIEWER` row, checked per-request against that specific project (`ProjectAccessGuard` asking the permission matrix), not a coarse global role; reports are gated the same way on the server (`REPORT:GENERATE_REPORTS`); only user/role management and org-wide lookup-list creation remain gated by `@PreAuthorize`.
5. Project-scoped read authorization too — every `GET` for a single resource or "by parent id" list checks the caller has an active membership in that specific project (404, not 403, if not — existence isn't leaked either).
6. A project always has exactly one active `OWNER` — a second one is refused, ownership moves in a single step (the previous owner becomes `ADMIN`), and a deferred database trigger backs this up (it is skipped when the whole project is being deleted).
7. CORS restricted to a configurable allow-list of origins (`app.cors.allowed-origins`), not wide open.
8. Every request DTO validated with Jakarta Bean Validation (`@Valid`) — required fields, `@Email`, string length limits, and enum-like fields pinned to the values the database `CHECK` constraints allow.
9. No raw JPA entities in request/response bodies — a DTO layer on every endpoint, which also means nested associations (e.g. a project's `manager`) never leak `passwordHash`.
10. Errors don't leak internals — a global exception handler returns clean JSON for 404/400/401/403; unexpected exceptions are logged server-side and returned as a generic 500 with no stack trace sent to the client.
11. Database-level integrity: case-insensitive unique username/email, `CHECK` constraints on enum-like columns, and triggers preventing task-dependency cycles and out-of-range dates.
12. Self-service profile updates (`PUT /api/users/me` and its `/me/password`, `/me/photo`, `/me/preferences` siblings) can only ever touch the caller's own row — the target user comes from the JWT (`authentication.getName()`), never a client-supplied id, and the request DTO has no `roleId`/`accountStatus` field for a user to escalate themselves with.
13. Notification endpoints are ownership-checked, not just role-gated — `GET /api/notifications` scopes to the caller's own rows, and marking one read verifies it actually belongs to the caller (404, not 403, if not — so a client can't probe which ids exist).
14. Task updates are ownership-checked for anyone who isn't a project `OWNER`/`ADMIN` — `PUT /api/tasks/{id}` requires the caller to be a current assignee of that task, and even then only applies `status`/`progress` from the request.
15. Profile photos are served publicly (`GET /api/photos/{token}`, since an `<img>` tag can't send a bearer token) by an unguessable per-upload token, not the user's id — so photos can't be enumerated.
16. Login rate limiting — 5 failed attempts per 15 minutes per IP+username returns `429` instead of continuing to accept guesses.
17. The backend connects to Postgres as a dedicated least-privileged role (`taskmanager_app`), not the superuser — see [docs/database.md](docs/database.md#7-least-privilege-application-role).
18. A startup check warns (doesn't fail, since there's no profile system or real deploy target yet) if `JWT_SECRET` is left at its built-in development default.

Not yet implemented: refresh tokens, and an idle-timeout auto-logout (see [Future Enhancements](#future-enhancements)).

## Testing the API

No Postman collection or Swagger UI wired in yet — test manually with `curl` (or import [api/openapi.yaml](api/openapi.yaml) into Postman/Insomnia, keeping in mind it's missing a few newer endpoints — see [docs/api-reference.md#18-the-legacy-openapiyaml](docs/api-reference.md#18-the-legacy-openapiyaml)). Every seeded user (`database/init/02-seed.sql`) shares the password `DevPassword123!`. Example:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin.system","password":"DevPassword123!"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")

curl http://localhost:8080/api/projects -H "Authorization: Bearer $TOKEN"
```

Or just log into the frontend directly at http://localhost:5173 with any seeded `ACTIVE` username (e.g. `admin.system`, `pm.olivia`) and password `DevPassword123!`.

Automated backend tests: `cd backend && ./mvnw test` (requires a running Postgres matching the schema — currently 306 tests across 29 classes — the Spring context load, the exception handler, the services (users, projects, members, tasks, approvals, milestones, comments, attachments, checklists, reports, team views, activity log, work logs), the permission matrix itself and the JWT validator; service logic is covered with mocked repositories, there are no controller or repository integration tests yet). Automated frontend tests: `cd frontend && npm run test:e2e` — a Playwright end-to-end suite (108 tests across the `auth`, `projects`, `project-team`, `team`, `permissions`, `time-tracking`, `roles-permissions`, `batch1`, `approvals`, `collaboration`, `manager-views`, `reports`, `gantt` and `help-errors` specs; run with `npx playwright test --workers=4`, since the default 8 workers are intermittently flaky) that drives the real app against the real backend (requires `docker compose up -d` first); see [docs/frontend.md](docs/frontend.md#testing). No frontend unit-test runner is wired into `package.json` yet, and the E2E suite isn't wired into CI. Full inventory, regression-test map and coverage gaps: [docs/testing.md](docs/testing.md).

## Troubleshooting

**Backend**
- `Web server failed to start. Port 8080 was already in use` — another instance (often the docker-compose `backend` container) is already running on that port; stop it, or run with `-Dspring-boot.run.arguments="--server.port=8081"`.
- Schema-validation errors on startup (missing table/column) — the running Postgres has an older schema than `database/init/01-init.sql`; `docker compose down -v && docker compose up -d` to rebuild it from scratch (init scripts only run against an empty data volume).
- 401 on every request except login/health — check the `Authorization: Bearer <token>` header is present and the token hasn't expired (`JWT_EXPIRATION_MS`, default 1 hour).

**Frontend**
- Login fails for every seeded user — check you're using the password `DevPassword123!`; if it still fails, confirm the DB actually has the corrected seed hash (`docker compose down -v && docker compose up -d` reruns `database/init/02-seed.sql` from scratch, since `docker-entrypoint-initdb.d` only runs against an empty data volume).
- Self-registration succeeds but the OTP email never arrives — check Mailpit's UI at http://localhost:8025, not a real inbox; it catches every email the backend sends locally.
- Blank/stuck page after login, or data never loads — check `backend/logs/log.txt` (or `docker exec taskmanager-backend tail -f /app/logs/log.txt`) for the actual server-side error; the panel/page itself won't show a raw stack trace by design.
- CORS or network errors calling `/api/*` in `npm run dev` — make sure the backend is actually running on `localhost:8080`; the Vite dev proxy (`frontend/vite.config.js`) forwards there and has nothing to proxy to otherwise.

**Database**
- `docker-entrypoint-initdb.d` scripts silently not applying — they only run the first time a container's data volume is created; `docker compose down -v` first if you've changed `database/init/*.sql`.

## License

TODO — no license file is present in the repo yet.

## Contributors

See [Contributing.md](Contributing.md) and [Role_Requirment.md](Role_Requirment.md) for the team's area assignments (Frontend, Backend, API, Database). Individual contributor names aren't tracked in this README — see the Git history.

## Future Enhancements

- A refresh-token flow — access tokens currently just expire with no renewal path short of logging in again.
- The remaining notification types (`COMMENT_ADDED`, `PROJECT_UPDATED`, `MILESTONE_UPDATED`) — `TASK_ASSIGNED`, `TASK_STATUS_CHANGED`, the two approval types, `TEAM_INVITATION`, `TEAM_INVITATION_RESPONDED`, `DEADLINE_REMINDER` and `OVERDUE_TASK` are wired up in application code so far; comments don't notify anyone yet even though the feature itself is built.
- An idle-timeout auto-logout with a warning (the token currently just expires after one hour).
- Server-side pagination, search and filtering on list endpoints — filtering today runs in the browser over the lists the server already scoped to the caller.
- Run Flyway in CI and in a production deployment (locally the Compose `migrate` service applies new migrations; a fresh volume is still built from the plain-SQL `docker-entrypoint-initdb.d` scripts plus a baseline row).
- PDF / Excel export of the reports, and entities for the remaining DB-only tables `report_exports` and `kpi_snapshots` (the KPIs and the seven reports themselves are calculated live by `GET /api/reports/*`).
- Editing a milestone, showing milestones on the calendar, moving Kanban cards between columns, editing time logs and writing them to the activity feed, and a project completion date.
- Administrator-defined extra system roles (the three built-in system roles and four project roles can have their grants edited, but not be added to).
- Broader automated test coverage (backend controller/integration tests; wire the existing Playwright E2E suite into CI and expand its coverage — see [docs/frontend.md](docs/frontend.md#testing)).
- An actual deploy target for the CD pipeline's built images (currently build-and-push only).
- A per-user or administrator audit view — the activity log API serves a task feed, a project feed and a recent-activity list (`/api/activity-logs/task/{id}`, `/project/{id}`, `/recent`), but no cross-project audit screen.
- Keep `database/init/03-app-role.sh` and `.github/workflows/ci.yml`'s duplicated grant list in step by hand — they match today (21 read-write tables), but nothing enforces it (see [docs/database.md](docs/database.md#7-least-privilege-application-role)).
