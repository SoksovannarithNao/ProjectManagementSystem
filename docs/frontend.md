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
npm test              # Vitest unit tests (see Testing)
npm run test:e2e      # Playwright end-to-end suite (see Testing)
npm run test:e2e:ui   # same, with Playwright's interactive runner
```

Ports, the Docker route and troubleshooting: [setup.md](setup.md). In the Docker stack the built frontend is served by nginx on port 5173 and must be rebuilt (`docker compose build frontend && docker compose up -d frontend`) to pick up source changes.

## Project structure

```text
src/
  components/     shared components: StatCard, ProjectCard, TaskDetailPanel, TaskFormModal, TimeTracking,
                  ChecklistSection, AttachmentsSection, ApprovalChip, DelayedBadge, ProjectActivity,
                  TeamTasksView, WorkloadTable, TimelineView, GanttChart, MilestoneFormModal, DueSoonBadge, NewProjectModal, AddMemberModal, EditUserModal, RoleFormPanel, KanbanMoveMenu,
                  AddProjectMemberModal, AddLookupModal, MentionInput (the comment box with @ autocomplete), CommentText
  components/reports/  the Reports tabs (ReportViews, ReportParts) and their helpers: reportExport.js (the Excel and PDF files), reportFormat.js and the useReportableProjects hook
  components/ui/  small reusable primitives: Avatar, Badge, Checkbox, ConfirmDialog, Dropdown (generic popover),
                  EmptyState, Logo, LookupSelect, Modal, PasswordChecklist, ProgressBar, ProgressRing,
                  SidePanel, Skeleton, TimeChip, Toast, useDirtyForm
  layout/         app shell: Sidebar, TopBar (the sticky page header with its search/filter slot and notifications bell), layout context (LayoutContext, layoutContextStore, useLayout)
  pages/          routed pages (see Routes below); admin/ holds UsersAdmin, RolesPermissions and AuditLog
  auth/           AuthContext (JWT login, logout, refreshProfile, permissions; the token lives in memory, renewed from a refresh cookie),
                  ProtectedRoute, RequirePermission (403 page when the matrix does not grant an action) and IdleLogout (inactivity warning and sign-out)
  theme/          ThemeContext.jsx: light/dark/system preference, persisted per user through Settings
  api/            fetch client (client.js) and one module per backend resource (projects, tasks, subtasks,
                  comments, mentions, milestones, taskAssignees, taskDependencies, projectMembers, users, roles,
                  positions, departments, notifications, activityLog, auditLog, workLogs, approvals, attachments,
                  checklist, dashboard, reports, teamViews, auth, validation, ...);
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
| `/` | Dashboard: a statistics strip (total / active / completed / **delayed** projects, average completion, total tasks), task overview with an overdue pill that links to Tasks, "Due & Overdue" list and *Recent activity* in the wider left column; *Delayed projects*, project previews and — for people who can assign tasks — *Team workload* (a list that scrolls inside its card) in the right column; the *Task activity* chart across both. The figures come from `GET /api/dashboard/stats` |
| `/tasks` | Tasks: every task in your projects grouped by project; search, filter (status, priority, assignee, due date, project, **My Tasks** = tasks you are an assignee of), sort (latest, due date, priority, progress, status, title); groups by status. A **quick-view bar** above the list (All, Today, Upcoming, In Progress, Completed, Overdue, each with a count) narrows the list further: Today and Upcoming are open tasks due today / after today. An open task due today or within 3 days carries a *Due today / tomorrow / in N days* badge (`dueSoon` from the server). Renamed from "My Tasks" |
| `/projects` | Projects |
| `/projects/:id/team`, `/projects/:id/workload`, `/projects/:id/timeline`, `/projects/:id/gantt` | ProjectViews: four tabs for one project. *Team Tasks* (members with their tasks, counts and progress, reassign) and *Workload* (overloaded / underloaded against the team average) are for people who can assign tasks; the *Timeline* (project, milestones and tasks on one axis) and the *Gantt* chart (a duration bar per task on a week / month axis with its progress, a today line and arrows for task dependencies; an arrow is red when a task is planned to start before its unfinished prerequisite is due; hovering a bar fades the tasks that do not overlap it; a prototype, `components/GanttChart.jsx`) are for every member |
| `/projects/:id` | ProjectDetail (also: a *Delayed* badge, links to the three views above, and a role picker with ownership transfer on each member): status, priority, dates, manager, progress, a *Created* date, a *Completed on <date>* chip once the project is completed, a filterable task list with an "Add Task" action, a Members list and a Milestones list (add, edit title / description / due date / status in `components/MilestoneFormModal.jsx`, delete; completing a milestone with open linked tasks shows a warning, and a warning toast after saving) |
| `/kanban` | Kanban |
| `/calendar` | Calendar (month, week, day): task due dates, coloured by priority, and milestones on their due dates (a flag chip announced as "Milestone", struck through once completed). **Detail (since 2026-10-14):** a day (its number, the cell, a Week / Day row; on a phone a tap on the cell) opens the **day drawer** (`CalendarDayPanel`), in two parts on the right: the list of what is due that day (milestones, then tasks) with *New task on this day* for anyone who may create tasks, and beside it the detail of the item chosen in the list, so the list stays in view. The detail is the task panel (`TaskDetailPanel` with `embedded`, the same panel as on Tasks and Kanban, edit and delete included) or `MilestoneDetailPanel` (status, project, due date, progress, description, linked tasks, each of which opens in the same place). A chip in the grid opens the drawer on its day with that item chosen. Below about 1000 px one part is shown at a time. *New Event* in the header still starts a task |
| `/team` | Team: project membership and invitations. Header actions: *Add User* (an administrator creates an account) and *Add Member* (puts an existing user into a project they manage: a project combo box, then a person combo box, then the role; shown to anyone who manages a project) |
| `/reports` | Reports (needs `REPORT:GENERATE_REPORTS`; the link and route are hidden otherwise). The tab strip uses the Tasks quick-view pills (one row, scrolling sideways on a phone) and the Overview's Filter and period controls are page-header actions like those of Tasks and Kanban; its charts sit in two independent columns. Tabs (`?tab=`): *Overview* (charts; the Workload chart shows each member's assigned, active and overdue tasks from `GET /api/workload` or, with a project chosen, `/api/projects/{id}/workload`, and only to people who may assign tasks), *KPIs* and the seven reports, each with a *Generate* step and, once generated, *Excel* and *PDF* buttons (the files are made in the browser from the report on the screen, `components/reports/reportExport.js`; the libraries are loaded the first time one is asked for); the data comes from `GET /api/reports/*` (`components/reports/`, `api/reports.js`) |
| `/admin/users` | Administration → Users: give each account a system role (needs `USER:VIEW`; changing needs `USER:ASSIGN`) |
| `/admin/roles` | Administration → Roles & Permissions: the role × resource × action grid; an Administrator edits grants with *Save changes* (needs `ROLE:VIEW`; editing needs `ROLE:EDIT`; the Administrator role is read-only). *New role* (`ROLE:CREATE`) opens `RoleFormPanel`, a form in the right-hand `SidePanel` (the same frame as the task panel); an extra system role also has Edit (rename) and Delete (`ROLE:DELETE`, with a confirmation) |
| `/profile` | Profile: personal info, password and photo |
| `/settings` | Settings: theme preference and notification settings |
| `/help` | Help & Support: the FAQ page |
| `/admin/audit` | Administration → Audit log: the append-only administrator log, newest first, with a search box, an action filter, a date range and paging; opened only by the Administrator role (`auth/RequireAdministrator`; the sidebar link is hidden from everyone else) |
| `/error/:status`, any unknown address | ErrorPage: what the status means, with ways back (see *Error pages* below) |

