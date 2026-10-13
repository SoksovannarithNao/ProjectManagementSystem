# Feature & Development Roadmap

What is built, what is incomplete, and what the project's own documents say comes next. Compiled **2026-10-06**; rows brought up to date with the code on **2026-10-09** (change-plan batches 1–3c), **2026-10-10** and **2026-10-12** (a full documentation pass).

**Rule used:** a feature is **Done** only when the UI, the backend API **and** the database all support it end to end. A screen that exists without a working backing is **Partial**. Test coverage is reported separately, because a feature can work without being tested.

| Status | Meaning |
|---|---|
| **Done** | Works through UI → API → database |
| **Partial** | Usable but narrower than intended (the gap is stated) |
| **Not started** | Nothing user-facing; at most a database table |
| **In progress** | Evidence of unmerged work — **none found** (see §4) |
| **Blocked** | A recorded external dependency stops it — **none recorded** (see §5) |

| Tests | Meaning |
|---|---|
| **Good** | Core behaviour has automated tests (unit and/or end-to-end) |
| **Partial** | Some behaviour is tested, important parts are not |
| **None** | No automated test |

Sources of evidence: the code (controllers, services, pages, SQL), the running application, the test suites ([testing.md](testing.md)), the former project READMEs' *Future Enhancements* / *Next Steps* sections (now in the root README, [backend.md](backend.md#next-steps) and [database.md](database.md#14-api--backend-coverage)), and the requirement documents ([assignment-brief.md](../assignment-brief.md), [project-workflow.md](../project-workflow.md), [Role_Requirment.md](../Role_Requirment.md)).

## 1. Completed and partial features

### Accounts and access

| Feature | Status | UI | API | DB | Tests | Notes / gap |
|---|---|---|---|---|---|---|
| Login with JWT, rate limiting | Done | ✓ | ✓ | ✓ | Partial | e2e login tests and the per-request account check are tested; `JwtService` and `LoginRateLimiter` untested. Username **or e-mail** since 2026-10-09; auto-logout after 15 idle minutes with a 60-second warning since 2026-10-12 (`idle-and-updates.spec.js`). A deactivated account's token is rejected immediately (fixed 2026-10-06) |
| Self-registration with emailed OTP | Done | ✓ | ✓ | ✓ | None | Mailpit locally; no cleanup of unverified accounts |
| Profile, password change, photo, theme, notification preference | Done | ✓ | ✓ | ✓ | None | |
| Password policy and live checklist | Done | ✓ | ✓ | — | None | UI + backend; manually verified only |
| Administrator user management | Done (2026-10-13) | create, edit, set status, delete, give a role | ✓ create/update/delete | ✓ | Partial | `user-management.spec.js` and `UserRoleServiceTest` cover edit, deactivate, delete and the guards; creating an account from the UI has no dedicated test |
| Roles and permissions management | Done (2026-10-13) | ✓ *Administration → Roles & Permissions* grid, *New role*, rename, delete | ✓ | ✓ | Good | The grants of every role but the Administrator's can be edited; built-in roles cannot be renamed or deleted (F-21); extra system roles can be created, renamed and deleted (G-06, D-14); `RoleServiceTest` and `custom-roles.spec.js` cover them |
| Positions and departments | Partial | ✓ | create + list | ✓ | None | No update/delete; users pick their own on the Profile page; "+ Add New" is hidden without `LOOKUP:CREATE` (F-22) |
| Project-level authorization | Done | ✓ (hides controls) | ✓ | ✓ | Good | A data-driven role × resource × action matrix; `PermissionServiceTest` checks every grant and every refusal. The 2026-10-06 data-isolation and `VIEWER` defects (former I-01…I-07) are fixed and tested |

### Projects and teams

| Feature | Status | UI | API | DB | Tests | Notes / gap |
|---|---|---|---|---|---|---|
| Project create / edit / delete / status | Done | ✓ | ✓ | ✓ | Partial | Code generation and duplicate handling tested; UI flows manually verified. A completion date (`projects.completed_at`, `V14`) is stamped and cleared by a trigger (2026-10-12, `quick-wins.spec.js`) |
| Auto-generated project code (`PRJ-####`) | Done | ✓ | ✓ | ✓ | Good | |
| Project progress (derived) | Done | ✓ | — | ✓ triggers | Partial | Guarded only by `verify_invariants.sql` in CI |
| Invitations: send, accept, decline | Done | ✓ | ✓ | ✓ | Partial | Sending is tested; accept/decline UI is not. Invisible if the invitee disabled notifications (I-12) |
| Pending-invitation count | Done | ✓ managers | ✓ | ✓ | Good | No list/cancel UI (I-13) |
| Invitable-user search and eligibility rules | Done | ✓ | ✓ | ✓ | Good | |
| Member removal | Done | ✓ Team page | ✓ | ✓ | None | |
| Member role assignment | Done (2026-10-09) | ✓ role picker, ownership transfer | ✓ | ✓ | e2e | The Team page invites with a chosen role; the project page's *Add Member* dialog sends none, so the invitee joins as `MEMBER` and the role is changed afterwards |
| Exactly one owner per project | Done | ✓ | ✓ | ✓ deferred trigger | Good | Replaced "last-owner protection" in `V10` |

