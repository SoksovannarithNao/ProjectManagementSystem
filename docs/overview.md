# Project Overview

> Verified against the repository on **2026-10-06** (branch `appmod/java-upgrade-20261006031004`, based on `dev`). Everything here was confirmed in the code, the database scripts, the running application, or an existing project document. Where something could not be confirmed it is marked **Unknown / Needs clarification**.

## 1. Purpose and scope

**TaskFlow** (the name shown in the UI and in the OTP email) is a full-stack **task and project management web application**. People register, create projects, build a team, break work into milestones, tasks and subtasks, assign it, track its progress, and discuss it in comments.

The application is built to the requirements in [Role_Requirment.md](../Role_Requirment.md) (the summary) and [Project_requirement_plan.md](../Project_requirement_plan.md) (the detailed plan). The team areas — Frontend, Backend, API, Database — are described in [Contributing.md](../Contributing.md).

**In scope and implemented:** authentication with self-registration, project-level authorization, projects, project membership and invitations, milestones, tasks, subtasks, task dependencies, comments, per-task activity history, notifications, a dashboard, Kanban board, calendar, reports charts, profile and settings.

**In the requirements but not implemented** (see [roadmap.md](roadmap.md)): file attachments, time tracking / work logs, deadline reminders, a Gantt chart, named reports with PDF/Excel export, KPI calculation, a project-wide activity feed.

## 2. Main functionality

| Area | What a user can do | Where it lives |
|---|---|---|
| Accounts | Self-register with an emailed 6-digit code, log in, edit profile, change password, upload a photo, choose a theme | [authentication-authorization.md](authentication-authorization.md) |
| Projects | Create a project (auto-generated code `PRJ-####`), edit it, change its status, delete it (owners only) | [users-and-projects.md](users-and-projects.md) |
| Teams | Invite people to a project, accept or decline invitations, remove members, see pending invitations | [users-and-projects.md](users-and-projects.md) |
| Milestones | Add and delete milestones with due dates; progress is derived from tasks | [tasks.md](tasks.md) |
| Tasks | Create, edit, delete, assign, set priority/dates, advance status, add subtasks, dependencies and comments, see activity | [tasks.md](tasks.md) |
| Views | Dashboard, Tasks (grouped by project, with a *My Tasks* filter), Kanban, Calendar (month/week/day), Reports, Team | [architecture.md](architecture.md#34-frontend-pages-and-routes) |
| Notifications | A bell with unread count: task assigned, task status changed, team invitation (with Accept/Decline), invitation response | [notifications.md](notifications.md) |

## 3. Technology stack

Versions are taken from `backend/pom.xml`, `frontend/package.json`, `docker-compose.yml` and the Dockerfiles.

| Layer | Technology |
|---|---|
| Backend | Java **25**, Spring Boot **4.0.8** (Web MVC, Data JPA, Security, OAuth2 Resource Server, Validation, Mail), Hibernate, `jjwt` **0.12.6**, PostgreSQL JDBC driver, Maven Wrapper **3.9.16** |
| Database | PostgreSQL **18** (`postgres:18-alpine`); schema from hand-written SQL, `spring.jpa.hibernate.ddl-auto=validate` |
| Frontend | React **19.2**, React Router **7.18**, Vite **8.2**, Tailwind CSS **4.3**, Recharts **3.10**, lucide-react |
| Testing | JUnit 5 + Mockito + Spring test starters (backend); Playwright **1.63** (frontend end-to-end) |
| Infrastructure | Docker Compose (`postgres`, `mailpit`, `backend`, `frontend`), nginx (serves the built frontend and proxies `/api/`), GitHub Actions (CI and CD) |
| Local email | Mailpit — an SMTP catcher; nothing leaves the machine |

Not present (confirmed by absence in `pom.xml` / `package.json`): Swagger/springdoc, Spring Actuator, Flyway as an application dependency, Redux/React Query, a frontend unit-test runner, JaCoCo.

## 4. Project structure

```
.
├── backend/               Spring Boot API
│   └── src/main/java/backend/
│       ├── controller/    17 REST controllers (84 endpoints)
│       ├── service/       business rules, transactions, ProjectAccessGuard
│       ├── repository/    Spring Data JPA repositories
│       ├── entity/        15 JPA entities
│       ├── dto/           request/response objects, PasswordPolicy
│       ├── exception/     GlobalExceptionHandler, NotFoundException, ConflictException, TooManyRequestsException
│       ├── config/        SecurityConfig, JwtSecretGuard
│       └── util/          TextFormat
├── frontend/              React app
│   ├── src/pages/         one file per screen (13)
│   ├── src/components/    shared components; components/ui/ = primitives
│   ├── src/api/           fetch client + one module per backend resource
│   ├── src/auth|data|theme|layout/   context providers and the app shell
│   └── e2e/               Playwright specs
├── database/
│   ├── init/              01-init.sql (schema), 02-seed.sql (demo data), 03-app-role.sh
│   ├── taskmanager/       Flyway project (migrations V1–V8) — not run by the app
│   └── verify_invariants.sql
├── api/                   openapi.yaml (partly out of date — see issues.md)
├── docs/                  this documentation
├── .github/workflows/     ci.yml, cd.yml
├── docker-compose.yml
└── .env.example
```

## 5. Current implementation status

Status uses three levels: **Done** (works through UI, API and database), **Partial** (usable but narrower than intended), **Not started** (at most a database table exists). The detailed per-feature view, including evidence and tests, is in [roadmap.md](roadmap.md).

| Feature | Status |
|---|---|
| Authentication, self-registration with OTP, rate-limited login | Done |
| Profile, password change, photo, theme and notification preference | Done |
| Project CRUD, auto-generated project code | Done |
| Project membership, invitations, accept/decline, member search | Done |
| Milestones | Partial — add/delete in the UI; update exists only in the API |
| Tasks, subtasks, dependencies, assignment | Done |
| Comments | Partial — no reply UI; no notification |
| Per-task activity feed | Done (per task only) |
| Notifications | Partial — 4 of 9 types are produced |
| Dashboard, Kanban, Calendar | Partial — see [roadmap.md](roadmap.md) |
| Reports | Partial — charts only, no export |
| Attachments, work logs, checklist items | Not started (tables only) |
| Deadline reminders, overdue notifications | Not started (a database function exists; nothing calls it) |
| Gantt chart, KPI calculation | Not started |

## 6. Where to read next

| If you want… | Read |
|---|---|
| To run the project | [setup.md](setup.md) |
| How the pieces fit together | [architecture.md](architecture.md) |
| Why it was designed this way | [adr/README.md](adr/README.md) |
| What is wrong or missing | [issues.md](issues.md) and [roadmap.md](roadmap.md) |
