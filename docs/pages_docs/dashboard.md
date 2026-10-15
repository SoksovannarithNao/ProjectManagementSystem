# Dashboard

**Route** `/` · **Access** any signed-in user (the figures cover only what the person may see) · **Source** [Dashboard.jsx](../../frontend/src/pages/Dashboard.jsx)

## What it does
The landing page: a summary of projects and tasks, what is due, what is late and what just happened.

## What is on it
| Block | Shows |
|---|---|
| Stat cards | Six cards, each with an icon chip beside the number and one line of context from the same server figures: **Total projects** (how many are planning, on hold or cancelled), **Active projects** and **Completed projects** (their share of all projects), **Delayed projects** (red while above zero; "Past their end date" or "Nothing behind schedule"), **Average completion** (with a thin progress bar and "across N projects") and **Total tasks** ("N done · M overdue"). The cards in a row are the same height |
| Task Overview | One ring per task status with its count and share of the total; an "N overdue" link to Tasks when any are overdue |
| Due & Overdue | The seven open tasks due first (overdue ones lead) with priority, first assignee and an overdue / due-soon label. **View all** opens Tasks |
| Recent activity | The latest 8 activity entries |
| Delayed projects | Projects past their end date, with days late and progress; each links to the project |
| Projects | The two projects with the earliest end dates as compact cards |
| Team workload | Only for people who may assign tasks somewhere (`TASK:ASSIGN`) |
| Task activity | Line chart of tasks completed, created and overdue per day for a period chosen in a dropdown |

## How it works
- The project and task figures are calculated on the server so every screen shows the same numbers; the page only displays them.
- The round tick on a Due & Overdue row marks the task completed (or reopens it) and exists only for people who hold `TASK:APPROVE` in that task's project; everyone else sees the state only and moves work forward from [Tasks](tasks.md).
- Completing a task refreshes the list, the counts and the chart.
- If any of the projects, tasks, stats or activity requests fails, a red banner says some figures were left out and offers **Try again**; the failed cards show "—" instead of looking empty.
- The layout is two columns on wide screens and one column below 1200 px.

## Data
`api/dashboard.js` (stats, task activity), `api/tasks.js` (due-soon list, completion toggle), `api/projects.js`, `api/activityLog.js`, `api/teamViews.js` (workload).
