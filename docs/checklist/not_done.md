# Checklist — Not Done (10 items)

Audit date: 2026-10-08 · Compared against [assignment-brief.md](../../assignment-brief.md) and [project-workflow.md](../../project-workflow.md). Roles, permissions, approval and the open decisions follow the approved specification in the brief's Part B (updated 2026-10-08).
Sibling lists: [done.md](done.md) · [partially_done.md](partially_done.md) · [not_fully_satisfy.md](not_fully_satisfy.md) · [unclear.md](unclear.md).

These requirements are missing. Item numbers are shared by every file in this folder.

| # | Requirement | Status | Evidence | What is needed |
|---|---|---|---|---|
| 10 | Dashboard: Total / Active / Completed / **Delayed** projects | ~~Not done~~ **Done 2026-10-09** | `GET /api/dashboard/stats`, `DashboardService`, the dashboard strip; Delayed is derived (`util/Derived`) | — |
| 21 | Project timeline (start / end dates, milestone dates, task dates) | ~~Not done~~ **Done 2026-10-09** | `/projects/:id/timeline`, `TimelineView.jsx` | — |
| 25 | Project filters (Active, Completed, On Hold, Priority, Manager) | Not done | None in [Projects.jsx](../../frontend/src/pages/Projects.jsx) | Add the filters |
| 38 | Gantt chart prototype ("may") | Not done | No code | Optional |
| 42 | File attachments and documents | ~~Not done~~ **Done 2026-10-09** (attachments; document management is optional and not built) | `V13`, `AttachmentService`, `AttachmentsSection.jsx` | — |
| 46 | Deadline reminders (1 and 3 days before) | Not done | No `@Scheduled` job anywhere in the backend | A scheduler and reminder logic |
| 47 | Overdue notification | Not done | `fn_generate_overdue_notifications` ([01-init.sql:957](../../database/init/01-init.sql#L957)) is never called at runtime (project docs say only the seed script calls it) | A scheduler |
| 51b | Project statistics (totals, active, completed, delayed, average completion rate) | ~~Not done~~ **Done 2026-10-09** | `GET /api/dashboard/stats` and the dashboard strip | — |
| 52 | KPIs ("may") | ~~Not done~~ **Done 2026-10-09** | `GET /api/reports/kpis` and the *KPIs* tab ([ReportService.java](../../backend/src/main/java/backend/service/ReportService.java)) | — |
| 54 | Seven named reports and PDF / Excel export | ~~Not done~~ **Reports done 2026-10-09**; export not done | The seven reports are `GET /api/reports/*` and tabs of the Reports page; the `report_exports` table is unused | PDF / Excel export (optional) |
