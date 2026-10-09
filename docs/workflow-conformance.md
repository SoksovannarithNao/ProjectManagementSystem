# Workflow Conformance Test — 2026-10-08

The running application tested against [project-workflow.md](../project-workflow.md) and the approved specification ([assignment-brief.md](../assignment-brief.md) Part B). Sections 1–5 record the test **before any change** to the application, so the result could be trusted; section 6 records the re-test after the role-model migration (`V10`) done later the same day; section 7 records the re-test after change-plan batch 1 (2026-10-09); sections 8–11 record the later batches.

## 1. How it was tested

| Part | Method | Size |
|---|---|---|
| API | A script played each flow against the live backend as Administrator, Project Manager, Team Leader, Team Member and Viewer (`admin.system`, `pm.olivia`, `lead.owen`, `dev.chen`, `dev.raj`), using a throw-away project, tasks, milestone and a registered test account | 71 checks + 8 for registration and passwords |
| UI | Playwright visited every screen as the Project Manager and read what each shows; the uncertain results were confirmed from screenshots | 10 screens |
| Source | Search of the code for schedulers and inactivity logout | 3 searches |
| Existing suites | backend 113/113; Playwright 34 of 40 at the time (the 6 `project-team.spec.js` cases, since fixed, see [testing.md](testing.md)) | — |

API result: **45 passed, 5 failed (all are gaps against the new specification), 17 "missing" (endpoint does not exist), 3 informational.** A sixth "failure" (registration verification) was a mistake in the test script (wrong field name); it was re-run correctly and passed.

All test data was removed afterwards (projects, tasks, milestone, test account). See §5 for one data problem I caused during clean-up.

## 2. Result per flow

Legend: **PASS** works as the workflow says · **PARTIAL** works in part · **MISSING** not in the application. "Optional" flows are not acceptance criteria.