Everything except `/login`, `/register` and `/verify-otp` is behind `ProtectedRoute`.

## Status

The frontend is wired to the real backend REST API: every page fetches live data, and there is no mock data layer. Authentication is a real JWT login (`auth/AuthContext.jsx`): the 15-minute access token is kept in memory only and attached to every request, `localStorage` holds just the username and role, and an httpOnly refresh cookie renews the token silently (after a reload, and when a request is answered `401`); only a `401` that a refresh cannot fix logs the user out and redirects to `/login`. Every request goes through `api/client.js`, which raises an `ApiError` carrying the HTTP status and the server's message; a server that cannot be reached (status `0`) or a reply that is not JSON, such as a proxy's HTML error page, is turned into a readable sentence ("Could not reach the server…", "The server sent an unexpected response…") rather than the browser's raw message (2026-10-10).

**Login.** The form takes a username **or an e-mail address**. Any seeded `ACTIVE` user from `database/init/02-seed.sql` works with password `DevPassword123!` (for example `admin.system`, `pm.olivia`); the full list and statuses are in [setup.md](setup.md#5-test-accounts-and-sample-data). New accounts can self-register at `/register`, which requires email OTP verification at `/verify-otp` before the account can log in (see [backend.md](backend.md#security)). Locally the code arrives in Mailpit (`http://localhost:8025`), not a real inbox.

**API calls.** Relative `/api/...` paths only. nginx proxies them to the backend in Docker ([frontend/nginx.conf](../frontend/nginx.conf)) and `vite.config.js` adds a matching dev-server proxy (`/api` → `http://localhost:8080`), so `npm run dev` needs no separate `.env` or API URL as long as the backend runs on port 8080.

**Collaboration.** The task panel has a *Checklist* (`components/ChecklistSection.jsx`: add, tick, delete), an *Attachments* section (`components/AttachmentsSection.jsx`: attach, download with the user's token through `apiDownload`, delete) and threaded *Comments* with a *Reply* button and a "Replying to…" bar on the composer; typing `@` in the composer (or when editing a comment) lists the project's active members (`components/MentionInput.jsx`, `api/mentions.js`: arrow keys and Enter/Tab pick, Escape closes) and a comment shows the people it mentions highlighted (`components/CommentText.jsx`, built from text nodes, never HTML). The project page has the same *Attachments* section for project files and an *Activity* card (`components/ProjectActivity.jsx`, `GET /api/activity-logs/project/{id}`); task rows show `n/m checklist`. The controls follow the grants `ATTACHMENT` and `CHECKLIST_ITEM` (and, for ticking, being assigned to the task); the Roles & Permissions page lists both resources.

**Approval.** `components/TaskDetailPanel.jsx` has an *Approval* section (submit for review, the awaiting-approval banner, a comment box with Approve / Request changes / Reject, the approver picker, the history); `components/ApprovalChip.jsx` marks tasks on Tasks and Kanban; the Tasks page lists *Awaiting your approval* at the top (`GET /api/approvals/pending`). `api/approvals.js` wraps the endpoints; `api/permissions.js` `canApproveTask` hides what the server would refuse (no approving your own work, a named approver) so the controls match the rules in [authentication-authorization.md](authentication-authorization.md#53-task-update-rule-row-level).

**Task workflow.** The quick-advance circle on a task row moves it one stage per click (To Do → In Progress → In Review/Completed), never jumping from To Do straight to Completed and never silently reopening a `COMPLETED` or `CANCELLED` task: those are terminal for that control (`advanceTaskStatus` and `canAdvanceStatus` in `api/tasks.js`). Reopening a finished task is still possible, but through the explicit status dropdown in the task panel or on the project page, a deliberate action rather than a stray click. Checking a subtask on a still-To-Do task also promotes its parent to In Progress (this mirrors a backend rule, see [backend.md](backend.md#task--subtask-rules)); a "Blocked" badge naming the blocking task appears instead when that promotion cannot happen because of an incomplete dependency.

**Time tracking.** The task panel's *Time tracking* section (`components/TimeTracking.jsx`) shows time logged against the estimate, a start/stop timer that survives a reload (kept in `localStorage`, one running timer per user), a manual entry form that accepts `1.5`, `1h 30m`, `45m` or `2d`, and the entry list. Task rows and board cards show a `TimeChip` such as `1h 30m / 13h`, in the danger colour once over the estimate. Parsing and formatting live in `api/duration.js`. Rules and API: [tasks.md](tasks.md#time-tracking-estimated-vs-actual).

**Search, filter, sort and manage.** Tasks, Kanban and Projects have working search; Tasks filter by status, priority, assignee, due date and project and Projects by status, priority and project manager (both with Sort), Kanban by priority and project, all through the `Dropdown` primitive and in the browser over the already permission-scoped lists; the project detail page has its own status and priority filter scoped to that project. Tasks also has Sort and a per-row Edit/Delete menu (`TaskFormModal` and `ConfirmDialog`), gated by the same grants the backend enforces (`can('TASK', 'EDIT', projectId)` and friends from `useAuth()`, fed by `GET /api/users/me/permissions`) so a control does not appear for a role that would only get a `403`. The helpers are advisory; the backend is the authority.

**Notifications.** The top-bar bell is real: `data/NotificationsContext.jsx` fetches `GET /api/notifications` 20 at a time (`?page` / `?size`, a *Show more (N older)* button loads the next page), shows an unread dot from `GET /api/notifications/unread-count`, and marking read or all-read calls the backend. Task assignment, task status change, approval requests and decisions, team invitations and responses, deadline reminders and overdue notices, comments and replies, and project and milestone updates are generated today (see [backend.md](backend.md#notifications)); the bell lists them all with their title and message.

**Auto-logout.** `auth/IdleLogout.jsx` (mounted once in the signed-in layout, so never on the public pages) watches mouse, keyboard, wheel, scroll and touch activity. After 15 minutes without any, in this tab or in any other (the last activity is shared through `localStorage`), a *Still there?* dialog counts down 60 seconds with *Stay signed in* and *Sign out now*; while it shows, only its own button counts as activity. When the minute runs out the app clears the session, goes to `/login` and the login page says "You were signed out because there was no activity for a while". The limits are `IDLE_LIMIT_MS` and `IDLE_WARNING_MS` in `auth/idleTimeout.js`. It is a browser-side convenience; the token itself stays valid on the server until it expires.

**Theme.** Light, dark and system (`theme/ThemeContext.jsx`), set from Settings and persisted per user to the backend (`theme_preference`), not only in `localStorage`. Because the saved preference wins after login, a test account's stored theme overrides the operating-system setting.

**Profile, Settings and Help.** `/profile` (personal info, password, photo: `PUT /api/users/me`, `/me/password`, `/me/photo`) and `/settings` (theme and task-notification preferences: `PUT /api/users/me/preferences`) are separate real pages. **Help & Support** is a page of its own, `/help` (`pages/Help.jsx`, the sidebar link): a static FAQ in four sections — getting started, projects and team, work / approvals / reminders, troubleshooting — and a "Still stuck?" note, written from what the app does today and needing no backend. (It replaced a pop-up modal on 2026-10-10; the modal's answers about the password and about position / department were out of date.)

**Error pages.** `pages/ErrorPage.jsx` is the one page for every error status: an unknown address (`*`, 404), `/error/:status` for any status, the permission guard `RequirePermission` (403), and the project pages when the project cannot be loaded (404, or the real status with *Try again*). It uses the shared `EmptyState` and `.btn` styles and says "Error <status> · <what it means>" with *Back to the dashboard*, *Go back*, *Help & Support* and — only for failures that may pass (status `0` = the server could not be reached, see `api/client.js`, and 5xx) — *Try again*. Covered: 0, 400, 401, 403, 404, 429, 500, 502 / 503 / 504 (service unavailable); anything else gets a generic message. A 404 does not say whether the page is missing or off limits, because the backend answers 404 for both on purpose.

**Known limitations** (backend support missing, not frontend bugs): there is no per-user activity feed (the log is per task in the task panel and per project on the project page). The full list against the requirements is in [checklist/](checklist/).

## Design system in code

Colours, type, radii, spacing and the rules behind them are in [DESIGN.md](DESIGN.md). In code: tokens live in `@theme` in `src/styles/global.css`; shared classes are `.card`, `.btn`, `.btn-primary/-secondary/-ghost`, `.icon-btn`, `.field` (+ `-sm`, `-lg`), `.hit-area` and `.skeleton`; status text uses the `*-ink` colour tokens and text on a charcoal fill uses `text-on-charcoal`. A global `:focus-visible` rule provides the keyboard focus ring, and animation is reduced under `prefers-reduced-motion`.

## Testing

**Unit tests** (`npm test`, Vitest, 174 tests in 11 files) sit next to the code as `*.test.js` and cover the plain logic in `src/api` and `src/auth` (durations, password rules, permission checks, statistics, formatting, the task status moves, the API client, the auto-logout storage, the @mention helpers and the report export documents); they need no browser and no backend and run in CI. There are no tests of rendered components. Each is listed in [testing.md](testing.md#41-frontend-unit-tests-166).

An end-to-end suite (`e2e/`, Playwright) drives the real app against the real backend with no mocking. `playwright.config.js` deliberately has no `webServer`: it points `baseURL` at an already-running stack (`http://localhost:5173` by default; override with `E2E_BASE_URL` or `FRONTEND_PORT`).

```bash
docker compose up -d          # from the repo root: the full stack must be running first
cd frontend
npx playwright install        # once, to download the Chromium binary
npm run test:e2e              # headless run
npm run test:e2e:ui           # interactive runner
```

`e2e/helpers.js`'s `login()` uses the seeded `admin.system` / `DevPassword123!` credentials. Coverage (257 tests): `paging.spec.js` (the project, task and notification pages and the bell's *Show more*), `session.spec.js` (the access token is not stored, the httpOnly cookie, a silent renewal, sign-out and password changes ending the session), `core-workflow.spec.js` (one project from creation to completion), `registration.spec.js` (registering and verifying with the e-mailed code, read from Mailpit through `E2E_MAILPIT_URL`), `smoke.spec.js` (every screen opens without a script error, a `5xx` or an error page), `idle-and-updates.spec.js` (auto-logout with a fake clock, and the comment, project and milestone notifications), `quick-wins.spec.js` (the project completion date, the near-deadline flag, milestone editing, milestones on the calendar and the Tasks quick views), `auth.spec.js` (login success and failure, redirect when unauthenticated), `approvals.spec.js` (the approval workflow through the API and two UI flows), `manager-views.spec.js` (Delayed, dashboard figures, Team Tasks, Workload, the timeline, role rules and ownership transfer), `reports.spec.js` (the KPIs and the seven reports through the API and five UI cases, the Overview workload chart among them), `roles-permissions.spec.js` (the permission matrix and the Administration pages), `gantt.spec.js` (the Gantt chart: bars, dependency arrows and the start-before-prerequisite warning, overlap fading, zoom), `help-errors.spec.js` (the error page for an unknown address, a missing project and each status, and the Help & Support page), `collaboration.spec.js` (attachments, checklists, replies and the project feed, through the API and three UI flows), `batch1.spec.js` (sign-in by e-mail, unknown API path = 404, status labels, project and task filters and sorting, own position/department), `projects.spec.js` (project cards render and link, opening a project and a task), `project-team.spec.js` (duplicate project-code `409`, inactive and suspended users cannot be invited, org-wide invitation suggestions, pending count, the Add-member picker), `team.spec.js` (no invitation offered for inactive or suspended users), `permissions.spec.js` (scoped lookups, no cross-project task moves, read-only `VIEWER`, deactivated accounts' tokens rejected), `time-log-edit.spec.js` (changing a time entry and the activity feed it writes to), `invite-role.spec.js` (the project page's Add member dialog invites with the chosen role), `time-tracking.spec.js` (logging time, a rejected entry, the timer surviving a reload), `user-management.spec.js` (an administrator edits, deactivates and deletes an account; no Delete on the own row; the server refuses self-deletion and a Team Member's delete), `custom-roles.spec.js` (creating, giving permissions to, assigning, renaming and deleting an extra system role; the server's rules for names, built-in roles and project creation), `project-lead.spec.js` (naming and clearing the project lead through the API and the project page; the lead is cleared on demotion, removal and ownership transfer), `audit-log.spec.js` (what is recorded for accounts, roles, permissions, project roles, ownership and project deletion; who may read it; paging and filters; that an entry cannot be changed; the screen), `kanban-moves.spec.js` (dragging a card up to Completed and back, the refused drops and their messages, a Team Member's own cards, the Move to menu, a Viewer, the server's refusal) and `kanban-integrity.spec.js` (what a move does to progress, dates, approvals, the feed, notifications, dependencies and subtasks; a stale card cannot overwrite a newer edit; the order of the stages). Both use `kanban-helpers.js`. `mentions.spec.js` (a mention notifies the member instead of the generic notice, never the author or an outsider; an edit tells only the newly mentioned; typing `@` offers the project's members, the pick is highlighted and the mentioned person sees it in the bell) and `report-export.spec.js` (each of the seven reports and the KPIs saved as a real `.xlsx` and `.pdf`; nothing to export before *Generate*). Only checked to open without an error (`smoke.spec.js`): Kanban, the Calendar apart from its milestones, the Reports Overview charts, Profile and Settings (the Dashboard figures are checked only through `manager-views.spec.js`). The specs share one database, so leftover data can break a run (see [testing.md](testing.md)). The suite runs in CI (the `e2e` job in `ci.yml` builds the whole stack on a fresh runner and runs it with 2 workers); run it locally before a pull request that touches these flows. Inventory and gaps: [testing.md](testing.md).

## Contributing

Branch naming and the pull-request workflow are in [../Contributing.md](../Contributing.md) (frontend branches use `frontend/<task>`). Keep this documentation current in the same pull request as the change; see [README.md](README.md#keeping-the-documentation-current).
