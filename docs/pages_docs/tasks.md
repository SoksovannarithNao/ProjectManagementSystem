# Tasks

**Route** `/tasks` · **Access** any signed-in user (only tasks in projects they belong to) · **Source** [Tasks.jsx](../../frontend/src/pages/Tasks.jsx)

## What it does
The full task list, grouped by project and then by status, with search, filters, sorting and quick actions.

## How it works
- **Reading.** The server returns the list 50 tasks at a time, already searched, filtered and sorted; **Show more** reads the next page. A reload after an edit re-reads as many pages as were open.
- **Quick views** (pills with counts): All, Today, Upcoming, In Progress, Completed, Overdue. Today and Upcoming mean open tasks due today / after today.
- **Search** waits 250 ms after typing. **Filter** has: My Tasks, priority, status, assignee (or Unassigned), due date (overdue, today, next 7 days, none) and project. **Sort**: due date, latest, priority, progress, status, title.
- **Grouping.** One card per project (collapsible, with the project's progress and an **Add Task** button where the person may create tasks), and inside it one block per status (To Do, In Progress, In Review, Completed, Cancelled). Finished projects sink to the bottom.
- **A row** shows the title, priority, overdue / due-soon / blocked / approval chips, due date, time, checklist and subtask counts and the assignees. Clicking it opens the task detail panel.
- **Status circle.** One click moves the task to its next stage. It is a real button only for someone who may change that task's status; moving to Completed needs the approval right, and it refuses while subtasks are open.
- **Subtasks.** The arrow expands a row and loads its subtasks; people who may edit subtasks can tick them there.
- **More actions** (Edit, Delete with confirmation) appear only where the person holds the right in that task's project.
- **Awaiting your approval** is a yellow block at the top, shown only when review requests wait for the signed-in person; it opens the task.

## Data
`api/tasks.js` (page, summary, by id, advance, delete), `api/subtasks.js`, `api/projects.js`, `api/approvals.js`.
