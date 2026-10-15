# Project Detail

**Route** `/projects/:id` · **Access** members of the project and Administrators; anyone else gets a 404 on purpose (the app does not reveal which projects exist) · **Source** [ProjectDetail.jsx](../../frontend/src/pages/ProjectDetail.jsx)

## What it does
Everything about one project on a single page. What is shown depends on the person's role **in this project**; controls they cannot use are not drawn.

## Sections
| Section | Content and actions |
|---|---|
| Header | Name, code, manager and lead. Buttons: Team tasks and Workload (need `TASK:ASSIGN`), Timeline, Gantt (everyone), Edit, Delete (with confirmation; Owner and Administrator) |
| Overview | A row of pills, all the same size (28px high, 36px on a phone, with the same gap between the dot or icon and its label): status (a dropdown for editors), priority, Delayed badge, "Completed on" date, overdue count; then description, start / end date, manager, lead, created date, progress bar |
| Tasks | Counts per status, a status and priority filter, **Add Task**, and the list sorted by due date. A row opens the task detail panel |
| Members | Active members with their project role. The Owner and Administrator can change roles, transfer ownership (confirmation; the old Owner becomes a Team Leader) and set or clear the project **lead**; a Team Leader can only move people between Team Member and Viewer. **Add member** and a list of pending invitations (each can be cancelled) are shown to people who manage the team |
| Milestones | Title, status, progress and due date; add one inline (the date must fall inside the project's dates), edit or delete where allowed |
| Files | Attachments of the project itself (task files live in the task panel) |
| Activity | The project's activity feed |

## Layout
- Header and **Overview** are full width. Below them the **Tasks** card is full width, then two columns on a wide screen in reading order: **Members | Milestones**, then **Attachments | Activity**. Cards in a row stretch to the same height, so Members and Milestones are always the same size (their add forms and pending invitations sit at the bottom of the card); Attachments keeps the height of its own content. Below 1024px the cards stack in the same order.
- The long lists scroll inside their cards instead of making the page endless: the task list (about 440px), Members and Milestones (about 340px), Activity (about 420px) and Attachments (about 260px). Headers, filters, counts and the add forms stay outside the scrolling part. On a phone (under 640px) a member row wraps so the role picker is not cut off; on a wider screen it stays on one line.

## How it works
- Members, tasks, milestones and assignees load independently; one failing shows an inline error with **Try again** instead of looking empty.
- A completed project offers no **Add Task**, milestone form or file upload, and one notice says nothing new can be added until it is reopened; its task panel (and the panel of a completed task) offers no subtask, checklist, comment, timer, file or "Depends on" controls either. The server refuses all of these too (D-27). **Edit** opens the shared right-hand side panel, with the project code read-only. A task change refreshes both the task list and the project, because the project's progress is derived from its tasks on the server.
- A project that is not found (or not allowed) shows the shared [Error page](error-page.md) with a retry for real server failures.

## Data
`api/projects.js`, `api/projectMembers.js`, `api/tasks.js`, `api/taskAssignees.js`, `api/milestones.js`.