### Tasks and planning

| Feature | Status | UI | API | DB | Tests | Notes / gap |
|---|---|---|---|---|---|---|
| Task create / edit / delete / status | Done | ✓ | ✓ | ✓ | Partial | e2e opens the task panel only |
| Task assignment | Done | ✓ single | ✓ many | ✓ triggers | None | |
| *My Tasks* filter (assignee-based) | Done | ✓ | ✓ existing | — | None | Manually verified against live data |
| Subtasks and subtask-driven progress | Done | ✓ | ✓ | ✓ triggers | None | |
| Task dependencies and blocked state | Done | ✓ | ✓ | ✓ triggers | None | Cross-project dependencies not prevented (I-15) |
| Comments | Partial | add/edit/delete/reply | ✓ incl. replies | ✓ | e2e | No notification (2026-10-09: replies in the UI) |
| Activity feed (task, project, recent) | Done (2026-10-09) | ✓ | ✓ | ✓ | Good | Task, project, milestone, comment, file and approval events are written; time logs are not |
| Task approval workflow | Done (2026-10-09) | ✓ | ✓ | ✓ `V12` | Good | Request, designated approver, Approved / Changes requested / Rejected |
| Attachments and checklists | Done (2026-10-09) | ✓ | ✓ | ✓ `V13` | Good | 10 MB, 25 per target, type allow-list; checklist items count in progress |
| Milestones | Done (2026-10-12) | add / edit / delete | ✓ full CRUD | ✓ | Good | Edit form with a warning when completing with open tasks; shown on the calendar; no picker on the task forms |
| Kanban board | Partial | ✓ view | uses `/tasks` | ✓ | None | Cards open the panel; **no drag-and-drop** |
| Error pages (404, 403, 5xx …) | Done (2026-10-10) | ✓ | — | — | e2e | One `ErrorPage` for every status; a mistyped address no longer shows an empty screen |
| Help & Support page | Done (2026-10-10) | ✓ page (was a modal) | — | — | e2e | Static FAQ, corrected and extended |
| Gantt chart prototype | Done (2026-10-10) | ✓ | uses `/tasks`, `/task-dependencies` | ✓ | e2e | Duration bars, dependency arrows, conflict warning, overlap fading; open to every member; no dragging |
| Calendar (month/week/day) | Done (2026-10-12) | ✓ | uses `/tasks` and `/milestones` | ✓ | Partial | Task due dates and milestones; only the milestones are covered by a test |
| Task and project search / filter / sort | Done in the browser (2026-10-09) | ✓ | client-side | — | e2e | Tasks: search, filter by priority, status, project, assignee, due date and My Tasks, six sorts, and (2026-10-12) quick views for Today, Upcoming, In Progress, Completed and Overdue plus a *Due soon* flag on tasks due within 3 days. Projects: search incl. manager and status, filters, sort. The list endpoints take no filter parameters (G-16) |
| Overdue detection | Done (notices 2026-10-10) | ✓ badge | ✓ computed | ✓ view | Good | Overdue is computed (`util/Derived`); a daily job sends the overdue notice and the 3- and 1-day reminders (`DeadlineNotificationService`, 16 unit tests); the DB function is no longer used by the app |
| Dashboard | Done (2026-10-09) | ✓ | `/dashboard/stats`, `/activity-logs/recent`, `/workload` | — | e2e | project counts incl. Delayed, recent activity, manager workload; KPIs are separate |

### Notifications and reporting

| Feature | Status | UI | API | DB | Tests | Notes / gap |
|---|---|---|---|---|---|---|
| In-app notifications (bell, read, dismiss) | Done (2026-10-12) | ✓ | ✓ | ✓ | Good | All 11 types produced (assignment, status change, approval requested / decided, invitation and response, deadline reminders and overdue notices since 2026-10-10, and since 2026-10-12 comments, project updates and milestone updates); none for a member added or removed (D-10); no live refresh |
| Reports page | Done (export optional) | ✓ | `/api/reports/*` | views unused | Good | Overview charts, the KPIs and the seven named reports (2026-10-09); `ReportServiceTest` (25) and `reports.spec.js` (13), the Overview charts are untested; no PDF/Excel export |
| Workload view | Done (2026-10-09) | ✓ | `/projects/{id}/workload`, `/workload` | computed in Java | unit + e2e | assigned / active / overdue, estimated and actual hours, overloaded / underloaded (D-13) |

