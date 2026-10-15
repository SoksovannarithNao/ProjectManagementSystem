# Kanban Board

**Route** `/kanban` · **Access** any signed-in user (their projects only) · **Source** [Kanban.jsx](../../frontend/src/pages/Kanban.jsx)

## What it does
Tasks as cards in five columns: **To Do, In Progress, In Review, Blocked, Completed**. "Blocked" is not a stored status: it holds To Do tasks that wait for an unfinished prerequisite.

## How it works
- **Reading.** Each column is requested on its own, 25 cards at a time, with its own total shown in the header; **Show more (N more)** reads the next 25. A reload after a move re-reads as many pages as were open.
- **Search** (250 ms delay) and **Filter** (priority, project) apply to every column.
- **Card** shows the project, title, priority, due-soon, time and approval chips, subtask count, due date (with a lock when blocked, a warning when overdue) and the first assignee. Clicking opens the task detail panel.
- **Moving a card.** Drag it onto a column, or use its **Move to** menu. Both are offered only to someone who may change the task's status (an editor, or an assignee with `TASK_STATUS:EDIT`); moving to Completed needs the approval right.
  - While dragging, the column under the card is highlighted: solid when the drop is allowed, dashed red when it is refused.
  - The rules are the server's (stage order, prerequisites, open subtasks, approval). Before saving, the task is read again so a stale card cannot overwrite a newer edit; a refused move says why in a toast. Afterwards the board always reloads to show the server's version.
  - A task starts in In Progress: it does not jump from To Do straight to review or Completed.
- **New Task** and the dashed **Add task** in the To Do column appear only if the person may create tasks in a project that is not completed (and, with a project filter on, in that one): a completed project takes no new tasks (D-27). The panel a card opens shows no add controls (subtask, checklist, comment, timer, file) for a completed task, and its **Edit** opens as a side panel.

## Data
`api/tasks.js` (`getKanbanColumnPage`, `moveTaskToStatus`, `checkTaskMove`), `api/projects.js`, `api/permissions.js`.
