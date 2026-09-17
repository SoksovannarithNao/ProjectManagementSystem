# Frontend

React + Vite UI for the Task & Project Management System — dashboards, task/project views, Kanban board, calendar, team, and reports.

## Stack

- React 19 + React Router 7
- Vite 8
- Tailwind CSS 4 (`@tailwindcss/vite`) — utility classes plus the light/dark theme CSS variables in `src/styles/global.css`
- Recharts (charts) + lucide-react (icons)
- ESLint
- Playwright (E2E tests against the real backend — see [Testing](#testing))

## Getting Started

```bash
npm install
npm run dev       # starts the dev server with HMR
```

Other scripts:

```bash
npm run build        # production build
npm run preview      # preview the production build locally
npm run lint          # run ESLint
npm run test:e2e      # run the Playwright E2E suite (see Testing below)
npm run test:e2e:ui   # same, with Playwright's interactive UI runner
```

## Project Structure

```
src/
  components/     # shared components (StatCard, ProjectCard, TaskDetailPanel, TaskFormModal,
                  # NewProjectModal, AddMemberModal, AddLookupModal, HelpModal)
  components/ui/  # small reusable primitives — Avatar, Badge, DonutChart, ProgressBar, ProgressRing,
                  # LookupSelect, Modal, Dropdown (generic popover), ConfirmDialog, Toast, Skeleton,
                  # EmptyState
  layout/         # app shell — Sidebar, TopBar (search/filter slot + notifications bell), layout context
  pages/          # routed pages — see Routes below
  auth/           # AuthContext (JWT login/logout/refreshProfile, stored in localStorage) + ProtectedRoute
  theme/          # ThemeContext.jsx — light/dark/system theme preference, persisted per-user via Settings
  api/            # fetch client (client.js) + one file per backend resource (projects.js, tasks.js,
                  # subtasks.js, comments.js, milestones.js, taskAssignees.js, taskDependencies.js,
                  # projectMembers.js, users.js, roles.js, positions.js, departments.js,
                  # notifications.js, activityLog.js, auth.js, validation.js, ...) + useApi.js
                  # (fetch-on-mount hook), stats.js/relations.js/format.js/permissions.js
                  # (derived-data + role-gate helpers)
  data/           # UsersContext.jsx (getMember(id) for avatar lookups), NotificationsContext.jsx
                  # (unread count + list backing the top-bar bell)
  styles/         # global.css — Tailwind entrypoint + light/dark theme CSS variables
e2e/              # Playwright E2E specs (see Testing below)
```

## Routes

| Path | Page |
|---|---|
| `/login` | Login (public) |
| `/register` | Register — self-service sign-up (public) |
| `/verify-otp` | VerifyOtp — email OTP verification step after registering (public) |
| `/` | Dashboard |
| `/tasks` | Tasks |
| `/projects` | Projects |
| `/projects/:id` | ProjectDetail — status/priority/dates/manager/progress, a filterable task list with an "Add Task" action, a Members list, and a Milestones list (add/delete) |
| `/kanban` | Kanban |
| `/calendar` | Calendar |
| `/team` | Team — project membership and invitations |
| `/reports` | Reports |
| `/profile` | Profile — self-service personal info, password, and photo |
| `/settings` | Settings — theme preference and notification settings |

Everything except `/login`, `/register`, and `/verify-otp` is behind `ProtectedRoute`.

## Status

Wired to the real backend REST API — every page fetches live data (no `mockData.js` anymore). Auth is a real JWT login (`auth/AuthContext.jsx`), stored in `localStorage` and attached to every request; a 401 anywhere logs the user out and redirects to `/login`.

**Login**: any seeded `ACTIVE` user from `database/init/02-seed.sql` works with password `DevPassword123!` (e.g. `admin.system`, `pm.olivia`) — see the [root README](../README.md#testing-the-api) for the full list and account statuses. New accounts can also self-register at `/register`, which requires completing email OTP verification at `/verify-otp` before the account can log in (see [Backend README](../backend/README.md#security)) — locally, the OTP email lands in Mailpit (`http://localhost:8025`), not a real inbox.

**API calls**: relative `/api/...` paths only — nginx proxies these to the backend in Docker ([nginx.conf](nginx.conf)), and `vite.config.js` adds a matching dev-server proxy (`/api` → `http://localhost:8080`) so `npm run dev` needs no separate `.env`/API-URL config, as long as the backend is running on port 8080.

**Task workflow**: the quick-advance circle on a task row moves it one stage per click (To Do → Doing → Done), never jumping straight from To Do to Done and never silently reopening a `COMPLETED`/`CANCELLED` task — those are terminal for that control (`api/tasks.js`'s `advanceTaskStatus`/`canAdvanceStatus`). Reopening a finished task is still possible, just via the explicit status dropdown in the task detail panel or the project detail page, a deliberate action rather than a stray click. Checking a subtask on a still-To-Do task also auto-promotes its parent to Doing (mirrors a backend rule — see [Backend README](../backend/README.md#task--subtask-rules)); a "Blocked" badge (with the specific blocking task named) shows up instead when that promotion can't happen because of an incomplete dependency.

**Sort/search/filter/manage**: Tasks, Kanban, and Projects all have working search and filter (priority/project) via the `Dropdown` primitive; the project detail page has its own Status/Priority task filter scoped to that project. Tasks also has Sort and a per-row Edit/Delete menu (`TaskFormModal` + `ConfirmDialog`), gated by the same project-scoped roles the backend actually enforces (`api/permissions.js`'s `canManageProject`/`canEditProjectContent`/`isProjectOwner`) so the buttons don't appear for a role that would just get a 403.

**Notifications**: the bell in the top bar is real — `data/NotificationsContext.jsx` fetches from `GET /api/notifications`, shows an unread-count dot, and marking read/all-read calls the backend. Only fires for task assignment, task status changes, and team invitations/responses today (see [Backend README](../backend/README.md#notifications)) — comment/deadline/overdue notifications aren't generated by anything yet.

**Theme**: light/dark/system theme preference (`theme/ThemeContext.jsx`), set from Settings and persisted per-user to the backend (`theme_preference`), not just `localStorage`.

**Profile, Settings & Help**: `/profile` (personal info, password, photo — `PUT /api/users/me`, `/me/password`, `/me/photo`) and `/settings` (theme + task-notification preferences — `PUT /api/users/me/preferences`) are separate real pages; Help & Support opens a static FAQ modal (no backend needed).

**Known limitations** (no backend support yet, not a frontend bug): comments don't trigger a notification to anyone yet; the Team page has no project-wide/per-user activity feed — the activity log that exists is per-task only, shown in the task detail panel's Activity tab. See [Backend README](../backend/README.md) and [API README](../api/README.md) for what's actually implemented server-side.

## Testing

An end-to-end suite (`e2e/`, Playwright) drives the real app against the real backend — no mocking. `playwright.config.js` deliberately has no `webServer` of its own; it points `baseURL` at an already-running stack (`http://localhost:5173` by default, override with `E2E_BASE_URL` or `FRONTEND_PORT`).

```bash
docker compose up -d          # from the repo root — full stack must be running first
cd frontend
npx playwright install        # once, to download the Chromium binary
npm run test:e2e              # headless run
npm run test:e2e:ui           # interactive runner
```

`e2e/helpers.js`'s `login()` uses the seeded `admin.system` / `DevPassword123!` credentials. Current coverage: `auth.spec.js` (login success/failure, redirect when unauthenticated) and `projects.spec.js` (project cards render and link correctly, opening a project navigates to its detail page, opening a task there opens the task detail panel). Not yet wired into CI (`ci.yml` only lints/builds the frontend) — run it locally before a PR that touches these flows.

## Contributing

See the root [README](../README.md) and [Contributing.md](../Contributing.md) for branch naming and workflow.
