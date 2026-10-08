# Frontend Guide

React and Vite UI for the Task & Project Management System: dashboard, task and project views, Kanban board, calendar, team, reports and per-task time tracking. This page is the developer guide that used to live in `frontend/README.md`; the folder README was removed and everything in it now lives under `docs/`. The visual system is in [DESIGN.md](DESIGN.md) and the product context in [PRODUCT.md](PRODUCT.md).

## Stack

- React 19 and React Router 7
- Vite 8
- Tailwind CSS 4 (`@tailwindcss/vite`): utility classes plus the light and dark theme variables in `src/styles/global.css`
- Recharts (charts) and lucide-react (icons)
- ESLint
- Playwright for end-to-end tests against the real backend (see [Testing](#testing))

## Getting started

```bash
cd frontend
npm install
npm run dev       # dev server with hot reload, proxies /api to http://localhost:8080
```

Other scripts:

```bash
npm run build         # production build
npm run preview       # preview the production build locally
npm run lint          # ESLint
npm run test:e2e      # Playwright end-to-end suite (see Testing)
npm run test:e2e:ui   # same, with Playwright's interactive runner
```

Ports, the Docker route and troubleshooting: [setup.md](setup.md). In the Docker stack the built frontend is served by nginx on port 5173 and must be rebuilt (`docker compose build frontend && docker compose up -d frontend`) to pick up source changes.

## Project structure

```text
src/
  components/     shared components: StatCard, ProjectCard, TaskDetailPanel, TaskFormModal, TimeTracking,
                  NewProjectModal, AddMemberModal, AddProjectMemberModal, AddLookupModal, HelpModal
  components/ui/  small reusable primitives: Avatar, Badge, ConfirmDialog, Dropdown (generic popover),
                  EmptyState, Logo, LookupSelect, Modal, PasswordChecklist, ProgressBar, ProgressRing,
                  Skeleton, TimeChip, Toast, useDirtyForm
  layout/         app shell: Sidebar, TopBar (search/filter slot and notifications bell), layout context
  pages/          routed pages (see Routes below)
  auth/           AuthContext (JWT login, logout, refreshProfile; token in localStorage) and ProtectedRoute
  theme/          ThemeContext.jsx: light/dark/system preference, persisted per user through Settings
  api/            fetch client (client.js) and one module per backend resource (projects, tasks, subtasks,
                  comments, milestones, taskAssignees, taskDependencies, projectMembers, users, roles,
                  positions, departments, notifications, activityLog, workLogs, auth, validation, ...);
                  useApi.js (fetch-on-mount hook); stats.js, relations.js, format.js, duration.js and
                  permissions.js (turns the server's RESOURCE:ACTION list into can / canSys / canAny helpers)
  data/           UsersContext.jsx (getMember(id) for avatar lookups) and NotificationsContext.jsx
                  (unread count and list behind the top-bar bell)
  styles/         global.css: Tailwind entry point, light/dark theme tokens and shared component classes
e2e/              Playwright end-to-end specs (see Testing)
```

How the pieces fit together: [architecture.md](architecture.md#3-frontend-architecture).

## Routes

| Path | Page |
|---|---|
| `/login` | Login (public) |
| `/register` | Register, self-service sign-up (public) |
| `/verify-otp` | VerifyOtp, the email-code step after registering (public) |
| `/` | Dashboard: task overview with an overdue count, "Due & Overdue" list, project cards, report chart |
| `/tasks` | Tasks: every task in your projects grouped by project; search, filter (priority, project, **My Tasks** = tasks you are an assignee of), sort. Renamed from "My Tasks" |
| `/projects` | Projects |
| `/projects/:id` | ProjectDetail: status, priority, dates, manager, progress, a filterable task list with an "Add Task" action, a Members list and a Milestones list (add, delete) |
| `/kanban` | Kanban |
| `/calendar` | Calendar (month, week, day) |
| `/team` | Team: project membership and invitations |
| `/reports` | Reports (needs `REPORT:GENERATE_REPORTS`; the link and route are hidden otherwise) |
| `/admin/users` | Administration → Users: give each account a system role (needs `USER:VIEW`; changing needs `USER:ASSIGN`) |
| `/admin/roles` | Administration → Roles & Permissions: the role × resource × action grid; an Administrator edits grants with *Save changes* (needs `ROLE:VIEW`; editing needs `ROLE:EDIT`; the Administrator role is read-only) |
| `/profile` | Profile: personal info, password and photo |
| `/settings` | Settings: theme preference and notification settings |

Everything except `/login`, `/register` and `/verify-otp` is behind `ProtectedRoute`.

## Status

The frontend is wired to the real backend REST API: every page fetches live data, and there is no mock data layer. Authentication is a real JWT login (`auth/AuthContext.jsx`), stored in `localStorage` and attached to every request; a `401` anywhere logs the user out and redirects to `/login`.

**Login.** Any seeded `ACTIVE` user from `database/init/02-seed.sql` works with password `DevPassword123!` (for example `admin.system`, `pm.olivia`); the full list and statuses are in [setup.md](setup.md#5-test-accounts-and-sample-data). New accounts can self-register at `/register`, which requires email OTP verification at `/verify-otp` before the account can log in (see [backend.md](backend.md#security)). Locally the code arrives in Mailpit (`http://localhost:8025`), not a real inbox.

**API calls.** Relative `/api/...` paths only. nginx proxies them to the backend in Docker ([frontend/nginx.conf](../frontend/nginx.conf)) and `vite.config.js` adds a matching dev-server proxy (`/api` → `http://localhost:8080`), so `npm run dev` needs no separate `.env` or API URL as long as the backend runs on port 8080.

**Task workflow.** The quick-advance circle on a task row moves it one stage per click (To Do → Doing → Done), never jumping from To Do straight to Done and never silently reopening a `COMPLETED` or `CANCELLED` task: those are terminal for that control (`advanceTaskStatus` and `canAdvanceStatus` in `api/tasks.js`). Reopening a finished task is still possible, but through the explicit status dropdown in the task panel or on the project page, a deliberate action rather than a stray click. Checking a subtask on a still-To-Do task also promotes its parent to Doing (this mirrors a backend rule, see [backend.md](backend.md#task--subtask-rules)); a "Blocked" badge naming the blocking task appears instead when that promotion cannot happen because of an incomplete dependency.

**Time tracking.** The task panel's *Time tracking* section (`components/TimeTracking.jsx`) shows time logged against the estimate, a start/stop timer that survives a reload (kept in `localStorage`, one running timer per user), a manual entry form that accepts `1.5`, `1h 30m`, `45m` or `2d`, and the entry list. Task rows and board cards show a `TimeChip` such as `1h 30m / 13h`, in the danger colour once over the estimate. Parsing and formatting live in `api/duration.js`. Rules and API: [tasks.md](tasks.md#time-tracking-estimated-vs-actual).

**Search, filter, sort and manage.** Tasks, Kanban and Projects have working search; Tasks and Kanban also filter by priority and project through the `Dropdown` primitive; the project detail page has its own status and priority filter scoped to that project. Tasks also has Sort and a per-row Edit/Delete menu (`TaskFormModal` and `ConfirmDialog`), gated by the same grants the backend enforces (`can('TASK', 'EDIT', projectId)` and friends from `useAuth()`, fed by `GET /api/users/me/permissions`) so a control does not appear for a role that would only get a `403`. The helpers are advisory; the backend is the authority.

**Notifications.** The top-bar bell is real: `data/NotificationsContext.jsx` fetches `GET /api/notifications`, shows an unread dot, and marking read or all-read calls the backend. Only task assignment, task status change and team invitations and responses are generated today (see [backend.md](backend.md#notifications)); comment, deadline and overdue notifications are not.

**Theme.** Light, dark and system (`theme/ThemeContext.jsx`), set from Settings and persisted per user to the backend (`theme_preference`), not only in `localStorage`. Because the saved preference wins after login, a test account's stored theme overrides the operating-system setting.

**Profile, Settings and Help.** `/profile` (personal info, password, photo: `PUT /api/users/me`, `/me/password`, `/me/photo`) and `/settings` (theme and task-notification preferences: `PUT /api/users/me/preferences`) are separate real pages. Help & Support opens a static FAQ modal that needs no backend.

**Known limitations** (backend support missing, not frontend bugs): comments do not notify anyone; there is no project-wide or per-user activity feed (the log is per task, in the task panel); Kanban cards cannot be moved between columns; the Calendar shows task due dates but not milestones. The full list against the requirements is in [checklist/](checklist/).

## Design system in code

Colours, type, radii, spacing and the rules behind them are in [DESIGN.md](DESIGN.md). In code: tokens live in `@theme` in `src/styles/global.css`; shared classes are `.card`, `.btn`, `.btn-primary/-secondary/-ghost`, `.icon-btn`, `.field` (+ `-sm`, `-lg`), `.hit-area` and `.skeleton`; status text uses the `*-ink` colour tokens and text on a charcoal fill uses `text-on-charcoal`. A global `:focus-visible` rule provides the keyboard focus ring, and animation is reduced under `prefers-reduced-motion`.

## Testing

An end-to-end suite (`e2e/`, Playwright) drives the real app against the real backend with no mocking. `playwright.config.js` deliberately has no `webServer`: it points `baseURL` at an already-running stack (`http://localhost:5173` by default; override with `E2E_BASE_URL` or `FRONTEND_PORT`).

```bash
docker compose up -d          # from the repo root: the full stack must be running first
cd frontend
npx playwright install        # once, to download the Chromium binary
npm run test:e2e              # headless run
npm run test:e2e:ui           # interactive runner
```

`e2e/helpers.js`'s `login()` uses the seeded `admin.system` / `DevPassword123!` credentials. Coverage (33 tests): `auth.spec.js` (login success and failure, redirect when unauthenticated), `projects.spec.js` (project cards render and link, opening a project and a task), `project-team.spec.js` (duplicate project-code `409`, inactive and suspended users cannot be invited, org-wide invitation suggestions, pending count, the Add-member picker), `team.spec.js` (no invitation offered for inactive or suspended users), `permissions.spec.js` (scoped lookups, no cross-project task moves, read-only `VIEWER`, deactivated accounts' tokens rejected) and `time-tracking.spec.js` (logging time, a rejected entry, the timer surviving a reload). Not covered: Kanban, Calendar, Reports, Dashboard, Profile and Settings, registration and OTP, notifications. The specs share one database, so leftover data can break a run (see [testing.md](testing.md)). The suite is not wired into CI (`ci.yml` only lints and builds the frontend); run it locally before a pull request that touches these flows. Inventory and gaps: [testing.md](testing.md).

## Contributing

Branch naming and the pull-request workflow are in [../Contributing.md](../Contributing.md) (frontend branches use `frontend/<task>`). Keep this documentation current in the same pull request as the change; see [README.md](README.md#keeping-the-documentation-current).
