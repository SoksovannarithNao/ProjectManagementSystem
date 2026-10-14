# Project Overview

> First verified against the repository on **2026-10-06**; last brought in line with the code on **2026-10-14**. Everything here was confirmed in the code, the database scripts, the running application, or an existing project document. Where something could not be confirmed it is marked **Unknown / Needs clarification**.

## 1. Purpose and scope

**TaskFlow** (the name shown in the UI and in the OTP email) is a full-stack **task and project management web application**. People register, create projects, build a team, break work into milestones, tasks and subtasks, assign it, track its progress, and discuss it in comments.

The application is built to the requirements in [assignment-brief.md](../assignment-brief.md) (the assignment; its Part B is the resolved specification) and [project-workflow.md](../project-workflow.md) (the user flows). The team areas — Frontend, Backend, API, Database — are described in [Contributing.md](../Contributing.md).

**In scope and implemented:** authentication with self-registration, a two-level role model with an editable permission matrix, projects, project membership and invitations, milestones, tasks, subtasks, checklists, attachments, task dependencies, comments, time tracking, the task approval workflow, task / project / recent activity feeds, notifications with deadline reminders, a dashboard, Kanban board, calendar, project team / workload / timeline / Gantt views, server-side KPIs and the seven named reports, administration (users, roles and permissions), profile, settings, a Help page and error pages.

**In the requirements but not implemented** (see [roadmap.md](roadmap.md)): document management (optional).

## 2. Main functionality