| § | Flow | Class | Result | Evidence and what differs |
|---|---|---|---|---|
| 1 | Login & authentication | REQUIRED | PARTIAL | Username + password works; suspended and inactive accounts are refused (401). **Signing in with an email is refused** (401); the login form only says "Username". |
| 2 | User profile | REQUIRED | PARTIAL | View/edit name, email, gender, date of birth, phone, photo works. **A user cannot edit their own position or department** (the profile page has no such fields; the API ignores them). A project manager can set them from the Team page. |
| 3 | User & role management | REQUIRED | PARTIAL | An administrator creates users and gives a system role (Users page). The roles offered are the current set (`TEAM_LEADER`, `TEAM_MEMBER`, …), not `ADMINISTRATOR` / `PROJECT_MANAGER` / `USER`; **a new account gets `TEAM_MEMBER`**, not `USER`. |
| 4 | Role & permission | REQUIRED | PARTIAL | The permission grid is editable and takes effect on the next request. **Roles cannot be created or deleted.** |
| 5 | Dashboard | REQUIRED | PARTIAL | Shows the task overview (To Do, In Progress, **Review**, Completed, overdue count), due & overdue tasks, projects and a weekly chart. **Missing:** Total / Active / Completed / **Delayed** projects, recent activities, KPIs. |
| 6 | Project management | REQUIRED | PASS | A Project Manager creates a project and becomes its only Owner; a Team Member's attempt is refused with a message (403). |
| 7 | Create/edit project | REQUIRED | PASS | Priority *Critical* accepted, *Urgent* refused (400); end before start refused; code generated. |
| 8 | Project team management | REQUIRED | PARTIAL | Invite with a role and accept works; a Team Leader cannot invite an Owner (403), can remove a member (204) and cannot delete the project (403); a removed member gets 404. **A second Owner can be added (project had 2 Owners)** — the specification says exactly one. **No UI to change an existing member's role.** Workload per member is only an assigned-task count. |
| 9 | Project status & priority | REQUIRED | PASS | Statuses and the Critical scale as specified. "Delayed" is not calculated anywhere (see Dashboard, §5). |
| 10 | Project progress | REQUIRED | PASS | 5 tasks (1 completed, 1 cancelled, 3 open) gave **25 %** = 1 ÷ (5 − 1). |
| 11 | Task management | REQUIRED | PARTIAL | **A Team Member can create a task** (201); the specification says they cannot. A Team Leader can. |
| 12 | Create/edit task | REQUIRED | PARTIAL | Task priority *Urgent* accepted, *Critical* refused; due date after the project end refused; start after due refused. Same Team-Member creation gap as §11. |
| 13 | Task assignment | REQUIRED | PARTIAL | Only active members can be assigned (400 otherwise); a Team Member cannot assign (403). **The notification reads `You were assigned to "<task>"`** — it lacks the project, due date and who assigned it. |
| 14 | Task priority | REQUIRED | PASS | Low / Medium / High / Urgent. |
| 15 | Task status | REQUIRED | PARTIAL | An assigned Team Member can go To Do → In Progress → In Review (200) but not Completed (403); a Team Leader completes it. **No approval record, no Approved / Changes requested / Rejected.** Labels: Kanban and Tasks say **"Done"** / "Review" where the specification says *Completed* / *In Review*. |
| 16 | Task due date | REQUIRED | PASS | Date validation as specified. |
| 17 | Subtask & checklist | REQUIRED | PARTIAL | Subtasks work (a Team Member adds one; a task with an open subtask cannot be completed, 400). **Checklist items do not exist.** |
| 18 | Milestones | REQUIRED | PASS | An Owner creates one, a Team Member is refused (403), it can be completed while a linked task is open (200, API). The UI warning for that case was not checked. |
| 19 | Kanban board | REQUIRED / OPTIONAL | PARTIAL | Board with To Do, In Progress, Review, Done and a computed *Blocked* column. Cards are not draggable (optional). |
| 20 | Calendar | REQUIRED | PARTIAL | **Month, Week and Day views exist.** Shows task due dates; milestones were not seen on it. |
| 21 | My Tasks | REQUIRED | PARTIAL | A *My Tasks* checkbox in the Tasks filter. No Today / Upcoming / Completed / Overdue grouping (tasks are grouped by project as To Do / Doing / Done). |
| 22 | Team Tasks | REQUIRED | MISSING | No page; no endpoint. |
| 23 | Search, filter, sort | REQUIRED | PARTIAL | Tasks: search, sort, filter by priority, project and *My Tasks*. **No filter by status, assignee or due date.** Projects: search only — **no Active / Completed / On Hold / Priority / Manager filters, no sort.** |
| 24 | Comments & discussion | REQUIRED | PARTIAL | Comment (201), reply through the API (201), Viewer refused (403). **No reply control in the UI.** |
| 25 | File attachment | REQUIRED | MISSING | No endpoint, no UI. |
| 26 | Notifications | REQUIRED | PARTIAL | Produced: task assigned, status changed, invitation and its response. Not produced: comment, project update, milestone update, approvals, deadline, member removed. |
| 27 | Deadline reminder | REQUIRED | MISSING | No scheduled job exists (the database function is never called). |
| 28 | Overdue detection | REQUIRED | PARTIAL | Calculated and shown correctly (22 overdue tasks on the dashboard). **No overdue notification is generated** (the 28 in the database are seed rows). |
| 29 | Time tracking | OPTIONAL | PASS | A Team Member logs time (201), a Viewer is refused (403). |
| 30 | Team workload | REQUIRED | PARTIAL | A Workload chart on Reports (task counts per member). No estimated/actual hours, no overloaded/underloaded marking. |
| 31 | KPI | REQUIRED | MISSING | No completion, overdue, on-time or average-time rates. |
| 32 | Reports | REQUIRED | PARTIAL | Reports page has 4 totals and 4 charts. **None of the seven named reports exists**; no date range, no report endpoints. Export is optional and absent. |
| 33 | Activity log | REQUIRED | PARTIAL | Task events recorded (created, assigned, status changed). No project-level feed; no project/comment/file events. |
| 34 | State management | REQUIRED | PASS | Completing a task changed project progress and counts immediately. |
| 35 | Validation & errors | REQUIRED | PASS | Required fields, dates, priorities, permission messages, 404 for non-members. |
| 36–40 | Testing, E2E, documentation, presentation, demo | REQUIRED | n/a | Deliverables rather than application features. Automated tests: 113 backend, 40 Playwright; no single end-to-end test walks the whole §37 flow. |
| A1 | Registration | REQUIRED | PARTIAL | Register, code by email, verify, sign in, change password (200), wrong current password refused (400) all work; the new account cannot create a project (403). **Its role is `TEAM_MEMBER`, not `USER`.** |
| A2 | Change password & logout | REQUIRED | PASS | As above. |
| A3 | Session & auto-logout | REQUIRED | MISSING | One-hour token; no inactivity timer or warning anywhere in the frontend. |
| A4 | Task dependencies | REQUIRED | PASS | Adding works; a dependent task cannot start (400); circular and self dependency refused (400). |
| A5 | Project timeline | REQUIRED | MISSING | No timeline on the project page; no endpoint. |
| A6 | Task approval | REQUIRED | MISSING | Only the completion gate exists; no request, decision, designated approver or notification. |
| A7 | Audit log | OPTIONAL | MISSING | — |
| A8 | Gantt | OPTIONAL | MISSING | — |
| A9 | Document management | OPTIONAL | MISSING | — |

