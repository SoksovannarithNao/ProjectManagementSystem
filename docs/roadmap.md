# Feature & Development Roadmap

What is built, what is incomplete, and what the project's own documents say comes next. Compiled **2026-10-06**.

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

Sources of evidence: the code (controllers, services, pages, SQL), the running application, the test suites ([testing.md](testing.md)), the former project READMEs' *Future Enhancements* / *Next Steps* sections (now in the root README, [backend.md](backend.md#next-steps) and [database.md](database.md#14-api--backend-coverage)), and the requirement documents ([Role_Requirment.md](../Role_Requirment.md), [Project_requirement_plan.md](../Project_requirement_plan.md)).

## 1. Completed and partial features

### Accounts and access

| Feature | Status | UI | API | DB | Tests | Notes / gap |
|---|---|---|---|---|---|---|
| Login with JWT, rate limiting | Done | ✓ | ✓ | ✓ | Partial | e2e login tests and the per-request account check are tested; `JwtService` and `LoginRateLimiter` untested. Username only (no email login). A deactivated account's token is rejected immediately (fixed 2026-10-06) |
| Self-registration with emailed OTP | Done | ✓ | ✓ | ✓ | None | Mailpit locally; no cleanup of unverified accounts |
| Profile, password change, photo, theme, notification preference | Done | ✓ | ✓ | ✓ | None | |
| Password policy and live checklist | Done | ✓ | ✓ | — | None | UI + backend; manually verified only |
| Administrator user management | Partial | create only | ✓ create/update/delete | ✓ | Partial | No UI to edit, deactivate or delete a user |
| Roles management | Partial | — | ✓ | ✓ | None | API only; two roles exist; no guard on renaming/deleting them (I-10) |
| Positions and departments | Partial | ✓ | create + list | ✓ | None | No update/delete; UI offers "Add New" to non-admins who then get `403` (X-01) |
| Project-level authorization | Done | ✓ (hides controls) | ✓ | ✓ | Partial | The data-isolation and `VIEWER` defects (former I-01…I-07) were fixed on 2026-10-06 and are tested; open: roles API has no guard on system roles (I-10), Team page offers an action non-admins can't use (X-01); no role × action test for every endpoint |

### Projects and teams

| Feature | Status | UI | API | DB | Tests | Notes / gap |
|---|---|---|---|---|---|---|
| Project create / edit / delete / status | Done | ✓ | ✓ | ✓ | Partial | Code generation and duplicate handling tested; UI flows manually verified |
| Auto-generated project code (`PRJ-####`) | Done | ✓ | ✓ | ✓ | Good | |
| Project progress (derived) | Done | ✓ | — | ✓ triggers | Partial | Guarded only by `verify_invariants.sql` in CI |
| Invitations: send, accept, decline | Done | ✓ | ✓ | ✓ | Partial | Sending is tested; accept/decline UI is not. Invisible if the invitee disabled notifications (I-12) |
| Pending-invitation count | Done | ✓ managers | ✓ | ✓ | Good | No list/cancel UI (I-13) |
| Invitable-user search and eligibility rules | Done | ✓ | ✓ | ✓ | Good | |
| Member removal | Done | ✓ Team page | ✓ | ✓ | None | |
| Member role assignment | Partial | — | ✓ | ✓ | None | No UI; invitees always join as `MEMBER` |
| Last-owner protection | Done | — | ✓ | ✓ trigger | None | |

### Tasks and planning

| Feature | Status | UI | API | DB | Tests | Notes / gap |
|---|---|---|---|---|---|---|
| Task create / edit / delete / status | Done | ✓ | ✓ | ✓ | Partial | e2e opens the task panel only |
| Task assignment | Done | ✓ single | ✓ many | ✓ triggers | None | |
| *My Tasks* filter (assignee-based) | Done | ✓ | ✓ existing | — | None | Manually verified against live data |
| Subtasks and subtask-driven progress | Done | ✓ | ✓ | ✓ triggers | None | |
| Task dependencies and blocked state | Done | ✓ | ✓ | ✓ triggers | None | Cross-project dependencies not prevented (I-15) |
| Comments | Partial | add/edit/delete/reply | ✓ incl. replies | ✓ | e2e | No notification (2026-10-09: replies in the UI) |
| Per-task activity feed | Done | ✓ | ✓ | ✓ | None | Project-wide feed missing; most allowed actions never written (I-16) |
| Milestones | Partial | add/delete | ✓ full CRUD | ✓ | None | No edit UI; no picker on task forms; not on the calendar |
| Kanban board | Partial | ✓ view | uses `/tasks` | ✓ | None | Cards open the panel; **no drag-and-drop** |
| Calendar (month/week/day) | Partial | ✓ | uses `/tasks` | ✓ | None | Tasks only — no milestones |
| Task search / filter / sort | Partial | ✓ | client-side | — | None | Missing: filter by status, assignee, due date; sort by latest, progress, status; project search is name/description only |
| Overdue detection | Partial | ✓ badge | ✓ computed | ✓ view | None | No notification (nothing calls the DB function) |
| Dashboard | Done (2026-10-09) | ✓ | `/dashboard/stats`, `/activity-logs/recent`, `/workload` | — | e2e | project counts incl. Delayed, recent activity, manager workload; KPIs are separate |

