# Workflow Conformance Test — 2026-10-08

The running application tested against [project-workflow.md](../project-workflow.md) and the approved specification ([assignment-brief.md](../assignment-brief.md) Part B). Sections 1–5 record the test **before any change** to the application, so the result could be trusted; section 6 records the re-test after the role-model migration (`V10`) done later the same day.

## 1. How it was tested

| Part | Method | Size |
|---|---|---|
| API | A script played each flow against the live backend as Administrator, Project Manager, Team Leader, Team Member and Viewer (`admin.system`, `pm.olivia`, `lead.owen`, `dev.chen`, `dev.raj`), using a throw-away project, tasks, milestone and a registered test account | 71 checks + 8 for registration and passwords |
| UI | Playwright visited every screen as the Project Manager and read what each shows; the uncertain results were confirmed from screenshots | 10 screens |
| Source | Search of the code for schedulers and inactivity logout | 3 searches |
| Existing suites | backend 113/113; Playwright 34 of 40 (the 6 known `project-team.spec.js` failures, see [testing.md](testing.md)) | — |

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
| F-1 | **An unknown API path returns `500 "An unexpected error occurred"`, not `404`.** Spring's "no resource" exception is caught by the catch-all handler. Seen on all 17 "missing" endpoints. Harmless to users but wrong, and it logs a stack trace for every typo. |
| F-2 | The UI says **"Done"** (Kanban column, Tasks group) and **"Review"** where the specification says **Completed** and **In Review** (the dashboard already says Completed). |
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

**New totals (44 flows): PASS 16 · PARTIAL 18 · MISSING 10.** API script: 77 checks, 53 passed, 17 "missing" endpoints, 3 informational and 4 not passing: sign-in by email, a user's own position/department, the assignment notification text (all real gaps), and one check whose expectation was out of date (inviting an Owner is now refused with `400`, not `403`). Backend tests **130/130**; Playwright **37 of 43** (the six known `project-team.spec.js` cases). Test projects and the test account are removed; the owner deleting a single-owner project through the API works.

One finding from the verification itself: `verify_invariants.sql` query 3 returns three rows on the live database (tasks of PRJ-2001 assigned to `lead.owen`, who has no PRJ-2001 membership). It is already present in a backup from before any of today's work and is logged as I-21.