**Totals (44 application flows, §36–40 excluded):** PASS 12 · PARTIAL 22 · MISSING 10 (3 of the missing are optional).

## 3. What the test found that is not a gap

| # | Finding |
|---|---|
| F-1 | *(fixed 2026-10-09, see §7)* **An unknown API path returns `500 "An unexpected error occurred"`, not `404`.** Spring's "no resource" exception is caught by the catch-all handler. Seen on all 17 "missing" endpoints. Harmless to users but wrong, and it logs a stack trace for every typo. |
| F-2 | *(fixed 2026-10-09, see §7)* The UI says **"Done"** (Kanban column, Tasks group) and **"Review"** where the specification says **Completed** and **In Review** (the dashboard already says Completed). |
| F-3 | Project cards and the dashboard show *In Review* correctly as its own count (matches D-06). |

## 4. The differences, ranked by how much they matter for the demo

1. **Approval workflow** (A6/§15) — the headline Team Member → Team Leader step has only a gate behind it.
2. **Attachments** (§25) and **comment replies in the UI** (§24) — both are in the live demo script (§40 step 10).
3. **Named reports, KPIs, project statistics on the dashboard** (§5, §31, §32) — §40 steps 16–17.
4. **Deadline reminders and overdue notifications** (§27/§28) — §40 step 11.
5. **Role model alignment** (§3, §8, §11, A1): `USER` default, one Owner, Team Members cannot create tasks.
6. **Smaller gaps:** login by email, own position/department, project filters, Team Tasks, project timeline, checklists, auto-logout, notification text, UI labels.

## 5. Incident during the test (data I affected)

Two things went wrong in my own clean-up, both on test data I created. Both are repaired:

- **Cleaning up a test project with database triggers switched off left orphaned rows**: 20 tasks, 40 notifications and 29 activity-log entries whose project no longer existed, which made `GET /api/notifications` return 500 for some users. I deleted exactly those rows (all from my test run), scanned **every foreign key** in the database for further orphans (none), and from then on removed test projects only through the application or by disabling the single owner-integrity trigger.
- **Two older test notifications** ("Olivia Bennett invited you to join 'LIVE-CHECK pm project'", ids 198 and 199, to `dev.raj` and `dev.hana`) also broke the endpoint. Their deletion had been blocked earlier; you approved it afterwards and they are gone.

