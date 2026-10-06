# ADR-0004: Task assignment as a join table with database-enforced eligibility

- **Status:** Accepted
- **Date:** table in the first schema; triggers added 2026-09-12 (`b692d3b`, migration `V2`); membership status refinement 2026-09-13 (`V4`)
- **Area:** database / authorization

## Context

`Role_Requirment.md`: "Each task must belong to a project and may have one or more assignees depending on the application's design." Assignees must be people who can actually work in that project.

## Decision

- Assignment is its own table `task_assignees (task_id, user_id)` with `UNIQUE (task_id, user_id)`; a task may have **zero, one or many** assignees. (`database/README.md`: "a `tasks` row can exist with zero `task_assignees` rows, the same way a GitHub issue can exist unassigned"; no "at least one assignee" rule.)
- Eligibility is enforced by **database triggers**, not only by code: the assignee must be an `ACTIVE` member of the task's project (`trg_task_assignees_project_member`) and their account must be `ACTIVE` (`trg_task_assignees_not_suspended`).
- Only `OWNER`/`ADMIN` may assign or unassign. Assigning notifies the assignee and writes an activity entry.
- The UI exposes **one** assignee per task; the API and data model allow several.
- "Tasks assigned to me" (the *My Tasks* filter) is derived from the assignee data. Because an assignee is always an active project member, project membership is a superset of "assigned to me", so list endpoints need only membership scoping (comment in `TaskService.getAllTasks`).
- A non-manager who is a current assignee may update **only** `status` and `progress` of that task (`TaskService.updateTask`).

## Alternatives considered

- **A single `assignee_id` column on `tasks`** — not chosen; the requirement allows several assignees (inferred as the reason for the join table).
- **Eligibility only in Java** — not chosen; the database trigger makes the rule impossible to bypass from any caller (the schema comments describe triggers as the "backstop"). Subtasks, whose `assignee_id` is a plain foreign key with no trigger, repeat the rule in Java instead (`SubtaskService`).
- **Notifying via triggers** — see [ADR-0007](0007-application-created-notifications.md).

## Consequences

- Invalid assignments cannot exist regardless of API use; violations surface as readable `400` messages (all triggers set `ERRCODE '23514'`).
- Removing someone from a project does **not** automatically unassign their tasks *(no cleanup code or trigger was found)* — **Needs clarification**.
- Multi-assignee behaviour is untested in the UI because the UI never creates it.
- An assigned `VIEWER` could change the status/progress of their task because assignment was the only check; since 2026-10-06 the update also requires content-edit rights (issue F-18).
- The *My Tasks* filter needs the whole assignee list on the client (`GET /api/task-assignees`).

## Evidence

`V2__add_permissions_progress_and_integrity_rules.sql`, `01-init.sql` (`task_assignees`), `TaskAssigneeService`, `TaskService`, `frontend/src/pages/Tasks.jsx`; [../tasks.md](../tasks.md#3-assignment).
