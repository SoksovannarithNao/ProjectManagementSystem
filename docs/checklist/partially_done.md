# Checklist — Partially Done (17 items)

Audit date: 2026-10-08, synchronised with the code 2026-10-10 · Compared against [assignment-brief.md](../../assignment-brief.md) and [project-workflow.md](../../project-workflow.md). Roles, permissions, approval and the open decisions follow the approved specification in the brief's Part B (updated 2026-10-08).
Sibling lists: [done.md](done.md) · [not_done.md](not_done.md) · [not_fully_satisfy.md](not_fully_satisfy.md) · [unclear.md](unclear.md).

These requirements are implemented but incomplete, or have an issue. Each row says what exists, what is missing, and what is still needed. Item numbers are shared by every file in this folder. Items finished since the first audit are in [done.md](done.md).

| # | Requirement | Status | What exists / what is wrong | Evidence | Still needed |
|---|---|---|---|---|---|
| 7 | User management | Partial | The administrator API exists. **Creating** an account (with an optional system role) and **giving an account a role** (*Administration → Users*) work in the UI; editing an account's other fields, changing its status and deleting it are still never called from the UI | [UserController.java](../../backend/src/main/java/backend/controller/UserController.java); [AddMemberModal.jsx](../../frontend/src/components/AddMemberModal.jsx); [UsersAdmin.jsx](../../frontend/src/pages/admin/UsersAdmin.jsx) | UI to edit, deactivate and delete users and change account status |
| 7b | Role and permission management UI | Partial | *Administration → Roles & Permissions* edits the grid of every role except the Administrator's, with business labels (Owner = Project Manager of the project, Admin = Team Leader, Member = Team Member); roles **cannot be created or deleted** from the UI, and there are no custom system roles | [RolesPermissions.jsx](../../frontend/src/pages/admin/RolesPermissions.jsx) | Create/edit/delete extra system roles (D-14) |
| 8 | Session: login, logout, auto-logout prototype | Partial | Fixed 1-hour token; a 401 forces logout. No idle timer, warning or refresh | [application.properties:20](../../backend/src/main/resources/application.properties#L20); [AuthContext.jsx](../../frontend/src/auth/AuthContext.jsx) | Idle timeout with a warning |
| 18 | Team Leader may be responsible for a project | Partial | A Team Leader holds a distinct role with project edit/approve/assign rights, but a project still has only one `manager` field (the Project Manager) | [Project.java](../../backend/src/main/java/backend/entity/Project.java) | A second responsible person per project, if wanted |
| 23 | Project completion records status **and date** | Partial | Status yes, and a `PROJECT_COMPLETED` entry is written to the activity log; no completion date on projects (tasks have one) | [Project.java](../../backend/src/main/java/backend/entity/Project.java); [01-init.sql:364](../../database/init/01-init.sql#L364) | Add `completed_at` to projects |
| 30b | Identify upcoming / near-deadline tasks | Partial | The dashboard lists the next seven open tasks by due date and overdue tasks are flagged; there is no near-deadline flag or "due within N days" rule (the Tasks page has a "Due in the next 7 days" filter) | [Dashboard.jsx:87](../../frontend/src/pages/Dashboard.jsx#L87); [Tasks.jsx:68](../../frontend/src/pages/Tasks.jsx#L68) | Flag tasks due within N days |
| 31 | My Tasks: Today's, Upcoming, In Progress, Completed, Overdue | Partial | A "My tasks" toggle on the Tasks page, status groups (To Do / In Progress / In Review / Completed / Cancelled) and a due filter (Overdue, Due today, next 7 days, none); no dedicated Today's and Upcoming sections | [Tasks.jsx](../../frontend/src/pages/Tasks.jsx) | Dedicated sections or a My Tasks view |
| 34 | Milestones | Partial | Create, delete, list with status, progress and due date. `PUT /api/milestones/{id}` exists but no screen edits a milestone; the description cannot be entered | [ProjectDetail.jsx](../../frontend/src/pages/ProjectDetail.jsx); [MilestoneController.java](../../backend/src/main/java/backend/controller/MilestoneController.java) | Edit form and description field |
| 35 | Kanban with task moves | Partial | Columns To Do, In Progress, In Review, Completed (+ Blocked), but cards only open the panel. No drag-and-drop or move control | [Kanban.jsx](../../frontend/src/pages/Kanban.jsx) | Move between columns |
| 37 | Calendar: day / week / month with tasks, due dates, milestones | Partial | Three views present; only task due dates, no milestones | [Calendar.jsx](../../frontend/src/pages/Calendar.jsx) | Show milestones |
| 44 | Audit log (who, what, when, which) | Partial | The per-task and per-project feeds have these fields; no administrator audit view | [ActivityLogService.java](../../backend/src/main/java/backend/service/ActivityLogService.java) | Optional ("may" item) |
| 45 | Notifications for 7 types | Partial | Produced (8 of the 11 allowed types): task assignment (names the assigner, task, project and due date), status change, approval requested, approval decided, invitation and invitation response, and since 2026-10-10 deadline reminders and overdue notices (#46, #47). Not produced: comments, project updates, milestone updates | [NotificationService.java](../../backend/src/main/java/backend/service/NotificationService.java); [DeadlineNotificationService.java](../../backend/src/main/java/backend/service/DeadlineNotificationService.java) | Add producers for comments, project updates and milestone updates |
| 59 | CRUD for User, Project, Task, Milestone, Comment, Attachment | Partial | Attachment is done (2026-10-09); User and Milestone update have no UI | see #7, #34 | Follows those |
| 60 | Project business logic including completion | Partial | Same gap as #23 | | |
| 65 | Functional testing | Partial | 306 backend tests (29 test classes, green 2026-10-10) and 108 Playwright tests (green 2026-10-10 with 4 workers; see R-6); reports, approvals, attachments, the manager views and the deadline reminders are covered. E2E is not run in CI and there are no frontend unit tests | `backend/src/test`; `frontend/e2e`; [testing.md](../testing.md) | e2e in CI; frontend unit tests |
| 67 | Project documentation list | Partial | `docs/` covers overview, architecture, DB, API, testing, security, workflow conformance, ADRs; UI/UX in `docs/DESIGN.md`. No formal test-case document | `docs/` | A test-case document |
| 69 | End-to-end core workflow | Partial | Works from registration through task approval, project timeline, reports and KPIs. Stops at "Complete project (with date)" | see #23 | |

## Specification alignment gaps

Differences between the application and the approved specification that are not separate requirements in the audit above. Source: [assignment-brief.md](../../assignment-brief.md) §B13.1.

**Still open**

| ID | Gap | Brief |
|---|---|---|
| G-06 | New roles cannot be created from the UI; the API can add a bare role with no grants (D-14; see #7b) | §B13.1 |
| G-14 | Audit log, @mentions, auto-logout, Kanban moving, report export (see #8, #44, #35); deadline reminders and the Gantt chart were built 2026-10-10 | §B13.1 |
| G-16 | The list endpoints take no filter or search parameters; filtering runs in the browser over the already-scoped list | §B13.1 |

**Resolved on 2026-10-09 (change-plan batches 3a–3c, migration `V13`, verified live):** checklists, attachments, comment replies and the project activity feed (3a) · the project timeline, Team Tasks, Delayed projects, the workload page, dashboard statistics and the role / ownership UI (3b) · the five KPIs and the seven named reports, server-side (3c).

**Resolved on 2026-10-09 (change-plan batch 2, migration `V12`, verified live):** the approval workflow (G-08).

**Resolved on 2026-10-09 (change-plan batch 1, migration `V11`, verified live):** S-4 users edit their own position/department on the Profile page (D-16) · S-6 the stored status is `TODO` (D-15) · sign-in by e-mail · the assignment notification text · project and task filters and sorts.

**Resolved by migration V10 on 2026-10-08** (verified live): S-1 Team Members can no longer create tasks · S-2 a Team Member edits only subtasks of tasks assigned to them, and cannot delete subtasks · S-3 report access moved from a `TEAM_LEADER` system role to the project roles · S-5 ownership transfers in one step and a project has exactly one owner · S-7 a manager named by an administrator must be able to own projects · S-8 a project with a single owner can be deleted.
