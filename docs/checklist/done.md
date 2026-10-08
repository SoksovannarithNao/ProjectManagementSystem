# Checklist — Done (26 items)

Audit date: 2026-10-08 · Compared against [assignment-brief.md](../../assignment-brief.md) and [project-workflow.md](../../project-workflow.md). Roles, permissions, approval and the open decisions follow the approved specification in the brief's Part B (updated 2026-10-08).
Sibling lists: [partially_done.md](partially_done.md) · [not_done.md](not_done.md) · [not_fully_satisfy.md](not_fully_satisfy.md) · [unclear.md](unclear.md).

These requirements are fully implemented. Item numbers (`#1`, `#30a` …) are the audit's own and are shared by every file in this folder.

Time tracking (#48) was built on 2026-10-08 and is uncommitted.

| # | Requirement | Status | Evidence | Still needed |
|---|---|---|---|---|
| 1 | Registration with validation; account created; role assigned | Done | [AuthController.java:32](../../backend/src/main/java/backend/controller/AuthController.java#L32), OTP flow, default `USER` role [01-init.sql:42](../../database/init/01-init.sql#L42) | Nothing |
| 3 | User information fields (name, gender, DOB, phone, email, photo, position, department, role, account status) | Done | [User.java:14-73](../../backend/src/main/java/backend/entity/User.java#L14) | Nothing |
| 4 | View/edit profile, change password, logout | Done | [Profile.jsx](../../frontend/src/pages/Profile.jsx); [UserController.java:62,72](../../backend/src/main/java/backend/controller/UserController.java#L62); [TopBar.jsx:82](../../frontend/src/layout/TopBar.jsx#L82) | Nothing |
| 5 | Four roles: Administrator, Project Manager, Team Leader, Team Member | Done | Two-level model ([ADR-0015](../adr/0015-two-level-roles-system-and-project.md), migration [V10](../../database/taskmanager/migrations/V10__two_level_roles.sql)): system roles `ADMINISTRATOR`, `PROJECT_MANAGER`, `USER`; project roles `OWNER` (the Project Manager of the project), `ADMIN` (Team Leader), `MEMBER` (Team Member), `VIEWER`. Exactly one owner per project; new accounts are `USER`. Verified live, [workflow-conformance.md](../workflow-conformance.md) | Nothing (Viewer is an extra, project-only role) |
| 9 | Users see only projects and tasks they are allowed to | Done | [ProjectAccessGuard.java](../../backend/src/main/java/backend/service/ProjectAccessGuard.java); e2e `permissions.spec.js` passes | Nothing |
| 11 | Task counts: total, pending, in progress, completed, overdue | Done | Dashboard overview and overdue link [Dashboard.jsx:105](../../frontend/src/pages/Dashboard.jsx#L105); [Reports.jsx:99-102](../../frontend/src/pages/Reports.jsx#L99) | Nothing |
| 13 | Project fields | Done | [Project.java:14-48](../../backend/src/main/java/backend/entity/Project.java#L14) | Nothing |
| 14 | Create, view, edit projects; manage lifecycle | Done | [ProjectController.java](../../backend/src/main/java/backend/controller/ProjectController.java); status select in [ProjectDetail.jsx](../../frontend/src/pages/ProjectDetail.jsx) | Creating a project needs `PROJECT:CREATE` (Project Manager, Administrator) |
| 15 | Project statuses and priorities | Done | `CHECK` constraints [01-init.sql:206-209](../../database/init/01-init.sql#L206) | Nothing |
| 16 | Add and remove team members | Done | [ProjectMemberController.java](../../backend/src/main/java/backend/controller/ProjectMemberController.java); Team page | Nothing |
| 20 | Project detail screen | Done | [ProjectDetail.jsx](../../frontend/src/pages/ProjectDetail.jsx) shows every listed field | Nothing |
| 22 | Project progress = completed ÷ total tasks, automatic | Done | `fn_compute_project_progress` [01-init.sql:610](../../database/init/01-init.sql#L610); triggers at 646-699 | Nothing |
| 26 | Task fields | Done | [TaskResponse.java](../../backend/src/main/java/backend/dto/TaskResponse.java); [TaskFormModal.jsx](../../frontend/src/components/TaskFormModal.jsx) | Nothing |
| 27 | Create tasks and assign to members | Done | [TaskAssigneeService.java:118,133](../../backend/src/main/java/backend/service/TaskAssigneeService.java#L118) | Nothing |
| 28 | Workflow To Do → In Progress → In Review → Completed | Done | `nextWorkflowStatus` in [tasks.js](../../frontend/src/api/tasks.js) | Nothing |
| 29 | Task priorities Low / Medium / High / Urgent | Done | `PRIORITY_OPTIONS` in the task screens | Nothing |
| 30a | Overdue detection | Done | `overdue` computed in `TaskResponse`; view [01-init.sql:943](../../database/init/01-init.sql#L943) | Nothing |
| 39 | Task dependencies and out-of-order prevention | Done | Triggers [01-init.sql:496-570](../../database/init/01-init.sql#L496); "Depends on" UI; Blocked state | Nothing |
| 40 | Business rules: due ≤ project end, completion date, dependency order | Done | Triggers [01-init.sql:384, 401, 532](../../database/init/01-init.sql#L384) | Nothing |
| 48 | Time tracking: timer, manual log, estimated vs. actual | Done | [WorkLogController.java](../../backend/src/main/java/backend/controller/WorkLogController.java); [TimeTracking.jsx](../../frontend/src/components/TimeTracking.jsx); 7 backend tests, 3 e2e tests, live run | Per-person workload view is #49 |
| 55 | Required-field validation | Done | `@Valid` DTOs and form checks | Nothing |
| 56 | Date validation | Done | `CHECK (end_date >= start_date)` [01-init.sql:214](../../database/init/01-init.sql#L214); form messages | Nothing |
| 57 | Consistent state when a task completes (status, project progress, stats, activity log) | Done | Progress triggers, refetch, activity log | Nothing |
| 61 | Task business logic | Done | `TaskService` plus triggers | Nothing |
| 62 | Navigation and responsive UI (mobile, tablet, desktop) | Done | Audited at 390, 768, 1024 and 1360px in light and dark: no horizontal scroll | Nothing |
| 63 | UI states: loading, empty, success, error, warning, confirm, retry | Done | Skeleton, EmptyState, Toast, ConfirmDialog, Retry actions | Nothing |