A backup of the database was taken before each migration (`pre-v9-backup.dump`, `pre-v10-deploy.dump` in the session's scratch folder).

## 6. Re-test after the role-model migration (same day)

After `V10` and the matching code (two-level roles, one owner, Team Member limits) the same script was run again, then the unit and end-to-end suites.

| § | Before | After | Why |
|---|---|---|---|
| 3 User & role management | PARTIAL | **PASS** | roles offered are `ADMINISTRATOR` / `PROJECT_MANAGER` / `USER`; a new account is `USER` |
| 11 Task management | PARTIAL | **PASS** | a Team Member's task creation is refused (`403`) |
| 12 Create/edit task | PARTIAL | **PASS** | same |
| A1 Registration | PARTIAL | **PASS** | the new account's role is `USER` |
| 8 Project team management | PARTIAL | PARTIAL | the second Owner is now refused (`400`), a single-owner project can be deleted; still no UI to change a member's role or transfer ownership |

**New totals (44 flows): PASS 16 · PARTIAL 18 · MISSING 10.** API script: 77 checks, 53 passed, 17 "missing" endpoints, 3 informational and 4 not passing: sign-in by email, a user's own position/department, the assignment notification text (all real gaps), and one check whose expectation was out of date (inviting an Owner is now refused with `400`, not `403`). Backend tests **130/130**; Playwright **43/43** (after fixing the six `project-team.spec.js` cases: a leftover invitation that an earlier run had already removed, and a stale CSS selector in one test). Test projects and the test account are removed; the owner deleting a single-owner project through the API works.

One finding from the verification itself: `verify_invariants.sql` query 3 returns three rows on the live database (tasks of PRJ-2001 assigned to `lead.owen`, who has no PRJ-2001 membership). It is already present in a backup from before any of today's work and is logged as I-21.

## 7. Re-test after change-plan batch 1 (2026-10-09)

After the seven quick fixes ([change-plan.md](change-plan.md) §3) and migration `V11`, deployed to the running stack, the affected flows were checked again: the API through a script against the live backend, the UI through the new Playwright spec `batch1.spec.js`, then the full suites.

| § | Before | After | Why |
|---|---|---|---|
| 1 Login & authentication | PARTIAL | **PASS** | signing in with the e-mail address works (any letter case) on the form and through the API; a wrong password by e-mail and an unknown e-mail both give `401 "Invalid username or password"` |
| 2 User profile | PARTIAL | **PASS** | the Profile page lists the managed positions and departments; saving stores them; an id outside the lists is `404`; no "+ Add New" is offered |
| 13 Task assignment | PARTIAL | **PASS** | the notification read `Olivia Bennett assigned you to "Batch1 live check" in "Website Redesign" — due 2026-12-22` |
| 23 Search, filter, sort | PARTIAL | **PASS** *(in the browser)* | projects filter by status, priority and manager and sort by name, dates, priority, progress; tasks filter by status, priority, assignee, due date and project and sort by latest, due date, priority, progress, status. They run over the lists the server already scoped to the caller. The list endpoints themselves still take no filter parameters (brief G-16) |
| 15 Task status | PARTIAL | PARTIAL | the labels are now Completed / In Review; there is still no approval record or Approved / Changes requested / Rejected |
| 19 Kanban | PARTIAL | PARTIAL | columns are To Do, In Progress, In Review, Completed (+ Blocked); cards are still not draggable (optional) |
| 5 Dashboard | PARTIAL | PARTIAL | the overview says In Review; project statistics, Delayed projects and KPIs are still missing |

Findings F-1 (unknown path = `500`) and F-2 (Done / Review labels) are fixed: an unknown path answers `404 "Resource not found"` (checked live, nothing in the backend log), and no screen says "Done" or "Doing".

**Also checked live:** a task created with status `TODO` is accepted and `TO_DO` is refused (`400`); a status change reads `"<task>" is now In Progress` / `… is now To Do` in the notification and the activity log; the 26 tasks and 77 subtasks that were `TO_DO` are `TODO` and no `updated_at` changed (compared with a hash of every value).

**New totals (44 flows): PASS 20 · PARTIAL 14 · MISSING 10.** Backend tests **143/143** (130 + 13 new); Playwright **57/57** (43 + 14 new); ESLint clean. Test data created by the check (one task, its notifications and activity) was removed. A `pg_dump` taken before `V11` is kept in the session's scratch folder (`taskmanager-before-V11.dump`).

## 8. Re-test after change-plan batch 2 (2026-10-09)

After the approval workflow ([change-plan.md](change-plan.md) §4) and migration `V12`, deployed to the running stack, the flow was played through the API as the Project Manager, a Team Leader and Team Members (`approvals.spec.js`, 7 API and 2 UI cases) and the suites were run again.

| § | Before | After | Why |
|---|---|---|---|
| 15 Task status | PARTIAL | **PASS** | a Team Member submits (`IN_PROGRESS` → `IN_REVIEW` + an open request); only an approver decides; Approved completes the task and moves the project's progress; Changes requested returns it to In Progress with the comment; Rejected needs a comment and a choice of In Progress or Cancelled; every decision is kept with who decided, when and why |
| A6 Task approval | MISSING | **PASS** | request, decision, designated approver (a Team Member cannot be named; only the named person, the Owner or an Administrator decides), no approving your own work except for the Owner and Administrators, activity entries and notifications for every request and decision |
| 26 Notifications | PARTIAL | PARTIAL | approval requested and decided are now produced; comment, project update, milestone update, deadline and member removed are not |
| 33 Activity log | PARTIAL | PARTIAL | approval events are recorded per task; there is still no project-level feed and no comment or file events |

**New totals (44 flows): PASS 22 · PARTIAL 13 · MISSING 9.** Backend tests **175/175** (143 + 32 new); Playwright **66/66** (57 + 9 new); ESLint clean. The test tasks were removed afterwards (no `E2E %` task, notification or activity row is left). `verify_invariants.sql` returns no rows, including the two new checks for approvals; query 3 (I-21) no longer returns the three `lead.owen` rows either.

## 9. Re-test after change-plan batch 3a (2026-10-09)

After the collaboration features ([change-plan.md](change-plan.md) §5, 3a) and migration `V13`, deployed to the running stack, the flows were played through the API (`collaboration.spec.js`, 7 API and 3 UI cases) and the suites were run again.

| § | Before | After | Why |
|---|---|---|---|
| 17 Subtask & checklist | PARTIAL | **PASS** | checklist items are added, ticked and deleted by the people the matrix allows (a Team Member ticks only on tasks assigned to them; the author or a Team Leader deletes); progress counts items with subtasks (one of two ticked = 50, with a done subtask 66.67, a completed task is 100) |
| 24 Comments & discussion | PARTIAL | **PASS** | *Reply* in the task panel; the reply is nested under its comment; a reply to a comment of another task is refused (`400`) |
| 25 File attachment | MISSING | **PASS** | upload to a task and to a project, list, download as an attachment, delete; a disallowed type, a disguised file, an empty file, a file over 10 MB and a missing or double target are refused; a Viewer reads but cannot upload; a stranger gets `404` |
| 33 Activity log | PARTIAL | **PASS** | the project feed lists project created / updated, milestone, task, comment, file and approval events, newest first, for members only |

**New totals (44 flows): PASS 26 · PARTIAL 10 · MISSING 8.** Backend tests **226/226** (175 + 51 new); Playwright **76/76** (66 + 10 new); ESLint clean. No test task, project or file is left behind. A fresh database built from `01-init.sql` and `02-seed.sql` has the same grants, columns, function and triggers as the migrated copy.

## 10. Re-test after change-plan batch 3b (2026-10-09)

After the manager views ([change-plan.md](change-plan.md) §5, 3b), deployed to the running stack, the flows were played through the API and the browser (`manager-views.spec.js`, 4 API and 6 UI cases) and the suites were run again (the Playwright suite twice).

| § | Before | After | Why |
|---|---|---|---|
| 5 Dashboard | PARTIAL | **PASS** | Total / Active / Completed / **Delayed** projects, Total / To Do / In Progress / In Review / Completed / Overdue tasks, average completion, recent activity and (for managers) the team workload, all from `GET /api/dashboard/stats` and friends; a project whose end date has passed shows as Delayed and leaves the group when it is completed; a person outside the project does not see it |
| 8 Project team management | PARTIAL | **PASS** | a role picker on the project page; making someone Owner asks for confirmation and moves ownership in one step; nobody changes their own role; a Team Leader only moves Team Members and Viewers |
| 22 Team Tasks | MISSING | **PASS** | members with their tasks, counts and progress, unassigned tasks, reassignment; `403` for a Team Member, `404` for a stranger |
| 30 Team workload | PARTIAL | **PASS** | assigned, active, overdue, estimated and actual hours per member, and overloaded / underloaded against the team average |
| A5 Project timeline | MISSING | **PASS** | project, milestone and task dates on one axis; a task opens in the panel, a milestone shows its details; open to every member |

**New totals (44 flows): PASS 31 · PARTIAL 7 · MISSING 6.** Backend tests **265/265** (226 + 39 new); Playwright **86/86** (76 + 10 new), twice in a row; ESLint clean. No test project or task is left behind.

Found and fixed on the way: the Playwright specs `projects.spec.js` and `time-tracking.spec.js` opened "the first project card", which is a different (possibly empty) project whenever another test has just created one, so they failed intermittently once a spec created projects in parallel; they now open *Website Redesign*.

## 11. Re-test after change-plan batch 3c (2026-10-09)

After the reports and KPIs ([change-plan.md](change-plan.md) §5, 3c), deployed to the running stack, the flows were played through the API as `admin.system`, `pm.olivia`, `lead.owen` (200) and `dev.chen` (403), and through the browser (`reports.spec.js`, 9 API and 4 UI cases); the suites were run again (the Playwright suite twice).

| § | Before | After | Why |
|---|---|---|---|
| 31 KPI | MISSING | **PASS** | the five rates from the approved formulas, calculated on the server for one project or all the caller's projects; checked against a project with known tasks (task completion 50.0, overdue 50.0, on-time 50.0, project completion 0.0); an empty denominator gives "—" |
| 32 Reports | PARTIAL | **PASS** | all seven named reports with their filters (project, assignee, status, priority, due dates, owner, group by, date range) and an explicit *Generate*; the endpoints refuse a Team Member with `403` and a stranger's project with `404` whatever the page shows. Export (PDF / Excel) is optional and still absent |

**New totals (44 flows): PASS 33 · PARTIAL 6 · MISSING 5.** Backend tests **290/290** (265 + 25 new); Playwright **99/99** (86 + 13 new), twice in a row; ESLint clean. No test project or task is left behind (four projects left by failed first runs of the new spec were found and deleted).
