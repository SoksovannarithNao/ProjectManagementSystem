# Reports

**Route** `/reports` (tab in the address: `?tab=kpis`, `project`, `tasks`, `project-status`, `task-completion`, `overdue`, `team-performance`, `workload`) · **Access** `REPORT:GENERATE_REPORTS` in the system or in any project (by default the Administrator, the Project Manager, and a Team Leader or Owner through the project role) · **Source** [Reports.jsx](../../frontend/src/pages/Reports.jsx)

## What it does
Charts, the five KPIs and seven named reports, in tabs. The tab strip scrolls sideways on a phone.

## Tabs
| Tab | Content |
|---|---|
| Overview (default) | Four counts (total, in progress, completed, overdue), a completion line chart (created vs completed), team productivity, project progress and, for people who may assign tasks, a workload chart |
| KPIs | Project completion rate, task completion rate, overdue rate, average task completion time, on-time completion rate; hover a tile for its formula. Cancelled work is left out and a rate shows "—" when there is nothing to divide by |
| Project, Task, Project Status, Task Completion, Overdue Tasks, Team Performance, Workload | The seven reports. Each has its own fields (project, dates, people), a **Generate** button and a table of results |

## How it works
- **Overview:** a **project filter** and a **period** dropdown sit in the top bar. The counts, the per-person completions and the daily chart come from the server for the chosen project (or all the caller may see); nothing is totalled in the browser from the whole task list.
- **KPIs and reports** are calculated on the server and limited to the projects the caller may report on. A project dropdown ("All my projects") scopes the KPIs.
- A report runs only when **Generate** is pressed; a required field left empty shows "Choose … first".
- Once a report or the KPIs have a result, **Excel** and **PDF** buttons export what is on screen. The files are made in the browser; no file is stored on the server.

## Data
`api/reports.js` (`/reports/kpis`, `/project`, `/tasks`, `/project-status`, `/task-completion`, `/overdue`, `/team-performance`, `/workload`), `api/tasks.js` (summary), `api/dashboard.js` (task activity), `api/teamViews.js`; components in `components/reports/`.
