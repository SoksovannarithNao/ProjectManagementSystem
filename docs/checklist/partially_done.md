# Checklist — Partially Done (1 item)

Audit date: 2026-10-08, synchronised with the code 2026-10-13 · Compared against [assignment-brief.md](../../assignment-brief.md) and [project-workflow.md](../../project-workflow.md). Roles, permissions, approval and the open decisions follow the approved specification in the brief's Part B (updated 2026-10-08).
Sibling lists: [done.md](done.md) · [not_done.md](not_done.md) · [not_fully_satisfy.md](not_fully_satisfy.md) · [unclear.md](unclear.md).

These requirements are implemented but incomplete, or have an issue. Each row says what exists, what is missing, and what is still needed. Item numbers are shared by every file in this folder. Items finished since the first audit are in [done.md](done.md).

| # | Requirement | Status | What exists / what is wrong | Evidence | Still needed |
|---|---|---|---|---|---|
| 35 | Kanban with task moves | Partial | Columns To Do, In Progress, In Review, Completed (+ Blocked), but cards only open the panel. No drag-and-drop or move control | [Kanban.jsx](../../frontend/src/pages/Kanban.jsx) | Move between columns |

## Specification alignment gaps

Differences between the application and the approved specification that are not separate requirements in the audit above. Source: [assignment-brief.md](../../assignment-brief.md) §B13.1.

**Still open**

| ID | Gap | Brief |
|---|---|---|
| G-14 | @mentions, Kanban moving, report export (see #35); the audit log was built 2026-10-13, deadline reminders and the Gantt chart 2026-10-10, auto-logout 2026-10-12 | §B13.1 |
| G-16 | The list endpoints take no filter or search parameters; filtering runs in the browser over the already-scoped list | §B13.1 |

**Resolved on 2026-10-13 (audit log, migration `V16`, verified live; moved to [done.md](done.md)):** #44 an append-only administrator audit log with a screen.

**Resolved on 2026-10-13 (project lead, migration `V15`, verified live; moved to [done.md](done.md)):** #18 a Team Leader can be named the project's lead beside the Owner.

**Resolved on 2026-10-13 (extra system roles, verified live; moved to [done.md](done.md)):** #7b an administrator creates, renames and deletes extra system roles and chooses their permissions on the grid · G-06 (D-14).

**Resolved on 2026-10-13 (user management, verified live; moved to [done.md](done.md)):** #7 an administrator edits an account, changes its status and deletes it from *Administration → Users* · #59 the last open CRUD gap (updating and deleting a User).

**Resolved on 2026-10-12 (auto-logout and notifications, verified live; moved to [done.md](done.md)):** #8 auto-logout after 15 idle minutes with a 60-second warning · #45 the comment, project-update and milestone-update notifications (all 11 notification types are produced).

**Resolved on 2026-10-12 (quick wins, migration `V14`, verified live; moved to [done.md](done.md)):** #34 milestone editing · #37 milestones on the calendar · #31 the Tasks quick views (Today, Upcoming, In Progress, Completed, Overdue) · #30b the near-deadline flag · #23, #60 and #69 the project completion date.

**Resolved on 2026-10-09 (change-plan batches 3a–3c, migration `V13`, verified live):** checklists, attachments, comment replies and the project activity feed (3a) · the project timeline, Team Tasks, Delayed projects, the workload page, dashboard statistics and the role / ownership UI (3b) · the five KPIs and the seven named reports, server-side (3c).

**Resolved on 2026-10-09 (change-plan batch 2, migration `V12`, verified live):** the approval workflow (G-08).

**Resolved on 2026-10-09 (change-plan batch 1, migration `V11`, verified live):** S-4 users edit their own position/department on the Profile page (D-16) · S-6 the stored status is `TODO` (D-15) · sign-in by e-mail · the assignment notification text · project and task filters and sorts.

**Resolved by migration V10 on 2026-10-08** (verified live): S-1 Team Members can no longer create tasks · S-2 a Team Member edits only subtasks of tasks assigned to them, and cannot delete subtasks · S-3 report access moved from a `TEAM_LEADER` system role to the project roles · S-5 ownership transfers in one step and a project has exactly one owner · S-7 a manager named by an administrator must be able to own projects · S-8 a project with a single owner can be deleted.
