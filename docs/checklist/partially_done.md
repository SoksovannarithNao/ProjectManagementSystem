# Checklist — Partially Done (6 items)

Audit date: 2026-10-08, synchronised with the code 2026-10-12 · Compared against [assignment-brief.md](../../assignment-brief.md) and [project-workflow.md](../../project-workflow.md). Roles, permissions, approval and the open decisions follow the approved specification in the brief's Part B (updated 2026-10-08).
Sibling lists: [done.md](done.md) · [not_done.md](not_done.md) · [not_fully_satisfy.md](not_fully_satisfy.md) · [unclear.md](unclear.md).

These requirements are implemented but incomplete, or have an issue. Each row says what exists, what is missing, and what is still needed. Item numbers are shared by every file in this folder. Items finished since the first audit are in [done.md](done.md).

| # | Requirement | Status | What exists / what is wrong | Evidence | Still needed |
|---|---|---|---|---|---|
| 7 | User management | Partial | The administrator API exists. **Creating** an account (with an optional system role) and **giving an account a role** (*Administration → Users*) work in the UI; editing an account's other fields, changing its status and deleting it are still never called from the UI | [UserController.java](../../backend/src/main/java/backend/controller/UserController.java); [AddMemberModal.jsx](../../frontend/src/components/AddMemberModal.jsx); [UsersAdmin.jsx](../../frontend/src/pages/admin/UsersAdmin.jsx) | UI to edit, deactivate and delete users and change account status |
| 7b | Role and permission management UI | Partial | *Administration → Roles & Permissions* edits the grid of every role except the Administrator's, with business labels (Owner = Project Manager of the project, Admin = Team Leader, Member = Team Member); roles **cannot be created or deleted** from the UI, and there are no custom system roles | [RolesPermissions.jsx](../../frontend/src/pages/admin/RolesPermissions.jsx) | Create/edit/delete extra system roles (D-14) |
| 18 | Team Leader may be responsible for a project | Partial | A Team Leader holds a distinct role with project edit/approve/assign rights, but a project still has only one `manager` field (the Project Manager) | [Project.java](../../backend/src/main/java/backend/entity/Project.java) | A second responsible person per project, if wanted |
| 35 | Kanban with task moves | Partial | Columns To Do, In Progress, In Review, Completed (+ Blocked), but cards only open the panel. No drag-and-drop or move control | [Kanban.jsx](../../frontend/src/pages/Kanban.jsx) | Move between columns |
| 44 | Audit log (who, what, when, which) | Partial | The per-task and per-project feeds have these fields; no administrator audit view | [ActivityLogService.java](../../backend/src/main/java/backend/service/ActivityLogService.java) | Optional ("may" item) |
| 59 | CRUD for User, Project, Task, Milestone, Comment, Attachment | Partial | Attachment (2026-10-09) and Milestone (edit form, 2026-10-12, #34) are done; updating or deleting a User has no UI | see #7 | Follows #7 |

## Specification alignment gaps

Differences between the application and the approved specification that are not separate requirements in the audit above. Source: [assignment-brief.md](../../assignment-brief.md) §B13.1.

**Still open**

| ID | Gap | Brief |
|---|---|---|
| G-06 | New roles cannot be created from the UI; the API can add a bare role with no grants (D-14; see #7b) | §B13.1 |
| G-14 | Audit log, @mentions, Kanban moving, report export (see #44, #35); deadline reminders and the Gantt chart were built 2026-10-10, auto-logout on 2026-10-12 | §B13.1 |
| G-16 | The list endpoints take no filter or search parameters; filtering runs in the browser over the already-scoped list | §B13.1 |

**Resolved on 2026-10-12 (auto-logout and notifications, verified live; moved to [done.md](done.md)):** #8 auto-logout after 15 idle minutes with a 60-second warning · #45 the comment, project-update and milestone-update notifications (all 11 notification types are produced).

**Resolved on 2026-10-12 (quick wins, migration `V14`, verified live; moved to [done.md](done.md)):** #34 milestone editing · #37 milestones on the calendar · #31 the Tasks quick views (Today, Upcoming, In Progress, Completed, Overdue) · #30b the near-deadline flag · #23, #60 and #69 the project completion date.

**Resolved on 2026-10-09 (change-plan batches 3a–3c, migration `V13`, verified live):** checklists, attachments, comment replies and the project activity feed (3a) · the project timeline, Team Tasks, Delayed projects, the workload page, dashboard statistics and the role / ownership UI (3b) · the five KPIs and the seven named reports, server-side (3c).

**Resolved on 2026-10-09 (change-plan batch 2, migration `V12`, verified live):** the approval workflow (G-08).

**Resolved on 2026-10-09 (change-plan batch 1, migration `V11`, verified live):** S-4 users edit their own position/department on the Profile page (D-16) · S-6 the stored status is `TODO` (D-15) · sign-in by e-mail · the assignment notification text · project and task filters and sorts.

**Resolved by migration V10 on 2026-10-08** (verified live): S-1 Team Members can no longer create tasks · S-2 a Team Member edits only subtasks of tasks assigned to them, and cannot delete subtasks · S-3 report access moved from a `TEAM_LEADER` system role to the project roles · S-5 ownership transfers in one step and a project has exactly one owner · S-7 a manager named by an administrator must be able to own projects · S-8 a project with a single owner can be deleted.
