# Project Views

**Routes** `/projects/:id/team`, `/projects/:id/workload`, `/projects/:id/timeline`, `/projects/:id/gantt` · **Source** [ProjectViews.jsx](../../frontend/src/pages/ProjectViews.jsx)

## What it does
Four read-mostly views of one project behind a single tab bar. The header has **Back to project**.

| Tab | Shows | Who |
|---|---|---|
| Team Tasks | Each member's tasks in the project, with assigning | Owner, Team Leader, Administrator (`TASK:ASSIGN`) |
| Workload | Assigned, active and overdue tasks and hours per member, with a load level | same |
| Timeline | The project's tasks and milestones on a time scale | every member |
| Gantt | Task bars with their dependencies | every member |

## How it works
- The tab bar hides the two manager tabs from people without `TASK:ASSIGN`. Opening one by address shows a message instead of data.
- An unknown tab falls back to Team Tasks.
- Dependencies are read only when the Gantt tab is open.
- Clicking a task in any view opens the task detail panel; a change there reloads tasks, assignees and dependencies.
- The Delayed badge sits at the right end of the tab bar when the project is past its end date.
- A project that cannot be loaded shows the shared [Error page](error-page.md).

## Data
`api/projects.js`, `api/tasks.js`, `api/taskAssignees.js`, `api/milestones.js`, `api/taskDependencies.js`, `api/teamViews.js` (workload).
