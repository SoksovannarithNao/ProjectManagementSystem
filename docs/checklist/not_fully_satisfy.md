# Checklist — Exists but does not fully satisfy the requirement

Audit date: 2026-10-08, re-checked against the code 2026-10-10 · Compared against [assignment-brief.md](../../assignment-brief.md) and [project-workflow.md](../../project-workflow.md). Roles, permissions, approval and the open decisions follow the approved specification in the brief's Part B (updated 2026-10-08).
Sibling lists: [done.md](done.md) · [partially_done.md](partially_done.md) · [not_done.md](not_done.md) · [unclear.md](unclear.md).

Functionality that technically exists but falls short of what the requirement says. Each line points to the item that holds the detail, in [partially_done.md](partially_done.md), [not_done.md](not_done.md) or, once finished, [done.md](done.md). Struck-through rows are fixed and kept as a record.

## Functionality that falls short

| # | What exists | Why it does not satisfy the requirement | Item |
|---|---|---|---|
| 1 | Login | ~~Accepts a username only~~ — **done:** the sign-in form takes a username or an email (`UserService.resolveLoginIdentifier`) | #2 |
| 2 | Calendar | Shows task due dates only; the requirement says tasks, due dates **and milestones** | #37 |
| 3 | Kanban board | Cards open the task panel but cannot be moved between columns | #35 |
| 4 | Comments | ~~Replies work in the API but cannot be used from the UI~~ — **done 2026-10-09**: replies in the UI; comments still notify nobody | #41 |
| 5 | Overdue handling | ~~Overdue is calculated when displayed, but no notification or reminder is ever sent~~ — **done 2026-10-10:** a daily scheduled job sends deadline reminders (3 and 1 days before) and overdue notices to the assignees and the Owner | #46, #47 |
| 6 | "Workload" chart | The Reports-page chart still counts tasks per person; the requirement (hours, active, overdue) is met by the workload page and the dashboard card since 2026-10-09 | #49 |
| 7 | Assignment notification | ~~Omits the due date and who assigned the task~~ — **done:** the text names the assigner, task, project and due date | #45 |
| 8 | "My Tasks" | A "My tasks" toggle plus status groups and an Overdue / Due today / next 7 days filter; there are still no dedicated Today's and Upcoming sections | #31 |
| 9 | Time logs | Can be added and deleted but not edited, and do not appear in the activity feed | #48 |
| 10 | Project search | ~~Matches name and description only~~ — **done:** also matches manager and status, with manager and status filters | #24 |
| 11 | Task list search / filter / sort | ~~Missing assignee / status / due-date filters and the Latest / Progress / Status sorts~~ — **done:** all are in the Tasks page | #36 |
| 12 | Milestones | Cannot be edited in the UI and have no description field | #34 |
| 13 | Project completion | Status is saved and a `PROJECT_COMPLETED` activity event is logged, but the project has no completion-date field | #23 |
| 14 | Team roles | ~~No screen changes a member's role~~ — **done 2026-10-09:** the project's team list has a role picker and ownership transfer. Invitations still have no role picker: everyone invited joins as Member | #17 |
| 15 | Activity log | ~~Per task only; project, comment and file events never written~~ — **done 2026-10-09:** task, project, milestone, comment, file and approval events are written and there is a project feed. Time logs are still not written | #43, #48 |
| 16 | Subtasks / checklists | ~~the checklist table has no entity or UI~~ — **done 2026-10-09** | #33 |
| 17 | Reports page | ~~Charts only; no named reports and no export~~ The *Overview* tab keeps the charts; the KPIs and the seven reports are new tabs (2026-10-09). No export | #54 |
| 18 | Network errors | ~~A failed request shows the browser's raw message~~ — **fixed 2026-10-10:** `client.js` turns an unreachable server and a non-JSON (proxy error page) reply into friendly messages | #64 |

## Risks found during the audit

These are bugs or weaknesses rather than missing features.

| ID | Risk | Where |
|---|---|---|
| R-1 | ~~Any registered user can create a project~~ — **resolved 2026-10-08:** `PROJECT:CREATE` is held only by Project Manager and Administrator; new accounts are Team Members and an Administrator promotes them | [ProjectService.java](../../backend/src/main/java/backend/service/ProjectService.java) |
| R-2 | Any project member who can edit content can log time on any task, not only its assignees; no edit and no activity entry | `WorkLogService` |
| R-3 | Database grants must still be added by hand for each new table (this caused a 500 on `GET /api/tasks` for `work_logs`). The **CI list matches** `03-app-role.sh` (both grant the same 21 read-write tables, re-checked 2026-10-10); init scripts still apply only to a fresh volume, so a new table needs a migration that also grants it (as `V9`, `V12` and `V13` do) | `database/init/03-app-role.sh`; `.github/workflows/ci.yml` |
| R-4 | Login token is stored in `localStorage` with a fixed 1-hour life and an abrupt logout | [client.js:11-21](../../frontend/src/api/client.js#L11) |
| R-5 | No pagination: the Dashboard, Tasks and Reports pages fetch every task and assignee, and reports are computed in the browser | `GET /api/tasks`; [Reports.jsx](../../frontend/src/pages/Reports.jsx) |
| R-6 | ~~End-to-end tests depend on shared data~~ — **fixed 2026-10-08:** `project-team.spec.js` is green again (the leftover `newuser` invitation was already gone and one test used a stale CSS selector). The suite is now 108/108 (2026-10-10, `--workers=4`, twice in a row). **Still flaky at the default 8 workers on this machine:** 1–2 specs failed in 2 of 3 runs even without the Gantt spec — once a `409` when a spec created a project (not investigated; the project-code generator racing is the likely cause), once a UI timeout; they pass when re-run alone. Also still true: E2E is not in CI and there are no frontend unit tests | `frontend/e2e/` |
| R-7 | ~~`docs/testing.md` stale counts~~ — **updated 2026-10-10:** 306 backend tests, 108 Playwright tests | `docs/testing.md` |
| R-8 | ~~`REPORT:GENERATE_REPORTS` is enforced only by the UI (page, route, link).~~ **Fixed 2026-10-09:** every `/api/reports/*` endpoint checks it on the server. The *Overview* charts still read `/api/tasks` and friends, which any project member may read, so the permission is not a boundary for that task data | [Reports.jsx](../../frontend/src/pages/Reports.jsx); [ADR-0014](../adr/0014-requirement-roles-and-permission-matrix.md) |
| R-9 | ~~A project whose only active owner is one person cannot be deleted~~ — **fixed 2026-10-08 by `V10`** (the owner check is now deferred and skipped when the project is being deleted) | `database/taskmanager/migrations/V10__two_level_roles.sql`; [issues.md](../issues.md) F-23 |
| R-10 | The application still differs from the approved specification in custom system roles (G-06), auto-logout and the other optional items in G-14 (deadline reminders and overdue notices were built on 2026-10-10). Own position/department, the approval workflow, attachments, checklists, the manager views, the KPIs and the seven reports were done on 2026-10-09; the role model itself (two levels, one owner, Team Member limits) on 2026-10-08 | [assignment-brief.md](../../assignment-brief.md) §B13.1; [issues.md](../issues.md) I-20 |
