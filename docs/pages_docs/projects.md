# Projects

**Route** `/projects` · **Access** any signed-in user (only projects they belong to; an Administrator sees all) · **Source** [Projects.jsx](../../frontend/src/pages/Projects.jsx)

## What it does
A grid of project cards with search, filters and sorting, and the entry point for creating a project.

## How it works
- Each card (progress, status, dates, manager, team) opens [Project Detail](project-detail.md). Task counts on the cards come from one project-stats request.
- **Search** matches name, description, code, manager, status, "delayed" and the dates.
- **Filter**: status (Planning, Active, On Hold, Completed, Cancelled, Delayed), priority, project manager. The counter on the button shows how many are on.
- **Sort**: default, name, start date, end date, priority, progress. The default keeps the server's order but moves finished projects (100 %) to the end.
- Filtering and sorting only narrow what the server already returned, so they cannot reveal a project the person cannot open.
- **New Project** appears only with the system right `PROJECT:CREATE` (Administrator, Project Manager). The creator becomes the project's Owner.
- Empty states differ: no projects at all (with a hint that depends on the create right) and "no projects match" (with a Clear button).

## Data
`api/projects.js`, `api/projectMembers.js`, `api/tasks.js` (project task stats).
