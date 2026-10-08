# Checklist — Exists but does not fully satisfy the requirement

Audit date: 2026-10-08 · Compared against [assignment-brief.md](../../assignment-brief.md) and [project-workflow.md](../../project-workflow.md). Roles, permissions, approval and the open decisions follow the approved specification in the brief's Part B (updated 2026-10-08).
Sibling lists: [done.md](done.md) · [partially_done.md](partially_done.md) · [not_done.md](not_done.md) · [unclear.md](unclear.md).

Functionality that technically exists but falls short of what the requirement says. Each line points to the item in [partially_done.md](partially_done.md) or [not_done.md](not_done.md) that holds the detail.

## Functionality that falls short

| # | What exists | Why it does not satisfy the requirement | Item |
|---|---|---|---|
| 1 | Login | Accepts a username only; the requirement says username **or email** | #2 |
| 2 | Calendar | Shows task due dates only; the requirement says tasks, due dates **and milestones** | #37 |
| 3 | Kanban board | Cards open the task panel but cannot be moved between columns | #35 |
| 4 | Comments | Replies work in the API but cannot be used from the UI | #41 |
| 5 | Overdue handling | Overdue is calculated when displayed, but no notification or reminder is ever sent | #46, #47 |
| 6 | "Workload" chart | Counts tasks per person; the requirement is estimated and actual hours, active and overdue tasks | #49 |
| 7 | Assignment notification | Omits the due date and who assigned the task | #45 |
| 8 | "My Tasks" | A checkbox filter, not the requested Today's / Upcoming / In Progress / Completed / Overdue sections | #31 |
| 9 | Time logs | Can be added and deleted but not edited, and do not appear in the activity feed | #48 |
| 10 | Project search | Matches name and description only; the requirement lists name, manager, status, date | #24 |
| 11 | Task list search / filter / sort | Missing assignee / status / due-date search and filters, and the Latest / Progress / Status sorts | #36 |
| 12 | Milestones | Cannot be edited in the UI and have no description field | #34 |
| 13 | Project completion | Status is saved but the completion date is not | #23 |
| 14 | Team roles | Everyone invited joins as MEMBER; the API can change a role but no screen does | #17 |
| 15 | Activity log | Per task only; events for projects, comments and files are allowed by the database but never written | #43 |
| 16 | Subtasks / checklists | Subtasks work, but the checklist table has no entity or UI | #33 |
| 17 | Reports page | Charts only; no named reports and no export | #54 |
| 18 | Network errors | A failed request shows the browser's raw message instead of a friendly one | #64 |

## Risks found during the audit

These are bugs or weaknesses rather than missing features.

| ID | Risk | Where |
|---|---|---|
| R-1 | ~~Any registered user can create a project~~ — **resolved 2026-10-08:** `PROJECT:CREATE` is held only by Project Manager and Administrator; new accounts are Team Members and an Administrator promotes them | [ProjectService.java](../../backend/src/main/java/backend/service/ProjectService.java) |
| R-2 | Any project member who can edit content can log time on any task, not only its assignees; no edit and no activity entry | `WorkLogService` |
| R-3 | Database grants must still be added by hand for each new table (this caused a 500 on `GET /api/tasks` for `work_logs`). The **CI list now matches** `03-app-role.sh` (resolved 2026-10-08); init scripts still apply only to a fresh volume, so a new table needs a migration that also grants it (as `V9` does) | `database/init/03-app-role.sh`; `.github/workflows/ci.yml` |
| R-4 | Login token is stored in `localStorage` with a fixed 1-hour life and an abrupt logout | [client.js:11-21](../../frontend/src/api/client.js#L11) |
| R-5 | No pagination: the Dashboard, Tasks and Reports pages fetch every task and assignee, and reports are computed in the browser | `GET /api/tasks`; [Reports.jsx](../../frontend/src/pages/Reports.jsx) |
| R-6 | ~~End-to-end tests depend on shared data~~ — **fixed 2026-10-08:** `project-team.spec.js` is green again (the leftover `newuser` invitation was already gone and one test used a stale CSS selector). The suite is 43/43. Still true: E2E is not in CI and there are no frontend unit tests | `frontend/e2e/` |
| R-7 | ~~`docs/testing.md` stale counts~~ — **updated 2026-10-08:** 113 backend tests, 40 Playwright tests | `docs/testing.md` |
| R-8 | `REPORT:GENERATE_REPORTS` is enforced only by the UI (page, route, link). The Reports page builds its charts from `/api/tasks` and friends, which any project member may read, so the permission is not a data boundary | [Reports.jsx](../../frontend/src/pages/Reports.jsx); [ADR-0014](../adr/0014-requirement-roles-and-permission-matrix.md) |
| R-9 | ~~A project whose only active owner is one person cannot be deleted~~ — **fixed 2026-10-08 by `V10`** (the owner check is now deferred and skipped when the project is being deleted) | `database/taskmanager/migrations/V10__two_level_roles.sql`; [issues.md](../issues.md) F-23 |
| R-10 | The application still differs from the approved specification in the approval workflow, custom roles, own position/department and the missing required features. The role model itself (two levels, one owner, Team Member limits) was migrated on 2026-10-08 | [assignment-brief.md](../../assignment-brief.md) §B13.1; [issues.md](../issues.md) I-20 |
