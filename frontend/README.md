# Frontend

React + Vite UI for the Task & Project Management System — dashboards, task/project views, Kanban board, calendar, team, and reports.

## Stack

- React 19 + React Router 7
- Vite 8
- Recharts (charts) + lucide-react (icons)
- ESLint

## Getting Started

```bash
npm install
npm run dev       # starts the dev server with HMR
```

Other scripts:

```bash
npm run build      # production build
npm run preview    # preview the production build locally
npm run lint        # run ESLint
```

## Project Structure

```
src/
  components/     # shared UI components (StatCard, ProjectCard, TaskDetailPanel, ui/)
  layout/         # app shell — Sidebar, TopBar, AppLayout, layout context
  pages/          # routed pages (Login, Dashboard, Tasks, Projects, Kanban, Calendar, Team, Reports)
  auth/           # AuthContext (JWT login/logout, stored in localStorage) + ProtectedRoute
  api/            # fetch client (client.js) + per-resource calls (projects.js, tasks.js, users.js, ...)
                  # + useApi.js (fetch-on-mount hook), stats.js/relations.js/format.js (derived-data helpers)
  data/           # UsersContext.jsx — fetched user directory, exposes getMember(id) for avatar lookups
  styles/         # global styles and theme tokens
```

## Routes

| Path | Page |
|---|---|
| `/login` | Login (public — the only route not behind `ProtectedRoute`) |
| `/` | Dashboard |
| `/tasks` | Tasks |
| `/projects` | Projects |
| `/kanban` | Kanban |
| `/calendar` | Calendar |
| `/team` | Team |
| `/reports` | Reports |

## Status

Wired to the real backend REST API — every page fetches live data (no `mockData.js` anymore). Auth is a real JWT login (`auth/AuthContext.jsx`), stored in `localStorage` and attached to every request; a 401 anywhere logs the user out and redirects to `/login`.

**Login**: any seeded user from `database/init/02-seed.sql` works with password `secret` (e.g. `alex.admin`, `nikky.sharma`) — see the [root README](../README.md#testing-the-api) for the full list and account statuses.

**API calls**: relative `/api/...` paths only — nginx proxies these to the backend in Docker ([nginx.conf](nginx.conf)), and `vite.config.js` adds a matching dev-server proxy (`/api` → `http://localhost:8080`) so `npm run dev` needs no separate `.env`/API-URL config, as long as the backend is running on port 8080.

**Known limitations** (no backend support yet, not a frontend bug): task subtasks and comments in `TaskDetailPanel` are local-only per session, reset if you close and reopen the panel; the Team page has no activity feed (previously mocked, removed rather than faked). See [Backend README](../backend/README.md) and [API README](../api/README.md) for what's actually implemented server-side.

## Contributing

See the root [README](../README.md) and [Contributing.md](../Contributing.md) for branch naming and workflow.