| Area | What a user can do | Where it lives |
|---|---|---|
| Accounts | Self-register with an emailed 6-digit code, log in, edit profile, change password, upload a photo, choose a theme | [authentication-authorization.md](authentication-authorization.md) |
| Projects | Create a project (auto-generated code `PRJ-####`), edit it, change its status, delete it (owners only) | [users-and-projects.md](users-and-projects.md) |
| Teams | Invite people to a project, accept or decline invitations, remove members, see pending invitations | [users-and-projects.md](users-and-projects.md) |
| Milestones | Add, edit and delete milestones with due dates; progress is derived from tasks | [tasks.md](tasks.md) |
| Tasks | Create, edit, delete, assign, set priority/dates, advance status, submit for approval, add subtasks, checklist items, attachments, dependencies, comments and time logs, see activity | [tasks.md](tasks.md) |
| Views | Dashboard, Tasks (grouped by project, with a *My Tasks* filter), Kanban, Calendar (month/week/day), Reports (KPIs and seven reports), Team, and per project: team tasks, workload, timeline and Gantt | [architecture.md](architecture.md#34-frontend-pages-and-routes) |
| Administration | Give accounts a system role; edit the role × resource × action permission matrix | [authentication-authorization.md](authentication-authorization.md) |
| Notifications | A bell with unread count: task assigned, status changed, approval requested / decided, team invitation (with Accept/Decline) and its response, deadline reminders, overdue notices, comments, project and milestone updates, @mentions | [notifications.md](notifications.md) |

## 3. Technology stack

Versions are taken from `backend/pom.xml`, `frontend/package.json`, `docker-compose.yml` and the Dockerfiles.

| Layer | Technology |
|---|---|
| Backend | Java **25**, Spring Boot **4.0.8** (Web MVC, Data JPA, Security, OAuth2 Resource Server, Validation, Mail), Hibernate, `jjwt` **0.12.6**, PostgreSQL JDBC driver, Maven Wrapper **3.9.16** |
| Database | PostgreSQL **18** (`postgres:18-alpine`); schema from hand-written SQL, `spring.jpa.hibernate.ddl-auto=validate` |
| Frontend | React **19.2**, React Router **7.18**, Vite **8.2**, Tailwind CSS **4.3**, Recharts **3.10**, lucide-react |
| Testing | JUnit 5 + Mockito + Spring test starters (backend); Vitest **4.1** (frontend unit tests); Playwright **1.63** (frontend end-to-end) |
| Infrastructure | Docker Compose (`postgres`, the one-shot Flyway `migrate`, `mailpit`, `backend`, `frontend`), nginx (serves the built frontend and proxies `/api/`), GitHub Actions (CI and CD) |
| Local email | Mailpit — an SMTP catcher; nothing leaves the machine |

Not present (confirmed by absence in `pom.xml` / `package.json`): Swagger/springdoc, Spring Actuator, Flyway as an application dependency, Redux/React Query, JaCoCo.

## 4. Project structure

```
.
├── backend/               Spring Boot API
│   └── src/main/java/backend/
│       ├── controller/    26 REST controllers (128 endpoints)
│       ├── service/       business rules, transactions, ProjectAccessGuard
│       ├── repository/    Spring Data JPA repositories
│       ├── entity/        24 JPA entities
│       ├── dto/           request/response objects, PasswordPolicy
│       ├── security/      Resource and Action enums, PermissionChecker
│       ├── exception/     GlobalExceptionHandler, NotFoundException, ConflictException, TooManyRequestsException, SessionExpiredException
│       ├── config/        SecurityConfig, JwtSecretGuard, ActiveAccountJwtValidator, DeadlineScheduler
│       └── util/          TextFormat, Derived, WorkloadClassifier, FileTypeGuard, Mentions, ProjectListQuery, TaskListQuery, PageParams
├── frontend/              React app
│   ├── src/pages/         one file per screen (19, including the three under admin/)
│   ├── src/components/    shared components; components/ui/ = primitives
│   ├── src/api/           fetch client + one module per backend resource
│   ├── src/auth|data|theme|layout/   context providers and the app shell
│   └── e2e/               Playwright specs
├── database/
│   ├── init/              01-init.sql (schema), 02-seed.sql (demo data), 03-app-role.sh, 04-flyway-baseline.sql
│   ├── taskmanager/       Flyway project (migrations V1–V21) — applied by the Compose `migrate` service, not by the app
│   ├── verify_invariants.sql
│   └── verify_grants.sql
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
| Milestones | Done (2026-10-12) — add, edit and delete in the UI; shown on the calendar; the task forms have no milestone picker |
| Tasks, subtasks, dependencies, assignment | Done |
| Comments | Done — replies and @mentions (2026-10-13); the people around the task are notified (2026-10-12) |
| Activity feed (task, project, recent) | Done (2026-10-09); time logs are written since 2026-10-13 |
| Notifications | Done (2026-10-12) — all 12 types are produced, including comments, project updates, milestone updates and @mentions; the bell loads 20 at a time (2026-10-14) |
| Dashboard, project timeline, team tasks, workload | Done (2026-10-09) |
| Kanban | Done (2026-10-13) — drag a card to another column or use its *Move to* menu |
| Calendar | Done (2026-10-12) — month, week and day views of task due dates and milestones |
| Task approval workflow | Done (2026-10-09) |
| Reports and KPIs | Done (2026-10-09) — overview charts, five KPIs, seven named reports; each can be saved as an Excel or PDF file (2026-10-13) |
| Error page for every status, Help & Support page | Done (2026-10-10) — `pages/ErrorPage.jsx`, `pages/Help.jsx` |
| Attachments, work logs, checklist items | Done (work logs earlier; attachments and checklists 2026-10-09) |
| Deadline reminders, overdue notifications | Done (2026-10-10) — a daily scheduled job |
| Gantt chart prototype | Done (2026-10-10) |
| Auto-logout | Done (2026-10-12) — 15 idle minutes, a 60-second warning, then sign-out (the timer is browser-side; signing out also deletes the refresh token on the server) |
| Sign-in session | Done (2026-10-14) — a 15-minute access token in memory, renewed from a 7-day httpOnly refresh cookie; sign-out and a password change end it |
| List search, filter, sort and paging | Done (2026-10-13 / 2026-10-14) — optional parameters on the project and task lists, optional paging on those and the notification list; the screens that need a whole list still read it whole |

## 6. Where to read next

| If you want… | Read |
|---|---|
| To run the project | [setup.md](setup.md) |
| How the pieces fit together | [architecture.md](architecture.md) |
| Why it was designed this way | [adr/README.md](adr/README.md) |
| What is wrong or missing | [issues.md](issues.md) and [roadmap.md](roadmap.md) |