### Notifications and reporting

| Feature | Status | UI | API | DB | Tests | Notes / gap |
|---|---|---|---|---|---|---|
| In-app notifications (bell, read, dismiss) | Partial | ✓ | ✓ | ✓ | None | 6 of 11 types produced; no live refresh |
| Reports page | Done (export optional) | ✓ | `/api/reports/*` | views unused | None | Overview charts, the KPIs and the seven named reports (2026-10-09); no PDF/Excel export |
| Workload view | Done (2026-10-09) | ✓ | `/projects/{id}/workload`, `/workload` | computed in Java | unit + e2e | assigned / active / overdue, estimated and actual hours, overloaded / underloaded (D-13) |

### Platform and delivery

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Docker Compose stack (db, mail, backend, frontend) | Done | `docker-compose.yml` | Healthchecks; rebuild needed after code changes |
| CI (lint/build, backend tests + DB invariants, image builds) | Done | `.github/workflows/ci.yml` | Playwright not included |
| CD (build and push images to GHCR) | Partial | `.github/workflows/cd.yml` | No deploy step |
| Java 25 / Spring Boot 4 | Done | `pom.xml`, `Dockerfile`, CI | Upgraded 2026-10-06 |
| Flyway migrations | Partial | `database/taskmanager/` | Not run by the app; has drifted from `init/` (X-04) |
| Documentation | Done | this `docs/` folder (the per-folder READMEs were merged into it on 2026-10-08) | Some existing files remain stale (see [issues.md](issues.md#4-documentation-drift)) |

## 2. Not started

Database tables exist for several of these, but **no entity, API or UI**:

| Feature | What exists | Evidence |
|---|---|---|
| ~~File attachments (projects/tasks)~~ | done 2026-10-09 (`V13`) | 10 MB, 25 per target, type allow-list; stored in the database |
| ~~Checklist items~~ | done 2026-10-09 (`V13`) | counted in task progress with subtasks (D-07) |
| Deadline reminders | `DEADLINE_REMINDER` type allowed | No code or database function produces it |
| Overdue notifications at runtime | `fn_generate_overdue_notifications()` | Called only by the seed script; no scheduler (`@Scheduled`/`pg_cron`) |
| Named reports and PDF/Excel export | reporting views, `report_exports` | No endpoint or UI |
| KPI calculation | `kpi_snapshots` | Nothing writes to it |
| Gantt chart | — | Mentioned in `Contributing.md`/requirements only |
| Refresh tokens, forgot-password, auto-logout | — | Listed as future work in the READMEs |
| Project-wide/per-user audit feed | per-task feed only | Listed in the READMEs |
| ~~Server-side report endpoints~~ | Done 2026-10-09 | `GET /api/reports/*` check `REPORT:GENERATE_REPORTS` on the server |
| Pagination and server-side search/filter | — | Listed in the READMEs |

## 3. Planned work recorded by the project

From the root `README.md` (*Future Enhancements*), `backend.md` (*Next Steps*), `database.md`, `frontend.md` and the requirement files. These are the project's own stated intentions, not commitments with dates; **no owners or dates are recorded anywhere in the repository**.

1. Refresh-token flow.
2. Server-side report endpoints gated by `REPORT:GENERATE_REPORTS` (the matrix itself became data-driven on 2026-10-08, [ADR-0014](adr/0014-requirement-roles-and-permission-matrix.md)).
3. Scheduled job for `fn_generate_overdue_notifications()` and deadline reminders.
4. Remaining notification types (`COMMENT_ADDED`, `PROJECT_UPDATED`, `MILESTONE_UPDATED`, `DEADLINE_REMINDER`).
5. Pagination, search and filtering on list endpoints.
6. Flyway wired into application startup.
7. ~~Entities and controllers for `checklist_items`, `attachments`, `work_logs`.~~ Done.
8. Endpoints over the reporting views, `report_exports` and `kpi_snapshots`.
9. More backend tests; Playwright in CI.
10. A deploy target for the CD pipeline.
11. A project-wide / per-user activity feed.
12. Closing the CI vs `03-app-role.sh` grant drift.

Requirement-document items that are **not** on any of the project's own lists (so there is no stated plan for them): Gantt chart, email login, per-member Team Tasks view, "Today / Upcoming" task sections, calendar milestones, Kanban drag-and-drop, project-completion date.

## 3a. Specification alignment (approved 2026-10-08, not started)

Work needed to bring the application to the model in [ADR-0015](adr/0015-two-level-roles-system-and-project.md) and [assignment-brief.md](../assignment-brief.md) Part B. The authoritative gap list is §B13.1 (G-01 … G-15); the order below is a proposal.

1. ~~**Role model migration**~~ — **done 2026-10-08** (`V10`): the `TEAM_LEADER` / `TEAM_MEMBER` system roles are retired, new accounts are `USER`, one `OWNER` per project with single-step transfer. The stored status was renamed `TO_DO` → `TODO` on 2026-10-09 (`V11`, D-15).
2. ~~**Matrix changes**~~ — **done 2026-10-08** (`V10`): Team Member loses task creation and "edit any subtask"; report access comes through the project roles; a Team Leader may delete everything except the project (D-01); a system role never widens a project role (D-02).
3. ~~**Approval workflow:** approval records, designated approver, Approved / Changes requested / Rejected, notifications, activity entries.~~ — **done 2026-10-09** (`V12`).
4. **Profile and roles:** ~~users edit their own position/department (D-16)~~ — **done 2026-10-09**; administrators create and edit extra system roles (D-14) — still open.
5. **Required features still missing:** the seven named reports and the five KPIs (server-side), deadline reminders and overdue notifications (scheduled), auto-logout. *(Checklists, attachments, comment replies and project activity: 3a; the project timeline, Team Tasks, Delayed projects, the workload page, dashboard statistics and role / ownership UI: 3b; all 2026-10-09.)* *(Checklists, file attachments, comment replies in the UI and project / comment / file activity events were built on 2026-10-09, change-plan 3a.)*
6. **Optional, if time allows:** Kanban moving, time-tracking polish (exists), report export, Gantt, documents, audit log.

## 4. In progress

**None found.** At the time of writing, the git working tree contained only uncommitted changes from 2026-10-06 (this documentation and the security fixes in [issues.md](issues.md#5-fixed) F-12 … F-19); the most recent commits (`52a93b4` Java 25 upgrade and `115d52a` invitations/password/My Tasks work) are merged into the current branch. Other local branches exist (`backend/*`, `database/*`, `Project/*`, `fronrtend/updateUI`) but were not reviewed, so work in them is **Unknown**.

## 5. Blocked

**None recorded.** No document in the repository names a blocker. Dependencies worth knowing before scheduling:

- Deadline reminders and overdue notifications need a scheduler decision first (Spring `@Scheduled` vs `pg_cron`) — a design choice, not an external block.
- PDF/Excel export needs a library choice on either side — none is currently in `pom.xml` or `package.json`.
- Deployment depends on a target environment that is **Unknown**.

## 6. Suggested order of work (proposal)

Not a commitment — an ordering derived from the risks and gaps found. Items reference [issues.md](issues.md).

| Order | Theme | Items | Why first |
|---|---|---|---|
| 1 | ~~Close the data-isolation and permission holes~~ **Done 2026-10-06** | I-01 … I-07 (now F-12 … F-18) | Fixed with tests. Follow-up: extend to a full role × action test for every write endpoint; guard the system roles (I-10) |
| 2 | **Make the demo flow complete** | named reports + export, dashboard project counts, email login, deadline/overdue notifications | The requirement flow ends with "generate report" and expects reminders |
| 3 | **Finish half-built features** | role assignment UI, milestone edit + calendar, comment replies, pending-invitation list/cancel, admin user screens, search/filter/sort completeness | Each is a small gap in an otherwise working feature |
| 4 | **Quality and delivery** | Playwright in CI, service/controller tests, fix migration drift and CI grants, regenerate OpenAPI | Protects everything above |
| 5 | **Optional modules** | attachments, time tracking, Gantt, KPIs, audit feed, Kanban drag-and-drop | The requirement documents mark most of these as optional |
