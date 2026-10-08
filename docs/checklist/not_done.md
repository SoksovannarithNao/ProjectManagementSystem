# Checklist — Not Done (10 items)

Audit date: 2026-10-08 · Compared against [assignment-brief.md](../../assignment-brief.md) and [project-workflow.md](../../project-workflow.md). Roles, permissions, approval and the open decisions follow the approved specification in the brief's Part B (updated 2026-10-08).
Sibling lists: [done.md](done.md) · [partially_done.md](partially_done.md) · [not_fully_satisfy.md](not_fully_satisfy.md) · [unclear.md](unclear.md).

These requirements are missing. Item numbers are shared by every file in this folder.

| # | Requirement | Status | Evidence | What is needed |
|---|---|---|---|---|
| 10 | Dashboard: Total / Active / Completed / **Delayed** projects | Not done | The Dashboard shows two project cards only; "Delayed" exists only in SQL ([01-init.sql:1017-1024](../../database/init/01-init.sql#L1017)) | Project stat cards and a definition of "Delayed" |
| 21 | Project timeline (start / end dates, milestone dates, task dates) | Not done | No timeline view | Timeline or Gantt view |
| 25 | Project filters (Active, Completed, On Hold, Priority, Manager) | Not done | None in [Projects.jsx](../../frontend/src/pages/Projects.jsx) | Add the filters |
| 38 | Gantt chart prototype ("may") | Not done | No code | Optional |
| 42 | File attachments and documents | Not done | `attachments` table only; no entity, API or UI | Storage design and a full build |
| 46 | Deadline reminders (1 and 3 days before) | Not done | No `@Scheduled` job anywhere in the backend | A scheduler and reminder logic |
| 47 | Overdue notification | Not done | `fn_generate_overdue_notifications` ([01-init.sql:957](../../database/init/01-init.sql#L957)) is never called at runtime (project docs say only the seed script calls it) | A scheduler |
| 51b | Project statistics (totals, active, completed, delayed, average completion rate) | Not done | None | An endpoint and dashboard cards |
| 52 | KPIs ("may") | Not done | None | Optional |
| 54 | Seven named reports and PDF / Excel export | Not done | The Reports page is charts only; the `report_exports` table is unused | Report endpoints and export |