### Platform and delivery

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Docker Compose stack (db, one-shot Flyway `migrate`, mail, backend, frontend) | Done | `docker-compose.yml` | Healthchecks; rebuild needed after code changes |
| CI (lint, unit tests and build; backend tests + DB invariants; Playwright against a fresh stack; image builds) | Done (2026-10-12) | `.github/workflows/ci.yml` | The `e2e` job was validated by a local simulation and has not yet run on GitHub |
| CD (build and push images to GHCR) | Partial | `.github/workflows/cd.yml` | No deploy step |
| Java 25 / Spring Boot 4 | Done | `pom.xml`, `Dockerfile`, CI | Upgraded 2026-10-06 |
| Flyway migrations | Partial | `database/taskmanager/`, the `migrate` service in `docker-compose.yml` | Applied by Compose, not by the app or CI; the migrations still lack some task/subtask objects that `init/` has (X-04) |
| Documentation | Done | this `docs/` folder (the per-folder READMEs were merged into it on 2026-10-08) | Checked page by page against the code on 2026-10-12 (see [issues.md](issues.md#4-documentation-drift), D-11); `api/openapi.yaml` is not maintained |

## 2. Not started

Database tables exist for several of these, but **no entity, API or UI**:

| Feature | What exists | Evidence |
|---|---|---|
| ~~File attachments (projects/tasks)~~ | done 2026-10-09 (`V13`) | 10 MB, 25 per target, type allow-list; stored in the database |
| ~~Checklist items~~ | done 2026-10-09 (`V13`) | counted in task progress with subtasks (D-07) |
| ~~Deadline reminders~~ | done 2026-10-10 | 3 and 1 days before a task, milestone or project deadline, to the assignees and the Owner |
| ~~Overdue notifications at runtime~~ | done 2026-10-10 | Spring `@Scheduled`, daily 08:00 and at startup; once per person and due date |
| ~~Named reports~~ | done 2026-10-09 | The seven reports are `GET /api/reports/*`, calculated live |
| PDF / Excel export of reports | `report_exports` table | No endpoint or UI; optional |
| ~~KPI calculation~~ | done 2026-10-09 | `GET /api/reports/kpis`, calculated live; `kpi_snapshots` is still never written |
| ~~Gantt chart~~ | done 2026-10-10 (prototype) | `GanttChart.jsx`, the project's *Gantt* tab; no backend |
| Refresh tokens, forgot-password | — | Listed as future work in the READMEs (auto-logout was built 2026-10-12) |
| Administrator audit log | Done (2026-10-13) | `audit_logs` (`V16`), `GET /api/audit-logs`, *Administration → Audit log* | Optional ("may") item; `audit-log.spec.js`, `AuditLogServiceTest` |
| ~~Server-side report endpoints~~ | Done 2026-10-09 | `GET /api/reports/*` check `REPORT:GENERATE_REPORTS` on the server |
| Pagination and server-side search/filter | — | Listed in the READMEs; filtering runs in the browser (G-16) |

## 3. Planned work recorded by the project

From the root `README.md` (*Future Enhancements*), `backend.md` (*Next Steps*), `database.md`, `frontend.md` and the requirement files. These are the project's own stated intentions, not commitments with dates; **no owners or dates are recorded anywhere in the repository**.

1. Refresh-token flow.
2. ~~Server-side report endpoints gated by `REPORT:GENERATE_REPORTS`~~ — done 2026-10-09 (the matrix itself became data-driven on 2026-10-08, [ADR-0014](adr/0014-requirement-roles-and-permission-matrix.md)).
3. ~~Scheduled job for overdue notices and deadline reminders~~ — done 2026-10-10 (`DeadlineScheduler`).
4. ~~Remaining notification types (`COMMENT_ADDED`, `PROJECT_UPDATED`, `MILESTONE_UPDATED`)~~ — done 2026-10-12 (`UpdateNotificationService`).
5. Pagination, search and filtering on list endpoints.
6. Flyway in CI and a production deployment (locally the Compose `migrate` service runs it).
7. ~~Entities and controllers for `checklist_items`, `attachments`, `work_logs`.~~ Done.
8. ~~Endpoints over the reporting views~~ — the reports are calculated in Java instead (2026-10-09); `report_exports` (PDF / Excel export) and `kpi_snapshots` remain.
9. More backend tests (controller and repository). ~~Playwright in CI~~ — done 2026-10-12.
10. A deploy target for the CD pipeline.
11. ~~A project-wide activity feed~~ — done 2026-10-09; ~~an administrator audit view~~ — done 2026-10-13.
12. ~~Closing the CI vs `03-app-role.sh` grant drift~~ — the lists match (21 tables plus `audit_logs`, checked 2026-10-13).

Requirement-document items that are **not** on any of the project's own lists (so there is no stated plan for them): Kanban drag-and-drop. (Email login and the per-member Team Tasks view were on this list until 2026-10-09; the "Today / Upcoming" task views, calendar milestones, the project completion date and editing a milestone until 2026-10-12.)

## 3a. Specification alignment (approved 2026-10-08, mostly done)

Work needed to bring the application to the model in [ADR-0015](adr/0015-two-level-roles-system-and-project.md) and [assignment-brief.md](../assignment-brief.md) Part B. The authoritative gap list is §B13.1 (G-01 … G-15); the order below is a proposal.

1. ~~**Role model migration**~~ — **done 2026-10-08** (`V10`): the `TEAM_LEADER` / `TEAM_MEMBER` system roles are retired, new accounts are `USER`, one `OWNER` per project with single-step transfer. The stored status was renamed `TO_DO` → `TODO` on 2026-10-09 (`V11`, D-15).
2. ~~**Matrix changes**~~ — **done 2026-10-08** (`V10`): Team Member loses task creation and "edit any subtask"; report access comes through the project roles; a Team Leader may delete everything except the project (D-01); a system role never widens a project role (D-02).
3. ~~**Approval workflow:** approval records, designated approver, Approved / Changes requested / Rejected, notifications, activity entries.~~ — **done 2026-10-09** (`V12`).
4. **Profile and roles:** ~~users edit their own position/department (D-16)~~ — **done 2026-10-09**; ~~administrators create and edit extra system roles (D-14)~~ — **done 2026-10-13**.
5. **Required features still missing:** none. *(Auto-logout and the comment, project and milestone notifications: done 2026-10-12. Deadline reminders and overdue notifications: done 2026-10-10.)* *(Checklists, attachments, comment replies and project activity: 3a; the project timeline, Team Tasks, Delayed projects, the workload page, dashboard statistics and role / ownership UI: 3b; the five KPIs and the seven named reports, server-side: 3c; all 2026-10-09.)*
6. **Optional, if time allows:** Kanban moving, time-tracking polish (exists), report export, documents. (The Gantt prototype was built on 2026-10-10 and the audit log on 2026-10-13.)

## 4. In progress

**None found.** On 2026-10-12 the work is on branch `feat/complete_requirment` at commit `5990b0e`; change-plan batches 1–3c are committed (`5cda340`) and the working tree holds only the documentation pass. Other local branches exist (`backend/*`, `database/*`, `Project/*`, `fronrtend/updateUI`) but were not reviewed, so work in them is **Unknown**.

## 5. Blocked

**None recorded.** No document in the repository names a blocker. Dependencies worth knowing before scheduling:

- PDF/Excel export needs a library choice on either side — none is currently in `pom.xml` or `package.json`.
- Deployment depends on a target environment that is **Unknown**.

## 6. Suggested order of work (proposal)

Not a commitment — an ordering derived from the risks and gaps found. Items reference [issues.md](issues.md).

| Order | Theme | Items | Why first |
|---|---|---|---|
| 1 | ~~Close the data-isolation and permission holes~~ **Done 2026-10-06** | I-01 … I-07 (now F-12 … F-18) | Fixed with tests. Follow-up: extend to a full role × action test for every write endpoint; guard the system roles (I-10) |
| 2 | **Make the demo flow complete** | ~~named reports~~, ~~dashboard project counts~~, ~~email login~~ (all done 2026-10-09); ~~deadline/overdue notifications~~ (done 2026-10-10); ~~comment notifications~~ (done 2026-10-12) | The requirement flow expects reminders |
| 3 | **Finish half-built features** | pending-invitation list/cancel, ~~admin user screens (edit / deactivate / delete)~~ (done 2026-10-13), a role picker in the project page's Add Member dialog (~~role assignment UI~~, ~~comment replies~~, ~~search/filter/sort~~, ~~milestone edit + calendar milestones~~, ~~project completion date~~, ~~"Today / Upcoming" views~~ are done) | Each is a small gap in an otherwise working feature |
| 4 | **Quality and delivery** | ~~Playwright in CI~~ (done 2026-10-12), service/controller tests, fix migration drift, regenerate OpenAPI (~~CI grants~~ are in step) | Protects everything above |
| 5 | **Optional modules** | report export, ~~audit view~~, Kanban drag-and-drop, document management (~~attachments~~, ~~time tracking~~, ~~KPIs~~, ~~Gantt~~ are done) | The requirement documents mark most of these as optional |
