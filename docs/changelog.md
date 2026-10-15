# Change Log

Significant changes, newest first, reconstructed from the git history (86 commits, 2026-08-27 → 2026-10-10 at the time of the 2026-10-12 pass), the merged pull requests (#8 → #47), the migration files, and the existing READMEs. There are **no git tags or release numbers** (`pom.xml` is `0.0.1-SNAPSHOT`, `frontend/package.json` is `0.0.0`, `api/openapi.yaml` declares `0.2.0`), so entries are grouped by date and pull request.

Categories: **Added** · **Changed** · **Fixed** · **Database** · **Architecture** · **Build / CI / Docs**. Commit hashes are given so each entry can be inspected with `git show <hash>`. Entries summarise the commit message; extra detail comes from the cited README/migration text. Anything inferred rather than stated is marked *(inferred)*.

---

## 2026-10-15 (a completed project takes no new work; owner rights right after creating a project; the top priority colour)

**Docs (how they display on GitHub)**
- **README.** A *Documentation* table (where to read what) and a *Screenshots* section (dashboard, project page, Kanban board, calendar, in `docs/images/`, taken from the seeded demo data) at the top, a feature bullet for the completed-work rule (D-27), and a longer table of contents.
- **Rendering fixes found by an audit of every `.md` file** (anchors, table columns, links to files git would not publish): six table rows had more or fewer cells than their header, which GitHub shows cut off (`checklist/done.md` #59, #65, #67; `roadmap.md` refresh tokens and audit log; `api-reference.md` task-activity), one link pointed at a heading whose text had changed (`frontend.md` → `testing.md#41-frontend-unit-tests-196`), and `pages_docs/help.md` matched the `HELP.md` rule of `.gitignore` (Windows ignores case) so it would never have been committed: it is now `pages_docs/help-and-support.md`.

**Changed (dashboard cards)**
- **The six figure cards on the dashboard say more.** Each has an icon chip beside the number (tinted by meaning: info for Active, success for Completed, danger for Delayed while it is above zero) and one line of context from the same `GET /api/dashboard/stats` figures: how many projects are planning, on hold or cancelled; the share of all projects that are active or completed; "Past their end date" / "Nothing behind schedule"; a thin progress bar and "across N projects" for Average completion; and "N done · M overdue" for Total tasks. `StatCard` takes optional `icon`, `hint` and `progress` (the Reports page, which passes none, looks as before). `dashboard-cards.spec.js` (3) checks the figures against the server (reloading until the two agree, since other specs change the data), the icons and bar, and equal card height.

**Changed (project page layout)**
- **The pills in a project's Overview are one size.** The status, priority, Delayed, "Completed on" and overdue pills now share one class (`STATUS_ROW_BADGE_CLASS`): 28px high (36px under 640px, where only the status dropdown used to grow to 40px) with the same 5px gap between the dot or icon and the label. The Delayed badge had been 20px high and the read-only status pill had no gap at all. `DelayedBadge` uses the same 5px gap as `Badge`. `projects.spec.js` measures the row on a throw-away delayed project at both widths.
- **The project page no longer grows without limit.** The task list, Members, Milestones, Activity and Attachments each scroll inside their card (caps of about 440, 340, 340, 420 and 260px), with the header, filters, counts and add forms outside the scrolling part. For the seeded *Website Redesign* the page went from 3793px to 2212px tall. The lower cards are two columns in reading order (Members | Milestones, then Attachments | Activity) that stretch to the same height per row, so **Members and Milestones are always the same size**; they stack below 1024px, and a member row wraps on a phone so its role picker is not cut off. `projects.spec.js` checks that the task list scrolls and that the two cards are the same size.

**Added**
- **A `COMPLETED` project takes nothing new, and a `COMPLETED` task no new subtask, checklist item, comment, time entry, file or dependency (D-27).** The server answers `409` after the permission check (`ProjectWorkRules`, used by the task, milestone, subtask, checklist, comment, work-log and attachment services, and by the project switch of a task or milestone). The project page hides *Add Task*, the milestone form and the file upload and shows one notice; the task panel does the same for subtasks, checklist items, comments and replies, the timer and *Log time*, files and the "Depends on" picker (a timer already running on a task that has since been completed can only be discarded); *New Task* / *New Event* on the Tasks, Kanban and Calendar pages are hidden while only completed projects are in view, and the new-task form does not list a completed project (a task being edited may stay in its own). Existing work stays editable; changing the status reopens it. Cancelled and On Hold are not restricted. `permissions.spec.js` now opens a task that is not completed when it checks the subtask box.

**Fixed**
- **A Project Manager did not see *Add member* / *Edit* on a project they had just created until they reloaded.** The permission list is read at sign-in, so a new project was missing from it; `NewProjectModal` now reads it again after a create.

**Changed**
- **Edit Task and Edit Project open in the shared right-hand `SidePanel`**, like New Task and New Project, instead of a centred pop-up. `NewProjectModal` drops its own copy of the drawer and uses `SidePanel` for both modes (the project code is shown read-only on edit; the manager picker stays administrator-only); `TaskFormModal` renders its edit form in `SidePanel`. `calendar-details.spec.js` now expects a side panel.
- **The top priority (Urgent for tasks, Critical for projects) has its own colour**, a rose-crimson tint (`critical`, `critical-ink`, `critical-soft` tokens), instead of sharing High's red. `Badge` and the calendar chips and dots use it; `DESIGN.md` is updated.

**Tests:** backend 569 → **591** (`TaskServiceTest` +5, `SubtaskServiceTest` +5, `MilestoneServiceTest` +3, `ChecklistItemServiceTest` +3, `CommentServiceTest` +2, `WorkLogServiceTest` +1, `AttachmentServiceTest` +1, `TaskDependencyServiceTest` +2); frontend unit tests **196**; Playwright 291 → **308** (`completed-project.spec.js` 8, `edit-side-panels.spec.js` 2, `dashboard-cards.spec.js` 3, `projects.spec.js` +4). `permissions.spec.js` and `time-tracking.spec.js` now open a task that is not completed, all green on the live stack. **Docs:** `assignment-brief.md` (D-18, D-27), `tasks.md`, `testing.md`, `test-cases.md` (PRJ-13), `pages_docs/project-detail.md`, `DESIGN.md`, counts in `README.md`, `backend.md`, `frontend.md`, `checklist/done.md`.

## 2026-10-15 (documents removed)

**Docs only.** Six files that had nothing left to say were deleted: `checklist/not_done.md`, `checklist/partially_done.md` and `checklist/unclear.md` (all empty; the S-1 to S-8 fixes and the unbuilt optional document management, #42, moved to `checklist/done.md`), `change-plan.md` (every batch done; this log and the brief's G-table keep the history), `workflow-conformance.md` (a point-in-time test whose results all became PASS) and the root `Role_Requirment.md` (a short team-areas list; the requirements are in `assignment-brief.md`). Links to them in the other documents were removed or turned into plain text, and the index in `docs/README.md` was renumbered. Older entries below and the ADRs still name these files as they were at the time; the original long `Role_Requirment.md` is in the git history.

## 2026-10-15 (decisions D-19 to D-25 approved)

**Docs only.** The project owner approved the seven proposals D-19 (near deadline, Today, Upcoming), D-20 (auto-logout timing), D-21 (@mentions), D-22 (report export in the browser), D-23 (time logged on any task of the project), D-24 (sign-in lifetime and refresh cookie) and D-25 (optional paging), all as built, with no change to the rules or the code. `assignment-brief.md` (B13.2 and the notification table), `checklist/not_fully_satisfy.md` (R-2, R-4, R-5), `change-plan.md` and `roadmap.md` (item 3 closed) say so. No decision is open. Earlier entries below still call them proposals, as they were when written.

## 2026-10-15 (controller and repository tests, and a Flyway check in CI)

**Added**
- **Controller tests (standalone `MockMvc`, 45 tests).** The auth, task, dashboard, milestone, team, project and notification endpoints: which URL and parameters, which status, which JSON, the refresh cookie (`HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, `Secure` over HTTPS, never in the body), the limiter's key, every filter of `GET /api/tasks` reaching the query (checked by running the captured query over three tasks), wrong values as `400` before any service is asked, and the error JSON.
- **Repository query tests (`QueryRepositoriesTest`, 11 tests, `@DataJpaTest` on the real schema).** Each custom query is compared with the same question asked in plain SQL over the same rows, inside a rolled-back transaction, so the tests hold whatever the data is: the project task counts, the entity-graph loading, the subtask, checklist and hours groupings, the unfinished prerequisites, the visible and administered projects, the sole owner, the co-members, the invitable users, the user lookups, the project codes and the code lock. Both kinds were shown to fail when the code is broken on purpose, then restored.
- **CI step: every migration must be folded into the init scripts.** `database/check_migrations_folded.sh` runs `flyway migrate` against the database the CI job has just built from `database/init/`; Flyway must have nothing to apply. Checked locally in three cases (nothing pending: exit 0; a migration not in the init scripts: exit 1; no baseline: exit 1). An attempt to also catch an edited old migration did not work, because an init-built database has no checksum for V1 to the baseline, and the script says so.

**Changed:** a stale "version 14" in a `docker-compose.yml` comment now says 21. The docs' future-work lists drop what is now done (controller and repository tests, the Flyway check).

**Not done (still open):** a test through the security filter chain and `@PreAuthorize`, tests for the controllers not covered, Flyway in a production deployment, and a deploy target.

**Tests:** backend 513 → **569** (56 new), all also run against PostgreSQL 18 built the way the CI builds it, with the app role; frontend unit tests 196 and Playwright 291, unchanged. **Docs:** `testing.md`, `backend.md`, `database.md`, `issues.md` (F-83, F-84), `roadmap.md`, README.

## 2026-10-14 (the Kanban board reads each column) — checklist R-5 closed for the task lists

**Changed**
- **Each Kanban column is read from the server on its own, 25 cards at a time.** The board fetched every task and every assignment and sorted the cards into columns, searched and filtered, in the browser. Now every column asks `GET /api/tasks` for its own status, the Blocked column through the new **`blocked`** filter (`blocked=true` keeps only tasks waiting on an unfinished prerequisite, `blocked=false` the others, applied before the paging), under the board's search, priority and project filters. The column badge shows the column's real total, a *Show more (N more)* button reads the next 25, and a reload after a move reads as many pages as the column showed. Cards carry their `assigneeIds`. Dragging and the *Move to* menu are unchanged.
- **The board says when it is busy.** It is `aria-busy` until it shows the data for the current search, filters and reload (the search is sent a moment after typing). The Kanban specs wait for it: with server-side search a test could pick a card on the unfiltered board and have the filtered one land mid-drag, which showed up as a flaky drop (found with a probe, fixed, then 36 of 36 over three repeats).
- `getTasks`, `groupTasksByStatus` and its three tests were removed: nothing reads the whole task list any more.

**R-5 is closed for the task lists.** What still reads a whole collection: the task assignments (the task form, Team and the project pages) and the project members, two small relation tables, recorded under the known limitations. The README's future-work list drops the items that were already built (the refresh-token flow, the report export, the extra system roles).

**Tests:** backend 509 → **513** (`TaskServiceTest` +3, `TaskListQueryTest` +1); frontend unit tests **196** (3 added, 3 removed with the grouping helper); Playwright 286 → **291** (`kanban-server.spec.js` 5), the whole suite 291/291 on a freshly seeded second copy of the stack with the CI's settings. **Docs:** `checklist/not_fully_satisfy.md` (R-5, R-6, R-7), `checklist/done.md`, `assignment-brief.md` (D-25), `api-reference.md`, `backend.md`, `frontend.md`, `architecture.md`, `roadmap.md`, `issues.md` (F-82), `testing.md`, `test-cases.md` (TSK-25), README.

## 2026-10-14 (Reports Overview reads less) — checklist R-5, Reports Overview

**Changed**
- **The four stat cards, Task Completion and Team Productivity come from the server.** The Overview fetched every task and every assignment and counted in the browser, filtering by the chosen project there too. It now reads `GET /api/tasks/summary` (with `projectId` for a chosen project) for the counts and the new `completedByAssignee` (user id to completed tasks among those the filters leave) and `GET /api/dashboard/task-activity` (with the same `projectId`) for the chart. The page reads no task list and no assignment list.
- Three helpers that only this page used (`computePeriodTaskStats`, `computeWeeklyTaskStats`, `filterTasksByProject`) and their four tests were removed.
- `.env.example` lists the two optional registration-cleanup settings.

**Still reading every task:** the Kanban board alone (it groups the whole list into columns).

**Tests:** backend 506 → **509** (`TaskListQueryTest` +2, `TaskServiceTest` +1); frontend unit tests 200 → **196** (four removed with the helper they tested); Playwright 282 → **286** (`reports-overview-server.spec.js` 4), the whole suite 286/286 on a freshly seeded second copy of the stack with the CI's settings. **Docs:** `checklist/not_fully_satisfy.md` (R-5, R-6, R-7), `checklist/done.md`, `assignment-brief.md` (D-25), `api-reference.md`, `backend.md`, `frontend.md`, `roadmap.md`, `issues.md` (F-81), `testing.md`, `test-cases.md` (REP-09), README.

## 2026-10-14 (the Dashboard reads less) — checklist R-5, the Dashboard

**Changed**
- **The chart's daily figures come from the server.** New `GET /api/dashboard/task-activity` (`days` 1 to 366, the caller's time zone as `zone`, optional `projectId`) returns one row per day, oldest first, ending today: the tasks created and completed that day and the open tasks due before it, worked out in `util/TaskActivity` over what the caller may see. The browser used to work this out over every task. That makes **128 endpoints**.
- **"Due & Overdue" reads a page of seven tasks** (open, with a due date, earliest first: `GET /api/tasks` with `dueFrom`, `sort=dueDate`, `size=7`), each with its assignees, instead of every task and every assignment. Completing a task from the card refreshes the card, the counts and the chart.
- The Dashboard no longer fetches `GET /api/tasks` whole or `GET /api/task-assignees`. The same activity endpoint, with `projectId`, is what Reports Overview needs next.

**Still reading every task:** Kanban and Reports Overview.

**About the live database:** the live database had been edited by hand during testing (a registered account promoted to Project Manager, the Project Manager permission grid changed, a project created), so two role specs that assert on the seeded permissions failed against it. They pass on a freshly seeded database: the whole suite, **282/282**, was run on a second copy of the stack with the CI's settings (2 workers, no retries needed) and the copy removed afterwards. The live database was left as it was.

**Tests:** backend 497 → **506** (`TaskActivityTest` 5, `DashboardServiceTest` +4); frontend unit tests 194 → **200** (`stats.test.js` +3, `tasks.test.js` +1, `dashboard.test.js` 2); Playwright 276 → **282** (`dashboard-server.spec.js` 6). **Docs:** `checklist/not_fully_satisfy.md` (R-5, R-6, R-7), `checklist/done.md`, `assignment-brief.md` (D-25), `api-reference.md`, `backend.md`, `frontend.md`, `architecture.md`, `roadmap.md`, `issues.md` (F-80), `testing.md`, `test-cases.md` (DSH-10), README.

## 2026-10-14 (the cross-layer inconsistencies closed) — X-04, X-05, X-06

**Fixed**
- **X-05, CI on PostgreSQL 16 while everything else runs 18.** The backend job of `.github/workflows/ci.yml` now uses `postgres:18`. The CI's database steps (load the init files, invariants, app role, grants) and the backend tests were replayed on a throw-away PostgreSQL 18.6 with the CI's credentials: 24 seeded users, no invariant or grant output, 30 triggers like the live database, 497/497 tests. It has not run on GitHub itself.
- **X-06, the last stale comment in `01-init.sql`** (dependency ordering "enforced in application business logic, not here") now says the database enforces it. Comment only: the init script is applied once to an empty volume and has no checksum. The same sentence in the applied `V1` migration is left alone.

**Settled without a code change (X-04):** I first wrote a `V22` migration to add the task/subtask consistency objects, then built an empty database from the migrations alone to prove it, and found the chain **fails at `V13`** (it refers to a trigger function that only the init scripts create). A migrations-only build has never worked, `V22` would never have been reached and would have done nothing on the supported routes, so it was removed (and the one row it left in the live `flyway_schema_history` deleted; the live database is at version 21 and validates). The supported routes are unchanged and the limit is now written down in `issues.md` and `database.md`.

**Register:** no open defects and no open inconsistencies remain.

**Tests:** none added (comment, CI image and docs only). 497/497 backend (also against PostgreSQL 18 with the CI settings), 194/194 frontend unit tests, 276/276 end-to-end. **Docs:** `issues.md` (X-04 to X-06, D-09, the summary, known limitations), `database.md`, README.

## 2026-10-14 (the Low defects closed) — I-08, I-13, I-14, I-17, I-18, I-23

**Fixed**
- **I-23, `npm audit`:** `npm audit fix` raised `brace-expansion` to 5.0.12 and `source-map-js` to 1.2.2 (two patch bumps in the lockfile); 0 vulnerabilities, lint, unit tests and the build unchanged.
- **I-08, the code endpoints revealed which usernames exist.** `verify-otp` now gives one message for every failure (unknown name, already verified, no code, used, expired, too many attempts, wrong), and `resend-otp` answers `200` for an unknown or verified account. Registration still says a name is taken (accepted: a person signing up has to be told). The attempts left are no longer shown.
- **I-14, abandoned registrations kept their name for ever.** An hourly job (`PendingRegistrationScheduler` → `PendingRegistrationCleanup`) deletes a registration not verified within 24 hours (`PENDING_REGISTRATION_TTL_HOURS`, `PENDING_REGISTRATION_CLEANUP_CRON`, both passed through `docker-compose.yml`). Verified live with a 10-second schedule: a 25-hour-old account was deleted, a fresh one kept, no code rows left behind. Needs the backend image rebuilt.
- **I-13, pending invitations could not be listed or cancelled.** The project page lists them to managers (person, role offered, who invited them) with a *Cancel* button; cancelling deletes the row and the invitee's *Team invitation* notification.
- **I-17, the subtask auto-promotion told nobody.** It now notifies the assignees, the Owner and the Team Leaders (never the person who touched the subtask) like any other status change. Unassigning someone still notifies nobody; the specification does not ask for it.

**Closed without a code change (I-18):** a project may be marked Completed with unfinished tasks on purpose (the brief does not forbid closing early), the project-code race was already fixed (F-39), and `kpi_snapshots` is not used by any code. The three are listed under the known limitations.

**Register:** no open defects remain (I-01 to I-23 are all fixed or closed); the "Fixed" count is 79 (F-76 to F-79 added).

**Tests:** backend 481 → **497** (`OtpServiceTest` 4, `PendingRegistrationCleanupTest` 2, `SubtaskServiceTest` 3, `AuthServiceTest` +4, `ProjectMemberServiceTest` +2, `NotificationServiceTest` +1); Playwright 274 → **276** (`hardening.spec.js` +2); frontend unit tests 194, unchanged. All green: 497/497, 194/194, 276/276 at 4 workers; the user count is still 24. **Docs:** `issues.md` (I-08 to I-23, F-76 to F-79, known limitations), `api-reference.md`, `backend.md`, `security.md`, `authentication-authorization.md`, `users-and-projects.md`, `notifications.md`, `roadmap.md`, `setup.md`, ADRs 0003, 0007 and 0013, `testing.md`, `test-cases.md` (REG-06, REG-07, PRJ-12, NTF-10), `frontend.md`, README.

## 2026-10-14 (the Calendar and the project cards read less) — checklist R-5, Calendar and Projects

**Changed**
- **The Calendar reads only the days on screen.** It used to fetch every task and every milestone and pick the month out in the browser. `GET /api/tasks` and `GET /api/milestones` now take `dueFrom` / `dueTo` (both days included, undated items left out, a bad date or a backwards range is `400`), and the Calendar asks for the six-week month grid, the Monday-to-Sunday week or the day, and reads a new window when you move on. A task opened from a milestone's linked tasks (now read by milestone), or one an edit moved out of the window, is read by id.
- **The project cards read their counts.** New `GET /api/tasks/project-stats` (one grouped query; cancelled tasks left out, overdue means past due and still open) replaces fetching every task to count them per project. That makes **127 endpoints**.
- **The task panel's dependency picker reads only its own project's tasks** instead of every task, which every screen that opens a task panel was doing.

**Corrected record:** the earlier R-5 lists named the Gantt chart and the project pages as whole-list readers. They read one project's tasks. The screens that still read every task are the Dashboard, Kanban and Reports Overview; the whole assignment list is still read by the task form, Dashboard, Kanban, Reports, Team and the project pages.

**Tests:** backend 474 → **481** (`TaskListQueryTest` +3, `TaskServiceTest` +2, `MilestoneServiceTest` +2); frontend unit tests 178 → **194** (`calendarRange.test.js` 8, `tasks.test.js` +3, `milestones.test.js` 3, `relations.test.js` 2); Playwright 268 → **274** (`calendar-projects-server.spec.js` 5, `tasks-server-list.spec.js` +1). All green: 481/481, 194/194, 274/274 at 4 workers; the user count is still 24. **Docs:** `checklist/not_fully_satisfy.md` (R-5, R-6, R-7), `checklist/done.md`, `assignment-brief.md` (D-25), `api-reference.md`, `backend.md`, `frontend.md`, `roadmap.md`, `issues.md` (F-75), `testing.md`, `test-cases.md` (MIL-06, PRJ-11), README.

## 2026-10-14 (three Medium issues closed, and the register tidied) — I-09, I-11, I-12

**Fixed**
- **I-09, the sign-in lockout was not per client behind nginx.** Reproduced first: after one client was locked on a name, a second client at another address was locked too, because the backend saw only the proxy's address. `frontend/nginx.conf` now sends `X-Forwarded-For: $remote_addr` (a header from the client is replaced, not extended) and `application.properties` sets `server.forward-headers-strategy=native`, so `getRemoteAddr()` is the real client (Tomcat trusts the header from a private-network proxy only). Verified live: the locked client stays locked even with a spoofed header, another client is not locked. Needs the frontend image rebuilt.
- **I-11, raw database text in error answers.** New `DatabaseMessages` turns a CHECK, UNIQUE, foreign-key or NOT NULL violation into a plain sentence (`The task due date cannot be before its start date.`, `That username is already taken.`, a general sentence for the rest); a trigger's own sentence still passes through. The status stays `400`.
- **I-12, an invitation vanished for someone with task notifications off.** The invitation notification is now created whatever the switch says, since it is the only place to accept or decline.

**Register and docs.** I-20 (no required feature is missing) and I-21 (the live-data rows are gone; all 15 invariant queries return nothing) are closed; three planned-list entries that were already built (refresh tokens, PDF / Excel export, the administrator audit view) are struck. Open defects: 11 → 6 (I-08, I-13, I-14, I-17, I-18, I-23); the "Fixed" count said 67 when 69 rows were recorded and is now 74. `api-reference.md`, `security.md`, `authentication-authorization.md`, `backend.md`, `notifications.md`, `users-and-projects.md`, `roadmap.md` and ADRs 0003, 0005, 0007 and 0010 no longer describe the three as open.

**Tests:** backend 463 → **474** (`DatabaseMessagesTest` 9, `GlobalExceptionHandlerTest` +1, `NotificationServiceTest` +1); Playwright 265 → **268** (`hardening.spec.js` 3); frontend unit tests 178, unchanged. 474/474, 178/178 and 268/268 at 4 workers; the user count is still 24 after the run.

## 2026-10-14 (the Tasks page reads from the server) — checklist R-5, the Tasks page

**Changed**
- **The Tasks page loads 50 tasks at a time.** It used to fetch every task and every assignment and then search, filter, sort, group and count the quick views in the browser. It now asks `GET /api/tasks` for a page (with `groupBy=project`, so the tasks of a project stay together, finished projects last, and the chosen sort orders each project) and a *Show more (N more)* button reads the next page; the search (after a short pause), the filters, the quick view and the sort are all applied by the server. The project and status groups look as before; they are built from the pages loaded so far.
- **Quick-view counts and the assignee choices come from the server.** New `GET /api/tasks/summary` answers `{ viewCounts, assignees }` over the same search and filters (the view itself is ignored, so every count shows).
- **A task carries its assignees.** `TaskResponse` has `assigneeIds`, filled from one batched query, so the page no longer needs `GET /api/task-assignees`.

**Added (API)**
- On `GET /api/tasks`: `view` (`all`, `today`, `upcoming`, `inprogress`, `completed`, `overdue`), `unassigned=true`, `groupBy=project`, sort by `title`, and a repeated `assigneeId` (the task must be assigned to all of them: *My Tasks* together with a chosen person). A bad `view` or `groupBy` is `400`. That makes **126 endpoints**.
- The open task panel is read by id as well, so it stays open when an edit moves the task out of the current filter, and it opens a task from *Awaiting your approval* that is on a page not loaded yet.

**Not changed (R-5 stays open in part):** the Dashboard, Kanban, Calendar, Gantt, Projects and Reports Overview still read every task, as do the task panel's dependency picker and the task form's assignee list.

**Tests:** backend 453 → **463** (`TaskListQueryTest` +7, `TaskServiceTest` +3); frontend unit tests 174 → **178** (`tasks.test.js` +4); Playwright 257 → **265** (`tasks-server-list.spec.js` 8; `batch1.spec.js` waits for the server's list in the assignee case). All green: 463/463, 178/178, 265/265 at 4 workers; checked against the live stack. **Docs:** `checklist/not_fully_satisfy.md` (R-5, R-6, R-7), `checklist/done.md`, `assignment-brief.md` (D-25), `api-reference.md`, `backend.md`, `frontend.md`, `roadmap.md`, `issues.md` (F-70, F-71), `testing.md`, `test-cases.md` (TSK-22, TSK-23), README.

## 2026-10-14 (registration spec cleans up after itself) — tests only

`registration.spec.js` registers real accounts through the form and never removed them, so every run of the suite left a verified `new.*` account on the Team page and unverified `pending.*` and `wrong.*` accounts in the database (3 per run). The spec now records each username it registers and deletes it through the API in `afterEach` (as administrator; the seeded `admin.system`, which the "name already taken" test types in, is skipped). Verified: the spec alone leaves the user count unchanged, and a full run (257/257, 4 workers) ends with the same 24 users it started with.

## 2026-10-14 (project pages on a phone) — front end only

At 390 px wide a project page was wider than the screen (6 px for most projects, up to 58 px for one with a long name), so it scrolled sideways. Two causes, both fixed: the **role picker in the team list** is a native select that is as wide as its widest option, *Owner (transfer ownership)*, and it no longer shrinks below that, so it now has `min-w-0` and a 9 rem ceiling on a phone; and the **header's title wrapper** (`TopBar`) could not shrink, so a long project name never reached its ellipsis, and it now has `min-w-0` on every page.

**Tests:** Playwright 256 → **257** (`phone-project-page.spec.js`: every project page at 390 px has no sideways scroll); 257/257 in a clean run. **Docs:** `testing.md`, `test-cases.md` (ERR-08), `issues.md` (F-69) and the counts in `README.md`, `frontend.md`, `workflow-conformance.md` and the checklist files.

---

## 2026-10-14 (Reports period box) — front end only

The *This Week* box in the Reports header was smaller than the other header controls. It was the Dashboard's chart dropdown (30px tall, 5px radius, 12px text) while *Filter*, the bell and the theme button are 40px. It is now a standard secondary button (40px, 8px radius, 13.5px text), so every control in the header is the same size. The menu it opens and its options are unchanged; the Dashboard's own dropdown is unchanged.

**Tests:** the header layout case of `reports.spec.js` also checks that the period button is the same height as *Filter* and the bell; Playwright stays at 256 (256/256 in a clean run), unit tests 174/174. **Docs:** `DESIGN.md` (Known Drift, Reports page layout), `issues.md` (F-68).

---

## 2026-10-14 (a sticky page header) — front end only

The page header now stays at the top while a page scrolls, on every page. It is one change in the shared `TopBar` (every page renders it as its first element) plus a scroll-padding rule: `position: sticky; top: 0; z-index: 30` on the Canvas background (so the content does not show through, in either theme), reaching up into the content box's top padding so the spacing above the title is the same stuck or not, and 16px of padding plus 12px of margin under it (the same 28px as before). It sits above the page content and below the sidebar (z-40), its mobile scrim, side panels and dialogs, so dropdowns and overlays still open above or below it correctly. No ancestor sets an overflow, and the app's other sticky elements are horizontal only, so nothing interferes.

A header that wraps onto several rows would pin a large part of a phone (200-276 px of 844), so **only its first row stays pinned**: as the page scrolls, the rows below it are clipped away one pixel per pixel scrolled, the page shows through where they were, and the clipped part takes no clicks; the header keeps its size, so nothing moves, and the whole header is back at the top of the page. The pinned part is 117 px on a desktop, 105 px on a tablet and 88-115 px on a phone. `html { scroll-padding-top: 8rem }` keeps a focused or scrolled-to element out from under it.

**Checked:** 19 page views (every screen and a project's four tabs) at 1440, 820 and 390 px in light and dark: the header at the top with its title uncovered, its background equal to the canvas, the clipped part passing clicks through, the notification and filter dropdowns, a side panel and the mobile menu above the pinned header, and no page with a sideways scroll. **Tests:** Playwright 238 → **256** (`sticky-header.spec.js` 18, stable over three runs); 256/256 in a clean run. **Docs:** `DESIGN.md` (a Layout rule and a Known Drift entry), `frontend.md`, `README.md`, `testing.md`, `test-cases.md` (ERR-07), `workflow-conformance.md` (§35), `issues.md` (F-67) and the counts in `docs/README.md` and `docs/checklist/*`.

## 2026-10-14 (detail on the calendar) — front end only

The calendar could only add a task: a click anywhere on a day opened *New Task*, and the task and milestone chips did nothing. Now a day opens **one drawer in two parts** on the right:
- **The day** (left): what is due that day (the milestones, then the tasks) with **New task on this day** under it for anyone who may create tasks. Anyone who can see the calendar can open a day; the add button is hidden from those who cannot create tasks.
- **The detail** (right, once an item is chosen in the list): **the task panel** (the same panel as on Tasks and Kanban, edit and delete included; `TaskDetailPanel` gained an `embedded` mode for this) or **a milestone panel** (`MilestoneDetailPanel`, read-only: status, due date, the project as a link, progress worked out from the linked tasks, the description and the linked tasks, each of which opens in the same place). The list stays in view while another item is chosen; the X of the detail closes only the detail, the X of the list closes the drawer, and Escape closes the drawer unless a field has the focus.
- A **chip in the grid** opens the drawer on its day with that item chosen; the day number is a button named with the date and the count, and on a phone a tap on a day shows what its dots stand for. Below about 1000 px one part is shown at a time (the detail replaces the list and its X brings it back).
- The header's *New Event* is unchanged.

**Tests:** Playwright 229 → **238** (`calendar-details.spec.js` 9); the existing calendar cases pass unchanged; 238/238 in a clean run. **Docs:** `DESIGN.md`, `frontend.md`, `project-workflow.md` (flow 20), the brief's feature table, `testing.md`, `test-cases.md` (MIL-05), `workflow-conformance.md` (§34), `issues.md` (F-66) and the counts in `README.md`, `docs/README.md` and `docs/checklist/*`.

## 2026-10-14 (one name for a project role) — front end only

The same two project roles had two names: Roles & Permissions showed *Admin* and *Member*, the pickers and badges elsewhere showed *Team Leader* and *Team Member*. They now share one name from a single helper (`projectRoleLabel`): **Owner**, **Admin (Team Leader)**, **Member (Team Member)**, **Viewer**. It is used by the role picker of every member on the project page, the role badges, the *Add member* panel (project page and Team page), the Team page's invite picker, the Team Tasks tab, Roles & Permissions and the *Project role* column of the project report (screen and Excel / PDF), and a role change now reads *X is now Admin (Team Leader)*. Roles & Permissions uses it too (the role list, the heading of the selected role, the checkbox labels) and keeps its note that maps Admin to Team Leader and Member to Team Member. Display labels only: the stored values, the permissions, the authorization and the API are unchanged (and the server's own messages keep their wording).

**Tests:** frontend unit tests 172 → **174** (`projectRoleLabel`); Playwright 226 → **229** (`role-labels.spec.js` 3); `invite-role.spec.js`, `manager-views.spec.js` and the report export unit test read the new labels; 229/229 in a clean run. **Docs:** `DESIGN.md`, `users-and-projects.md`, `authentication-authorization.md`, the role tables of the brief and the workflow, `testing.md`, `test-cases.md` (MEM-12), `workflow-conformance.md` (§33), `issues.md` (F-65) and the counts in `README.md`, `docs/README.md` and `docs/checklist/*`.

## 2026-10-14 (Add Member on the Team page, and a combo box) — front end only

**Added**
- **A combo box** (`components/ui/Combobox.jsx`): a searchable select with the ARIA combobox pattern: type to search, arrow keys and Enter to choose, Escape closes only the list, and only a listed item can be chosen.
- **"Add Member" on the Team page** (next to *Add User*), shown to anyone who manages at least one project: choose a project, then the person, then the role, and send the invitation. The person box stays disabled until a project is chosen.

**Changed**
- The project page's *Add member* panel picks the person from the same combo box instead of a text box with a browser datalist. The list is the server's answer (each row shows an avatar, the full name and *username · position*), so an inactive account, an existing member or a pending invitee is never offered and a mistyped username can no longer be sent. The invitation is unchanged: the person still accepts or declines. The success message names the person (*Invitation sent to Hana Suzuki*).
- The Help answer *How do I add someone to my project?* describes both buttons.

**Tests:** Playwright 223 → **226** (`add-member.spec.js` 3); `project-team.spec.js` and `invite-role.spec.js` pick the person from the combo box, and the case about an inactive account now checks that it is never offered; 226/226 in a clean run. **Docs:** `DESIGN.md` (Combo box), `frontend.md`, `users-and-projects.md`, `testing.md`, `test-cases.md` (MEM-11), `workflow-conformance.md` (§32), `issues.md` (F-64) and the counts in `README.md`, `docs/README.md` and `docs/checklist/*`.

## 2026-10-14 (the Team page button is *Add User*) — front end only

On the Team page an administrator's *Invite Member* does not invite anyone: it creates an account directly (`POST /api/users`) with a temporary password the administrator shares. It was named like the project's *Add member* (which invites an existing user and waits for a reply) and its button, panel title and submit button disagreed (*Invite Member*, *Invite Member*, *Add Member*). The button, the panel title and the submit button now all read **Add User**, in line with Administration → Users. *Create account* was not used because that is the wording of a person registering themselves (Login and Register). The Help answer *How do I add a brand-new person?* uses the new name. The component keeps its file name (`AddMemberModal.jsx`).

**Tests:** `side-panels.spec.js` (the Team-page case) and the Help text; 223/223 in the last full run, the affected specs (`side-panels`, `team`, `user-management`, `help-errors`, `project-team`) re-run after the rename. **Docs:** every mention of the old name outside older history.

## 2026-10-14 (forms in the side panel) — front end only

*Add member* (project page), *Add User* (Team page) and *New Task* now open in the shared right-hand `SidePanel`, the frame the task panel and the role form already use (the first two were centred pop-ups; *New Task* was a hand-written copy of the drawer without Escape handling or a dialog role). Same fields, validation and API calls. The "Add New Position / Department" dialogs opened from the invite panel are rendered beside the panel so they still centre on the screen. *Edit Task* stays a centred modal because it opens over the task panel, and *New Project* keeps its own drawer copy.

**Tests:** Playwright 219 → **223** (`side-panels.spec.js`: the three panels at the right edge, Escape and the discard check, the centred nested dialog, a phone); the two Add member cases of `project-team.spec.js` find the panel by role instead of the old pop-up's CSS class; 223/223 in a clean run. **Docs:** `DESIGN.md`, `architecture.md`, `users-and-projects.md`, `testing.md`, `test-cases.md` (TSK-21, MEM-10), `workflow-conformance.md` (§31), `issues.md` (F-63) and the counts in `README.md`, `docs/README.md`, `frontend.md` and `docs/checklist/*`.

## 2026-10-14 (Reports page layout) — front end only

The Reports page now follows the other screens. The tab strip is the Tasks quick-view pill (card fill and border, charcoal when selected) in one row that scrolls sideways on a phone (it wrapped into four rows); the Overview's Filter and period controls are page-header actions like those of Tasks, Projects and Kanban (the Overview draws its own header and receives the tab strip; the other tabs use the plain header); spacing is the dashboard's (16px between stat cards, 24px between sections, the standard card padding); and the four Overview charts sit in two independent columns instead of a stretched grid. Nothing the page calculates, shows or exports changed.

**Tests:** Playwright 217 → **219** (`reports.spec.js`: the layout at 1440 px and the one-row tabs at 390 px); 219/219 in a clean run. **Docs:** `DESIGN.md` (Known Drift), `frontend.md`, `testing.md`, `test-cases.md` (REP-08), `workflow-conformance.md` (§30), `issues.md` (F-62) and the counts in `README.md`, `docs/README.md` and `docs/checklist/*`.

## 2026-10-14 (dashboard layout pass) — front end only

Layout only; nothing the dashboard shows, calculates or is allowed to show changed. The right-hand column is now project health (Delayed projects, then the project previews) followed by Team workload; the wider left column holds Task Overview, Due & Overdue and Recent activity; the Task activity chart spans both columns. The two columns end within about 130px of each other at 1440px (before the pass the right was about 300px longer). The dashboard's project previews are compact (no description, badges in one row, tighter padding) and the workload card is a list of people (name, assigned / active / overdue, the Load pill) that fits 380px with full names. Tablet (640–1200px): one column with the two project previews side by side; phone: one column in reading order. The workload list scrolls inside its card (at most 400px, keyboard-focusable, the footnote below it) so a long team does not lengthen the page. `ProjectCard` and `WorkloadTable` gained an optional `compact` prop (off by default, so the Projects page and the table on the project and Reports pages are unchanged). Measured at 1440, 1280, 1100, 820 and 390px: no page scroll, nothing scrolls inside a card.

**Tests:** Playwright 215 → **217** (`dashboard-polish.spec.js`: the right-hand column order, the full-width chart, one-card-wide previews, the scrolling workload list); 217/217 in a clean run. **Docs:** `DESIGN.md`, `frontend.md`, `testing.md`, `test-cases.md` (DSH-08), `workflow-conformance.md` (§29), `issues.md` (F-61), the counts in `README.md`, `docs/README.md` and `docs/checklist/*`.

## 2026-10-14 (a review of the brief and the workflow against the code) — migration `V21`

Two differences between the specification and the application were found by reading `assignment-brief.md` and `project-workflow.md` against the code, and closed. Backend, front end and database were redeployed (the `migrate` service applied `V21`) and checked in the running stack.

**Added**
- **A task dependency joins tasks of one project (G-20, I-15).** `TaskDependencyService` refuses a task of another project (`400`; `404` when the caller cannot see that project) and the trigger `trg_task_dependencies_same_project` (`V21`, mirrored in `01-init.sql`, baseline 21) keeps it true in the database; `verify_invariants.sql` has a 15th query. No existing row crossed projects.
- **A warning toast.** `Toast.jsx` has a fourth tone, `warning`; completing a milestone with linked tasks still open raises it after the success toast (D-08).
- **The created and start dates.** The project page shows *Created*; the task panel shows *Start date* and *Created*.

**Changed**
- **A status change tells the right people (G-21, I-17).** `UpdateNotificationService.notifyTaskStatusChanged` replaces `NotificationService.notifyTaskStatusChanged`: the task's assignees, Owner and Team Leaders are told and the person who made the change is not.

**Dashboard polish (front end only; F-60):** the cards sit in two independent columns (no empty hole beside a short card; Delayed projects first on the right), the overdue count is a danger-tint pill that opens Tasks, the chart card is *Task activity* with a y axis, a failed load shows a message with *Try again* instead of looking like an empty list, and on a phone the workload card keeps Overdue and Load in view and task titles wrap. Details in `DESIGN.md` (Known Drift).

**Fixed (tests only):** the projects case of `paging.spec.js` and the sign-out case of `session.spec.js` each failed once under parallel load because they read a count or a cookie too early; both now wait for the state they check.

**Docs:** the brief (audit-log row of the data model, the duplicate `D-18` — the calendar row is now `D-26`, G-20 and G-21, B1.8, B9, D-10), the workflow (the dashboard step, who may delete attachments and time entries, A4), `database.md` (30 triggers, `V21`, 15 invariants, baseline 21), `setup.md`, `tasks.md`, `notifications.md`, `api-reference.md`, `testing.md` (172 in the unit-test heading, 452 + 1 backend tests), `test-cases.md` (PRJ-10, TSK-19, TSK-20, NTF-08), `overview.md`, `roadmap.md`, `workflow-conformance.md` (§27), `issues.md` (F-56 to F-59, D-13, I-15, I-17), `frontend.md`, `DESIGN.md`, `architecture.md`, ADR-0005, `README.md`, `docs/README.md` and `docs/checklist/*`.

**Tests:** backend 447 → **453** (`TaskDependencyServiceTest` 4, `UpdateNotificationServiceTest` +2); Playwright 208 → **215** (`dependencies-and-notices.spec.js` 2, `dashboard-polish.spec.js` 4; `quick-wins.spec.js` +1 case and an extended one); frontend unit tests 172, unchanged; ESLint clean. 215/215 in a clean run at 4 workers.

## 2026-10-14 (a full documentation sync)

Documentation only: no code, migration or test changed. Every documented number and name was recomputed from the code and compared with the text, as the documentation rules ask.

**Checked and found in step:** the API reference against the 26 controllers (125 endpoints, in both directions); every per-class backend test count (38 classes, 447 tests) and every per-file Vitest count (11 files, 172 tests) in `testing.md`; the tables, views, triggers and functions of the live database against `database.md`, and every column of every table; the permission matrix in `authentication-authorization.md` against `role_permissions` (198 grants, 98 for the Administrator); the seeded dataset (24 users, 10 projects, 98 tasks, task statuses, 51 comments, 23 replies, 73 subtasks, 358 time entries); the frontend routes against `App.jsx`; every environment variable, framework and image version; every file and class name the documents mention.

**Corrected** (also recorded as issue D-12): the structure listings (26 controllers, 24 entities, 19 pages, `SessionExpiredException`, `PageParams`, `Mentions`, the frontend helpers `reportFormat`, `useReportableProjects`, `layoutContextStore`, `useLayout`, `auditLog`); a paragraph for `refresh_tokens` in `database.md`; the seed's notification count (118 in the file; the start-up deadline job can add more); two per-spec Playwright counts that cancelled out (`smoke.spec.js` 14, `audit-log.spec.js` 7); four upload settings missing from the environment tables; the two checklist counts missing from `TaskResponse`; the figures about the legacy `openapi.yaml` (68 endpoints missing, 39 of 60 DTOs without a schema); "export is not built"; ADR-0005's trigger count; the roadmap's comments and login rows; `security.md` on how a session ends; the README feature list, design decisions and security list, `PRODUCT.md` and `overview.md` for the refresh-cookie session, search, filter, sort and paging, and the editable, feed-writing time logs; the dates of the checklist files and of `overview.md`, `roadmap.md` and `testing.md`.

## 2026-10-14 (optional paging, and a repair of the docs) — checklist R-5 partly closed

**Added**
- **Optional paging on three lists (R-5, D-25).** `GET /api/projects`, `GET /api/tasks` and `GET /api/notifications` take `page` (from 0) and `size` (1 to 200, default 50 when only `page` is sent) and then answer `{ items, total, page, size }`; without them they answer the whole list, so nothing that already works changes. The search, filter and sort run first and only over what the caller may see; without a sort the order is by id so that pages are stable; for tasks only the requested page is built into responses; a bad value is `400`.
- **The notification bell loads 20 at a time.** *Show more (N older)* loads the next page (up to 200 shown, newer arrivals are not repeated) and the unread dot comes from `GET /api/notifications/unread-count`, so it also counts unread notifications that are not loaded.

**Not changed (and why R-5 stays open in part):** the Dashboard, Tasks, Kanban, Calendar, Gantt, Projects and Reports Overview pages still read every task, because they group, chart or count the whole list; paging it would break them. They need server-side aggregation, which is a different piece of work.

**Docs repaired.** Re-running my own edit scripts had repeated some inserted lines (the same "still says No pagination" bullet six times in `api-reference.md`, and the search / filter / sort rows of `test-cases.md` and `testing.md` up to six times), and a too-loose "already there?" check had silently skipped a few rows I meant to add: the `PUT /api/work-logs/{id}` row, the `/api/auth/refresh` and `/logout` rows and the two session test classes. The duplicates are removed, the missing rows are in, and the four new session test cases are numbered AUTH-12 to AUTH-15 (AUTH-10 and AUTH-11 already existed).

**Tests:** backend 438 → **447** (`PageParamsTest` 4, `ProjectServiceTest` +2, `TaskServiceTest` +2, `NotificationServiceTest` +1); Playwright 204 → **208** (`paging.spec.js`); the full suites passed (447/447, 172/172, 208/208 twice in a row); ESLint clean.

**Docs:** `checklist/not_fully_satisfy.md` (R-5, R-6, R-7), `assignment-brief.md` (B7 item 6, D-25), `api-reference.md`, `architecture.md`, `backend.md`, `notifications.md`, `frontend.md`, `roadmap.md`, `issues.md` (F-55), `testing.md`, `test-cases.md` (PRJ-09, TSK-18, NTF-08), `workflow-conformance.md` (section 26), README.

## 2026-10-14 (the sign-in session: refresh tokens) — migration `V20`; checklist R-4 closed

Backend, front end and database redeployed (a `pg_dump` taken first) and verified there. The brief records the design as decision **D-24** (a proposal awaiting approval, like D-19 to D-23).

**Changed**
- **The access token is a 15-minute JWT (was 1 hour) and is kept in the browser's memory only.** `localStorage` (`taskflow.auth`) now holds just the username and role, so a script on the page can no longer read a stored credential.
- **A refresh token keeps the person signed in.** Sign-in sets the cookie `taskflow_refresh` (random 256-bit value, `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, 7 days; `Secure` when `REFRESH_COOKIE_SECURE=true`). `POST /api/auth/refresh` trades it for a new access token after checking the account is still `ACTIVE`. The browser does this after a reload and when a request is answered `401` (once, shared between requests that run out together, then the request is repeated), so there is no abrupt logout; only a refresh that fails signs the person out. The token is not rotated on use, so two tabs cannot invalidate each other.
- **Signing out ends the session on the server.** `POST /api/auth/logout` deletes the refresh token and clears the cookie (the idle auto-logout does the same). A changed password and an administrator's reset delete every refresh token of the account; a suspended or deactivated account is refused at refresh.
- The endpoint count is now **125** (`/refresh`, `/logout`); `JWT_EXPIRATION_MS` defaults to `900000`, and `REFRESH_EXPIRATION_MS` and `REFRESH_COOKIE_SECURE` are new (passed through `docker-compose.yml`, listed in `.env.example`).

**Database**
- `V20__refresh_tokens.sql`: table `refresh_tokens` (only the SHA-256 hash is stored; removed with the account) and its grant to the application role; idempotent (run twice). Same end state in `01-init.sql`, the grant in `03-app-role.sh` (`verify_grants.sql` checks it); `04-flyway-baseline.sql` records version 20.

**Tests:** backend 421 → **438** (`RefreshTokenServiceTest` 8, `AuthServiceTest` 5, `UserServiceTest` +4); frontend unit tests 166 → **172** (`client.test.js`); Playwright 198 → **204** (`session.spec.js`); the full suites passed (438/438, 172/172, 204/204 twice in a row); ESLint clean.

**Docs:** `checklist/not_fully_satisfy.md` (R-4, R-6, R-7), `assignment-brief.md` (session line, D-24), ADR-0001, `api-reference.md`, `architecture.md`, `authentication-authorization.md`, `backend.md`, `frontend.md`, `security.md`, `database.md`, `setup.md`, `roadmap.md`, `issues.md` (F-54), `testing.md`, `test-cases.md` (AUTH-12 … AUTH-15), `workflow-conformance.md` (section 25), README, `.env.example`.

## 2026-10-14 (database grants checked by CI) — checklist R-3 closed

Build / CI and database scripts only; no application code, migration or test changed.

**Changed**
- **CI runs the real `03-app-role.sh`** to create the application role, instead of a copy of its grant list pasted into `ci.yml` (the copy had drifted once). The role CI tests with is now the role the application uses, and the grants live in one place.
- **New `database/verify_grants.sql`**, run by CI right after the role is created: it prints every table the role cannot read and must print nothing. Three tables are on its own list of tables that deliberately have no entity (`flyway_schema_history`, `kpi_snapshots`, `report_exports`), so leaving a table ungranted is a decision. Before this a forgotten `GRANT` only showed up as a `500` at run time (as it did for `work_logs`).

**Checked:** the query is empty on the live database; on a throw-away database built from `01-init.sql` and the real script it is empty, and with a table added without a grant it names that table. The script also ran cleanly against that database and the live backend kept working. The GitHub workflow itself was not run (no push), only its commands.

**Docs:** `checklist/not_fully_satisfy.md` (R-3), `adr/0011`, `security.md`, `database.md` (section 7), `testing.md`, `test-cases.md` (DB-04), `setup.md`, `overview.md` (tree), `roadmap.md`, `issues.md` (X-05, F-53), README.

## 2026-10-14 (who may log time: decision D-23) — checklist R-2 closed as by design

Documentation only; no code, migration or test changed.

**Changed**
- **R-2 ("any member can log time on any task, not only its assignees") is not a defect.** The approved matrix (B3.4) gives *create work log* to Owner, Team Leader and Team Member with no "assigned" condition, while the rows just below it add "assigned" for status and progress; Part A says only that members' time is recorded. Limiting time entries to assignees would add a restriction the matrix does not contain and would stop pair work and reviews being recorded. The behaviour is therefore kept and written down as decision **D-23**, a proposal awaiting the project owner's approval like D-19 to D-22. The check is unchanged: `WorkLogService.createWorkLog` needs `WORK_LOG:CREATE` in the project and a Viewer is refused.

**Docs:** `assignment-brief.md` (D-23), `checklist/not_fully_satisfy.md` (R-2), `checklist/done.md` (#48), `tasks.md`, `issues.md` (F-50), this file.

## 2026-10-14 (Add member with a role, and a work-date time-zone fix) — checklist #14 closed

**Changed**
- **The project page's *Add member* dialog** always invited a Team Member, although the API takes a role. It now has a *Role in this project* picker (Team Member by default, Team Leader, Viewer; never Owner: ownership is transferred, not invited), with a line saying who the person will become once they accept. Front end only.

**Fixed**
- **Logging time just after midnight was refused for people east of the server.** The browser sends its own calendar date, which is already tomorrow by the server's clock (UTC in the Compose stack) for the first hours of the day there, so `POST /api/work-logs` (and the new change endpoint) answered `400 "Work date cannot be in the future"`. The server now accepts a work date up to one day ahead of its own; two days ahead is still refused. Found when `time-tracking.spec.js` began failing at 00:01 local time on code nobody had touched.

**Tests:** backend 420 → **421** (`WorkLogServiceTest` +1); Playwright 197 → **198** (`invite-role.spec.js`); the full suites passed (421/421; 198/198 twice in a row); ESLint clean. Two cross-spec races were seen once each in full runs and passed on rerun: `permissions.spec.js` (memberships compared with a project list fetched a moment later) and `audit-log.spec.js` (two page requests while another spec wrote an audit entry); neither was changed.

**Docs:** `checklist/not_fully_satisfy.md` (#14, R-6, R-7), `checklist/done.md` (#17, #65), `adr/0003`, `roadmap.md`, `users-and-projects.md`, `api-reference.md`, `tasks.md`, `testing.md`, `test-cases.md` (MEM-09, TIM-04), `workflow-conformance.md` (section 24), `issues.md` (F-51, F-52), README.

## 2026-10-13 (time logs: change an entry, activity feed) — migration `V19`; checklist #9 and #15 closed

Backend, front end and database redeployed (a `pg_dump` taken first) and verified there.

**Added**
- **Changing a time entry.** `PUT /api/work-logs/{id}` (the endpoint count is now 123) lets the author change the time, date and note. Only the author may: not an administrator and not a manager, because an entry is the author's own statement; an author who can no longer log time (a Viewer) may not either; the entry stays on its task and cannot be dated in the future. In the task panel the author's own rows have a pencil that opens the entry as a small form (*Save* / *Cancel*, the same checks as the log form).
- **Time logs in the activity feed.** Logging, changing and deleting an entry write `WORK_LOGGED`, `WORK_LOG_UPDATED` (with the old and new values, and nothing at all when nothing changed) and `WORK_LOG_DELETED` (naming the author when a manager deletes someone else's entry) to the task's feed, so they show in the project's Activity card and the dashboard's recent activity as well. They send no notification.

**Database**
- `V19__work_log_activity.sql`: `activity_logs_action_check` also allows the three actions; idempotent (run twice). Same end state in `01-init.sql` (a fresh build checked); `04-flyway-baseline.sql` records version 19.

**Not changed:** who may log time on a task (checklist R-2), which the 2026-10-14 pass recorded as decision D-23: the matrix lets any member log their own time.

**Tests:** backend 413 → **420** (`WorkLogServiceTest` 7 → 14); Playwright 195 → **197** (`time-log-edit.spec.js`: the author's change and the three feed entries in the browser, and the refusals through the API); the full suites passed once after the change (420/420, 197/197); ESLint clean.

**Docs:** `checklist/not_fully_satisfy.md` (#9, #15, R-2, R-6, R-7), `checklist/done.md` (#48, #65), `assignment-brief.md` (status table), `api-reference.md` (§13b, counts), `database.md` and `setup.md` (`V19`, baseline 19), `tasks.md`, `backend.md`, `authentication-authorization.md`, `overview.md`, `roadmap.md`, `testing.md`, `test-cases.md` (TIM-05 … TIM-07), `workflow-conformance.md` (section 23), `issues.md` (F-50), README.

## 2026-10-13 (Reports workload chart) — checklist "not fully satisfy" #6 closed

Front end only: no backend, migration or endpoint change. Front end redeployed and verified live.

**Changed**
- **The Reports *Overview* "Workload" chart** counted assigned tasks per person only. It now shows each member's assigned, active and overdue tasks as three bars, with the estimated and actual hours and the load level (overloaded, balanced, underloaded) in the tooltip. The figures come from the server (`GET /api/workload`, or `/api/projects/{id}/workload` once a project is chosen in the page's filter), the same as the workload page and the dashboard card, so every screen shows the same numbers. The card is shown only to people who may assign tasks, as those endpoints require; the other three charts are unchanged.

**Tests:** Playwright 194 → **195** (`reports.spec.js`: a manager sees a project's workload chart with the same figures as the Workload report); the full suite passed once at 4 workers (195/195); ESLint clean.

**Docs:** `checklist/not_fully_satisfy.md` (#6, R-6, R-7), `checklist/done.md` (#49, #65), `assignment-brief.md` (B-status line), `frontend.md`, `database.md`, `change-plan.md`, `roadmap.md`, `testing.md`, `test-cases.md` (REP-07), `workflow-conformance.md` (section 22), `issues.md` (F-49), README.

## 2026-10-13 (server-side search, filter and sort) — checklist G-16 closed

The last specification-alignment gap. Backend only: no migration, no endpoint added, no screen changed. Backend redeployed and verified live.

**Added**
- **Search, filter and sort parameters on the two lists (G-16, B7 item 2).** `GET /api/projects` takes `search`, `status` (also the calculated `DELAYED`), `priority`, `managerId` and `sort` (`name`, `startDate`, `endDate`, `priority`, `progress`); `GET /api/tasks` takes `search`, `status`, `priority`, `assigneeId`, `projectId`, `due` (`overdue`, `today`, `week`, `none`) and `sort` (`latest`, `dueDate`, `priority`, `progress`, `status`). `status` and `priority` accept several values; different parameters combine with AND. `ProjectListQuery` and `TaskListQuery` (`util/`) run after the permission scoping, over what the caller may already see, so a search never finds a project or task the caller cannot open. An unknown status, priority, due or sort is `400`. A request without parameters returns what it did before, so the screens, which still filter in the browser, are unchanged.

**Tests:** backend 397 → **413** (`ProjectListQueryTest` 7, `TaskListQueryTest` 7, `ProjectServiceTest` +1, `TaskServiceTest` +1); checked against the live stack as the Administrator and as a member of two of the ten projects.

**Docs:** `assignment-brief.md` (B1.9, G-16, B13.1 note; the old pointer "B11 criterion 2" now reads B7 item 2 and B12 criterion 19), `api-reference.md` (sections 2, 6, 9 and 18), `testing.md`, `test-cases.md` (PRJ-08, TSK-17), `workflow-conformance.md` (section 21), `roadmap.md`, `backend.md`, `overview.md`, `change-plan.md`, `tasks.md`, `users-and-projects.md`, `issues.md` (F-48), checklist, README. Pagination is still undefined and not built.

## 2026-10-13 (@mentions and report export) — migration `V18`; checklist G-14 closed

The last two optional features of the specification (G-14). Decisions D-21 and D-22 in the brief are proposals, not yet approved. Backend, front end and database redeployed (a `pg_dump` taken first) and verified there.

**Added**
- **@mentions in comments (D-21).** `@username` in a comment, or in an edit of one, mentions a person. Only an **active member of the task's project** with an active account counts, in comments only; the author is never notified. A mentioned person gets a `MENTION` notification ("You were mentioned") **instead of** the generic new-comment one for that comment, and an edit tells only the people it newly mentions. `CommentResponse.mentions` lists who is mentioned. The rules are in `util/Mentions.java` (an e-mail address is not a mention, trailing punctuation is peeled, `@dev.chenx` is never read as `dev.chen`); `CommentService` resolves them against the project's members and `UpdateNotificationService.notifyMentioned` sends the notices. In the task panel, typing `@` in the comment box (also when replying or editing) lists the project's members (`MentionInput`, arrow keys + Enter/Tab, Escape), and a comment shows its mentions highlighted (`CommentText`, built from text nodes, never HTML).
- **Report export (D-22).** Every report and the KPIs have *Excel* and *PDF* buttons once generated. The files are made in the browser from the report on the screen (`components/reports/reportExport.js`), so there is no endpoint, no stored file and no new permission; the `report_exports` table stays unused. New front-end dependencies: `write-excel-file` 4.1, `jspdf` 4.2, `jspdf-autotable` 5.0 (no audit findings of their own); they are separate chunks loaded the first time a file is asked for, so the main bundle is not larger. The PDF uses a standard Latin font, so a character outside it may not print.

**Changed**
- `permissions.spec.js` suspends a throw-away account instead of the seeded `newuser`. Adding two specs shifted the parallel schedule so that `project-team.spec.js` could not find `newuser` in about half of the full runs (F-47, R-6).

**Database**
- `V18__mention_notification.sql`: `notifications_type_check` also allows `MENTION`; idempotent (run twice). Same end state in `01-init.sql`; `04-flyway-baseline.sql` records version 18.

**Tests:** backend 381 → **397** (`MentionsTest` 9, `CommentServiceTest` +4, `UpdateNotificationServiceTest` +3); frontend unit tests 142 → **166** (`mentions.test.js` 12, `reportExport.test.js` 12); Playwright 182 → **194** (`mentions.spec.js` 3, `report-export.spec.js` 9); four full runs in a row at 4 workers; no server error in the log apart from browsers closing connections; ESLint clean.

**Docs:** `assignment-brief.md` (G-14 resolved, D-21, D-22, the feature table, the data model, B8, B9), `checklist/*` (G-14 moved to resolved, #41, #45, #54, #65, #67, R-6, R-7, R-10), `notifications.md` (12 types, §1, §2, §9), `database.md` and `setup.md` (`V18`, baseline 18), `backend.md`, `api-reference.md` (§13), `tasks.md`, `frontend.md`, `testing.md`, `test-cases.md` (141 cases), `overview.md`, `PRODUCT.md`, `roadmap.md`, `change-plan.md`, `issues.md` (F-47), `workflow-conformance.md`, ADR-0007, `README.md`

---

## 2026-10-13 (demo seed) — `02-seed.sql` rebuilt; no schema change

**Changed**
- **`database/init/02-seed.sql` is a new, coherent demo dataset** instead of random fixtures with boilerplate titles. Same 24 accounts and the same teams, roles, project codes and edge cases (the e2e suite and the documentation rely on them: `PRJ-2001`/`PRJ-2009` disjoint, Olivia a Viewer of `PRJ-2008` and on neither `PRJ-2002` nor `PRJ-2005`, the inactive, suspended and brand-new accounts, a pending invitation to `PRJ-2001`, no extra role). What is new: 98 hand-written tasks across the ten projects with real titles and descriptions, **31 milestones** (the old seed had none), **27 dependencies**, subtasks, **checklists, threaded comments, 358 time entries, approvals (open and decided, some sent back for changes), six small files, a project lead on every project with a Team Leader, an administrator audit log**, and the matching activity feed and notifications in the application's own wording. Dated from `CURRENT_DATE`: one project is delayed (`PRJ-2003`, six days), nine tasks are overdue, some fall due today and this week, one project is on hold, one is still planning and one is completed.
- Deterministic (no `random()`); generated by a script kept outside the repository and checked against every trigger rule before it was written. `database/init/` was verified on a brand-new database (all 14 invariants clean).
- **`04-flyway-baseline.sql` now records version 17** (it still said 14 although `01-init.sql` has held the end state of `V15`, `V16` and `V17` since those batches; the migrations are idempotent so a fresh volume only replayed them harmlessly).

**Database:** the running database was reset to the new seed (backup taken first); your other projects' volumes were not touched.

**Tests:** backend **381/381**; Playwright **182/182** three runs in a row against the new seed with no spec changed; the database invariants 14/14.

**Docs:** `database.md` (§6 seed, baseline 17, 14 invariants), `setup.md`, `notifications.md`, `PRODUCT.md`, `issues.md` (F-46)

---

## 2026-10-13 (Kanban integrity) — migration `V17`; no checklist item

Checking the Kanban moves against every rule that applies to a task and a project, as asked, found holes that the task panel had too. Backend, front end and database redeployed (a `pg_dump` taken first) and verified there.

**Database**
- `V17__task_status_integrity.sql`: `trg_tasks_prerequisite_not_reopened` (a task cannot leave `COMPLETED` while a task that depends on it is `IN_PROGRESS`, `IN_REVIEW` or `COMPLETED`), and the progress rule in `trg_fn_tasks_progress_derived_from_subtasks` (entering `COMPLETED` = 100, leaving it = 0 when no subtasks or checklist items derive it) with a backfill. Idempotent (run twice); same end state in `01-init.sql`; new invariant 14. Both triggers exercised directly in PostgreSQL.

**Changed**
- `TaskService`: refuses to take a prerequisite out of Completed under a started dependant (message names them) and applies the progress rule, so the panel, the circle, the board and the API behave the same (D-18, F-45).
- Kanban: every move reads the task again and checks the rules against it (`moveTaskToStatus`), so an old card cannot overwrite a newer edit and a task moved by someone else is left alone; the order of the stages is kept (no jump from To Do to review or Completed); one move at a time per card; the Move menu stays while a card saves and follows its button when the board scrolls.

**Fixed**
- `GET /api/tasks`, `/task-assignees` and `/project-members` could return `500` when a project was deleted while the list was being built (each project, user and task was a separate lazy load). They now load what the response needs in the same statement (entity graphs). This was the cause of the unexplained flakes in the full e2e suite.

**Tests:** backend 374 → **381** (`TaskServiceTest` +7); frontend unit tests 135 → **142** (`tasks.test.js` +7); Playwright 176 → **182** (`kanban-integrity.spec.js` 6, plus `kanban-helpers.js`); five full runs in a row at 4 workers and 25 runs of the Kanban specs without a failure; no server error in the log apart from browsers closing connections; ESLint clean.

**Docs:** `assignment-brief.md` (D-18), `database.md` (trigger, `V17`, 29 triggers, 14 invariants), `tasks.md`, `workflow-conformance.md` (§20), `checklist/*`, `testing.md`, `test-cases.md` (TSK-13 … TSK-16), `frontend.md`, `issues.md` (F-45), `README.md`, `docs/README.md`, `backend.md`

---

## 2026-10-13 (Kanban moves) — Checklist #35 closed; front end only

Last row of checklist/partially_done.md (1 → 0). Front end redeployed to the running stack and verified there.

**Added**
- **Drag and drop on the Kanban board** (HTML5, no new dependency): the dragged card dims, the column under it lights up (blue when the drop is accepted, a dashed red edge when it is not), and a refused drop shows the reason and leaves the card.
- **Move to menu** on each card (`KanbanMoveMenu`): the keyboard and touch way; the four columns, the current one marked, a refused one disabled with its reason. Drawn in a portal at a fixed position because the column scrolls and would clip it.
- `checkTaskMove` in `api/tasks.js`: the same rules the server applies, checked first — someone who may change the task (an editor or an assignee), Blocked is not a drop target, a blocked task cannot start (it names what blocks it), Completed needs an approver and every subtask done (everyone else is pointed to In Review). A move is the task panel's own `setTaskStatus`, so the approval workflow and the dependency gate apply on the server. A card the person cannot move has no handle and no menu.

**Tests:** frontend unit tests 128 → **135** (`tasks.test.js` +7); Playwright 170 → **176** (`kanban-moves.spec.js` 6); three full runs in a row at 4 workers; ESLint clean. Backend unchanged (374).

**Docs:** `checklist/*` (#35 moved to done; nothing is partly done any more), `assignment-brief.md` (G-14), `workflow-conformance.md` (§20, flow 19), `tasks.md`, `frontend.md`, `overview.md`, `roadmap.md`, `PRODUCT.md`, `change-plan.md`, `testing.md`, `test-cases.md` (TSK-10 … TSK-12), `issues.md` (F-44), `README.md`, `docs/README.md`

---

## 2026-10-13 (Roles & Permissions look) — no schema change, no checklist item

**Changed** (front end only)
- *New role* and *Edit role* now open in a **right-hand side panel** (`SidePanel`, the frame of the task panel) instead of a centred dialog: header with the close button, scrolling body, footer with Cancel and Create; closing with typed text asks *Discard changes?* (also on Escape and a click on the scrim). `RoleFormModal` became `RoleFormPanel`.
- The permission grid's checkboxes are a new `Checkbox` primitive: a rounded square that fills with the Charcoal accent and shows a check mark when ticked, with hover, focus and disabled states and a 24px click target, in light and dark (checked in screenshots of both). Read-only cells keep their ✓ / – marks.

**Tests:** Playwright 169 → **170** (`custom-roles.spec.js` +1: the panel is docked right, Escape and the discard prompt); three full runs in a row at 4 workers; ESLint clean. Backend unchanged (374).

**Docs:** `DESIGN.md` (side panel, checkbox), `frontend.md`, `README.md`, `testing.md`, `test-cases.md`, `checklist/done.md`, `checklist/not_fully_satisfy.md`

---

## 2026-10-13 (audit log) — Checklist #44 closed; migration `V16`

Seventh batch from checklist/partially_done.md (2 rows → 1). Backend, front end and database redeployed to the running stack (a `pg_dump` was taken first) and verified there.

**Database**
- `V16__audit_log.sql`: table `audit_logs` (no foreign keys; indexes on `created_at`, `action`, `project_id`), the trigger `trg_audit_logs_append_only` (refuses `UPDATE` and `DELETE`), and `SELECT, INSERT` for `taskmanager_app`. Idempotent (run twice); same end state in `01-init.sql`; the grant added to `03-app-role.sh` and `ci.yml`. Checked in PostgreSQL: the owner cannot update or delete an entry, the application role cannot update, delete or truncate.

**Added**
- `AuditLogService`, `GET /api/audit-logs` (Administrator: search, action / target / date filters, paging, size cap 100) and `GET /api/audit-logs/project/{id}` (Administrator, or the project's Owner for the ownership transfers) — 122 endpoints, 26 controllers.
- Entries for: system role changed, role permissions changed (full list before and after), project role changed, ownership transferred, account created / activated / suspended or deactivated / deleted, project deleted, extra role created / renamed / deleted; written in the action's own transaction, nothing for a save that changes nothing.
- *Administration → Audit log* (`/admin/audit`, `AuditLog.jsx`, guarded by `RequireAdministrator`, sidebar link for the Administrator only).

**Tests:** backend 354 → **374** (`AuditLogServiceTest` 7, plus 13 audit cases in `UserRoleServiceTest`, `RoleServiceTest`, `RolePermissionServiceTest`, `ProjectMemberServiceTest`, `ProjectServiceTest`); frontend unit tests **128**; Playwright 161 → **169** (`audit-log.spec.js` 8, and the audit screen added to `smoke.spec.js`); four full runs in a row at 4 workers; ESLint clean.

**Docs:** `checklist/*` (#44 moved to done), `assignment-brief.md` (B10, G-14, D-11), `workflow-conformance.md` (§19, A7), `database.md` (table, trigger, `V16`, 25 tables, 28 triggers, grants), `api-reference.md` (§14b, 122 endpoints), `testing.md`, `test-cases.md` (ROLE-15 … ROLE-18), `frontend.md`, `architecture.md`, `backend.md`, `overview.md`, `security.md`, `roadmap.md`, `authentication-authorization.md`, `issues.md` (F-43), `README.md`, `docs/README.md`

---

## 2026-10-13 (project lead) — Checklist #18 closed; migration `V15`

Sixth batch from checklist/partially_done.md (3 rows → 2). Backend, front end and database redeployed to the running stack (a `pg_dump` was taken first) and verified there.

**Database**
- `V15__project_lead.sql`: `projects.lead_id` (FK `users`, `SET NULL`), `trg_projects_lead_is_team_leader` (the lead must be an active Team Leader of the project) and `trg_project_members_clear_lead` (cleared when that member is demoted, set aside or removed), and `PROJECT_LEAD_CHANGED` in the `activity_logs.action` check. Idempotent (run twice); same end state in `01-init.sql`; new invariant 13 in `verify_invariants.sql`.

**Added**
- `PUT /api/projects/{id}/lead` (`PROJECT:ASSIGN`: the Owner or an Administrator) and `lead` on `ProjectResponse` (120 endpoints). The project page has *Make lead* / *Remove as lead* beside each Team Leader, a Lead field and a Lead badge; the header and the project card name the lead. The change is logged as `PROJECT_LEAD_CHANGED`.

**Changed**
- `ProjectMemberService` and `ProjectOwnership` clear the lead when that Team Leader is demoted, removed or made the Owner (F-42).

**Fixed**
- A race between two Playwright specs: `manager-views.spec.js` made `dev.chen` a Team Leader while `reports.spec.js` expected him to be refused every report, so the full suite failed twice in a row once the new spec shifted the timing. The first now promotes `dev.raj`.

**Tests:** backend 345 → **354** (`ProjectServiceTest` +5, `ProjectMemberServiceTest` +4); frontend unit tests **128**; Playwright 154 → **161** (`project-lead.spec.js`, 7); ESLint clean.

**Docs:** `checklist/*` (#18 moved to done), `assignment-brief.md` (D-09), `database.md` (column, two triggers, `V15`, 27 triggers, 13 invariants), `api-reference.md` (120 endpoints), `users-and-projects.md`, `authentication-authorization.md`, `testing.md`, `test-cases.md` (MEM-07, MEM-08), `frontend.md`, `backend.md`, `overview.md`, `issues.md` (F-42), `README.md`, `docs/README.md`

---

## 2026-10-13 (extra system roles) — Checklist #7b and G-06 closed; no schema change

Fifth batch from checklist/partially_done.md (4 rows → 3). Backend and front end redeployed to the running stack and verified there.

**Added**
- **Extra system roles (D-14).** *Administration → Roles & Permissions* has a *New role* button (`RoleFormModal`), and an extra role has Edit (rename) and Delete (with a confirmation) beside its permission grid. A new role is a system role with no project role and no grants; the permissions are ticked on the grid afterwards.

**Changed**
- `RoleService` now stores the name in upper case (`Quality auditor` → `QUALITY_AUDITOR`, 2 to 50 letters, digits, spaces or hyphens, starting with a letter), answers `409` for a name in use (any letter case) instead of a raw database message, refuses to delete a role that accounts hold (`409`), and reloads the permission cache after a create, rename or delete. A built-in role still keeps its name and cannot be deleted.
- `RolePermissionService` accepts a system-wide grant only on projects, reports, users, roles and positions/departments (before, the API accepted one on any resource, which would have let a system role override a project role, D-02), and refuses *create projects* for an extra role: the creator of a project becomes its owner and only a Project Manager or an Administrator can own one (D-04). The grid disables that box for an extra role. F-41.

**Tests:** backend 331 → **345** (`RoleServiceTest` 11 new, `RolePermissionServiceTest` +3); frontend unit tests **128**; Playwright 149 → **154** (`custom-roles.spec.js`, 5); ESLint clean.

**Docs:** `checklist/*` (#7b and G-06 moved to done), `assignment-brief.md` (G-06), `workflow-conformance.md` (§18), `testing.md`, `test-cases.md` (ROLE-12 … ROLE-14), `api-reference.md`, `authentication-authorization.md`, `frontend.md`, `DESIGN.md`, `roadmap.md`, `issues.md` (F-41), `README.md`, `docs/README.md`, `backend.md`

---

## 2026-10-13 (user management) — Checklist #7 and #59 closed; no schema change

Fourth batch from checklist/partially_done.md (6 rows → 4). Backend and front end redeployed to the running stack and verified there.

**Added**
- **Edit and delete users** in *Administration → Users*: an Edit dialog (`EditUserModal`: name, username, e-mail, gender, date of birth, phone, position, department, account status, optional new password) and a Delete button with a confirmation, shown only to holders of `USER:EDIT` / `USER:DELETE`. Delete is hidden on your own row and your own status is locked.

**Fixed**
- The server let the **last Administrator be deactivated or deleted** and let an account **delete itself**. `UserService.updateUser` now refuses to deactivate the last Administrator; `deleteUser(id, actingUsername)` refuses the last Administrator and your own account (`400`, F-40).

**Tests:** backend 328 → **331** (`UserRoleServiceTest` +3); frontend unit tests **128**; Playwright 145 → **149** (`user-management.spec.js`, 4); ESLint clean.

**Docs:** `checklist/*` (#7 and #59 moved to done), `testing.md`, `test-cases.md` (ROLE-09 … ROLE-11), `users-and-projects.md`, `authentication-authorization.md`, `architecture.md`, `frontend.md`, `backend.md`, `roadmap.md`, `issues.md` (F-40), `README.md`, `docs/README.md`

---

## 2026-10-12 (testing and CI) — Checklist #65 and #67 closed; no schema change

Third batch from checklist/partially_done.md (8 rows → 6). Backend redeployed to the running stack and verified there.

**Fixed**
- **Two simultaneous project creations could pick the same `PRJ-####`** and one failed with a `409 Project code already exists` the user never caused. Found while chasing an unexplained e2e flake (R-6) and reproduced (2 of 8 parallel `POST /api/projects` failed). `ProjectRepository.lockProjectCodeGeneration` takes a transaction-scoped PostgreSQL advisory lock before `ProjectService.generateProjectCode` reads the codes in use, so creates take turns; 30 of 30 parallel creates succeeded afterwards. A code the user chose is still checked by the pre-check and the unique constraint. Issue F-39.

**Added**
- **Front-end unit tests.** Vitest 4.1 (`npm test`, Node environment, no browser) with 128 tests in 9 files next to the code: durations, the password policy, permission checks, formatting and dates on a fixed clock, the task status moves, statistics, the API client (token, `ApiError`, `401`, network and non-JSON failures), the auto-logout storage and report formatting. Run in CI.
- **Three Playwright specs** (126 → 145 tests): `registration.spec.js` (5; the verification code is read from Mailpit, `E2E_MAILPIT_URL`), `smoke.spec.js` (13; every screen and every project view opens with no script error, `5xx` or error page) and `core-workflow.spec.js` (1; project → team → milestone → task → approval → completed project, checked on the project page).
- **`docs/test-cases.md`**: 115 test cases with steps, expected result and the test that proves each, plus the cases that are still manual.

**Build / CI**
- `ci.yml`: the `frontend` job now runs `npm test`; a new `e2e` job (after `frontend` and `backend`) makes `backend/logs` writable for the container's unprivileged user, runs `docker compose up -d --build --wait` on the clean runner, installs Chromium, runs the Playwright suite and uploads the report and prints the service logs on failure. `playwright.config.js`: 2 workers and an HTML report in CI.
- Validated by running the same steps on a second copy of the stack (Compose override with other ports and container names, project name `ci-sim`, CORS set for the new port): this exposed that a fresh Linux checkout leaves `backend/logs` unwritable for the container (the backend never became healthy), now handled by the `chmod` step and noted in `setup.md`. The full suite passed on that fresh database: 145/145 with CI's settings and no retry. The job has not yet run on GitHub.

**Checked, not changed**
- `npm audit` reports 2 high-severity advisories in build-time packages (`brace-expansion`, `source-map-js`). They were in the committed lockfile before Vitest was added; recorded as I-23, `npm audit fix` not run.

**Tests:** backend 326 → **328** (`ProjectServiceTest` +2); frontend unit tests 0 → **128**; Playwright 126 → **145**; ESLint clean.

**Docs:** `testing.md` (counts, CI, the unit-test table, gaps), new `test-cases.md`, `README.md`, `docs/README.md`, `setup.md` (unit tests, Mailpit variable, Linux log-folder troubleshooting), `frontend.md`, `backend.md`, `users-and-projects.md`, `overview.md`, `security.md`, `roadmap.md`, `issues.md` (F-39, I-23), `workflow-conformance.md` (§17), checklist (`done.md` 61 → 63, `partially_done.md` 8 → 6, R-6, R-7).

---

## 2026-10-12 (auto-logout and notifications) — Checklist #8 and #45 closed; no schema change

Second batch from checklist/partially_done.md (10 rows → 8). Deployed to the running stack and verified there.

**Added**
- **Auto-logout.** `auth/IdleLogout.jsx`, mounted in `AppLayout` (so never on the public pages): after 15 minutes without mouse, keyboard, wheel, scroll or touch activity, in this or any other tab (the last activity is shared through `localStorage`), a *Still there?* dialog counts down 60 seconds with *Stay signed in* and *Sign out now*. While it shows only its own button counts. When the minute runs out the session is cleared, the app goes to `/login` and the page says "You were signed out because there was no activity for a while". Limits in `auth/idleTimeout.js`; proposal D-20 in the brief. Browser-side only: the token stays valid on the server until it expires.
- **Comment, project and milestone notifications.** `UpdateNotificationService`, called by `CommentService`, `ProjectService` and `MilestoneService` after the change is saved: a comment or reply tells the task's assignees, the project's Owner and Team Leaders and, for a reply, the parent comment's author; a project edit or completion tells the assignees of the project's tasks and the leaders; a milestone edit or completion tells the assignees of its linked tasks and the leaders. Never the person who acted, each person once, people with notifications off and non-`ACTIVE` accounts skipped, nothing for a save that changed nothing, creating a project or a milestone, and messages cut to 500 characters. All 11 allowed notification types are now produced. `TextFormat.shorten` is the shared one-line cut. The recipients implement proposal D-10 for these three types.

**Tests:** backend 308 → **326** (`UpdateNotificationServiceTest` 9 cases, plus 9 in `CommentServiceTest` (+2), `ProjectServiceTest` (+3) and `MilestoneServiceTest` (+4), which also take the new dependency); Playwright 115 → **126** (`idle-and-updates.spec.js`: 5 auto-logout cases with Playwright's fake clock, 6 notification cases in one throw-away project); 126/126 twice with `--workers=4`; ESLint clean.

**Docs:** `notifications.md` (all 11 types, new §9), `authentication-authorization.md`, `security.md`, `frontend.md`, `backend.md`, `architecture.md`, `DESIGN.md`, `README.md`, `overview.md`, `PRODUCT.md`, `roadmap.md`, `issues.md` (F-38), `testing.md`, `tasks.md`, `api-reference.md`, `change-plan.md`, ADR-0007, `workflow-conformance.md` (§16; Notifications and Session now PASS), `assignment-brief.md` (D-10 implemented, D-20), checklist (`done.md` 59 → 61, `partially_done.md` 10 → 8).

---

## 2026-10-12 (quick wins) — Six partly-done checklist rows closed; migration V14

First batch from checklist/partially_done.md (17 rows → 10): #34, #37, #31, #30b and the project completion date (#23, #60, #69). Deployed to the running stack; the live database was backed up first (`pg_dump`), `V14` applied by the Compose `migrate` service and verified.

**Added**
- **Project completion date.** `projects.completed_at` (`V14`) with the trigger `trg_projects_completed_at`: stamped when the status becomes Completed, kept while a completed project is edited, cleared when it is reopened. Projects that were already Completed (one on the development data) got their last update time, with the user triggers off so `updated_at` did not move. `Project` reads it as a database-generated column (`@Generated`), `ProjectService` flushes after saving so the same `PUT` returns it, and `ProjectResponse.completedAt`, the report `ProjectRow.completedAt`, a *Completed on <date>* chip on the project page and a *Completed on* column in the Project Status Report show it. `verify_invariants.sql` has a 12th check (status and date agree); `init/01-init.sql` mirrors the end state and `init/04-flyway-baseline.sql` baselines at version 14.
- **Near-deadline flag.** `Derived.isTaskDueSoon` and `TaskResponse.dueSoon`: an open task due today or within 3 days (the first reminder day; an overdue task is not also due soon). A *Due today / tomorrow / in N days* badge (`DueSoonBadge`) on the Tasks page, Kanban cards and the task panel, and the same wording in the dashboard's Due & Overdue list. The 3-day window is proposed as decision D-19 in the brief.
- **Tasks quick views** (the brief's *My Tasks* groups): All, Today, Upcoming, In Progress, Completed, Overdue, each with a count, combined with the search, the filters and the My Tasks toggle.
- **Milestone editing.** `MilestoneFormModal` on the project page edits title, description, due date and status (`PUT /api/milestones/{id}`, which already existed); completing a milestone with open linked tasks shows a warning and leaves the tasks alone (D-08). The list shows the description.
- **Milestones on the calendar.** The month, week and day views draw milestones (from `GET /api/milestones`) beside the tasks: a neutral chip with a flag, announced as "Milestone", struck through once completed.

**Fixed on the way**
- The Calendar read a due date such as `2026-10-12` as midnight UTC, which puts it on the previous day west of UTC; it now reads it as that calendar day in local time.

**Tests:** backend 306 → **308** (`DerivedTest` +2); Playwright 108 → **115** (`quick-wins.spec.js`, 7 cases: the completion date through the API, the reports and the project page, the near-deadline rule, a milestone update, milestone editing with its warning, the calendar, the quick views); 115/115 twice with `--workers=4`; ESLint clean. The init-script path (`01-init`, `02-seed`, `04-flyway-baseline`) was built on a scratch database: invariants clean, baseline 14, and `V14` is a no-op when run again.

**Docs:** `database.md` (new column, trigger, `V14`, 25 triggers, baseline 14, 12 invariants), `api-reference.md`, `tasks.md`, `users-and-projects.md`, `frontend.md`, `architecture.md`, `overview.md`, `setup.md`, `testing.md`, `roadmap.md`, `issues.md` (F-37), `DESIGN.md`, `PRODUCT.md`, `README.md`, `workflow-conformance.md` (§15; Calendar and My Tasks now PASS), `assignment-brief.md` (D-19), checklist (`done.md` 52 → 59, `partially_done.md` 17 → 10).

---

## 2026-10-12 — Documentation checked page by page against the code

No code, schema or test change. Every page under `docs/`, the root `README.md` and the ADRs were compared with the controllers, services, entities, SQL scripts, migrations, `docker-compose.yml`, the workflows, the frontend routes and components, and `npx playwright test --list`; all 119 endpoints were matched against [api-reference.md](api-reference.md) by a script (none missing) and all 623 relative links and anchors were checked (one broken anchor fixed). Recorded as D-11 in [issues.md](issues.md).

**Fixed (documentation only)**
- **Counts:** 22 JPA entities (not 15 or 18), 21 granted read-write tables (not 15 or 17), 24 triggers (the `checklist_items` sync trigger was missing from the table), a 198-row permission matrix (163 before `V13`), 11 invariant queries (7 or 9 were stated), 306 backend and 108 Playwright tests (290 / 99 remained in two places), 56 DTO classes, 18 page files.
- **Flyway:** the baseline row written for a fresh volume is version 13, and the `migrate` service applies `V9`–`V13` to an older volume (pages said 10 and `V9`/`V10`); the `migrate` service was missing from the topology in `architecture.md` and `overview.md`; the migration table in `database.md` is in ascending order; the drift note now says what `V13` re-creates.
- **Behaviour:** `403` bodies carry the specific sentence (the docs said "always generic"); the login `role` can be `PROJECT_MANAGER`; the console is silent because `logback-spring.xml` logs to the file only (the docs said "console and file" and "no separate config file"); `POST` status codes (`login`, `verify-otp`, `resend-otp`, `accept`, `decline` and the approval decision answer `200`); comments write `COMMENT_ADDED` to the activity feed and replies are checked against the task; `TASK_DELETED` entries appear in the project and recent feeds; a Team Member does not create tasks; users edit their own position and department; an administrator has a UI for creating accounts and giving a system role; invitations from the Team page carry a role; the description of `roles-permissions.spec.js` in `testing.md` now names the seven roles and the 403 page.
- **Structure lists:** frontend components, UI primitives (`DonutChart` does not exist), pages and routes (`/projects/:id/:view`, `/admin/*`, `/help`, `/error/:status`), backend `security/`, `config/` and `util/` packages, services (approvals, reports, attachments, work logs, deadline job, dashboard and team views), `04-flyway-baseline.sql`.
- **Checklist and ADRs:** `#L<line>` links into `01-init.sql` and other files (which had moved) replaced by names of the table, trigger or method; ADR-0003, 0005, 0006, 0007, 0008, 0009, 0011, 0013 and 0014 brought up to date (each with the original decision left in place).
- `openapi.yaml` is described as documenting 57 of the 119 endpoints (it said 87 and 91).
- The "(uncommitted)" labels on the four 2026-10-10 entries now name commit `5990b0e`, which contains them; the header counts (86 commits, PRs #8 → #47) were refreshed.

---

## 2026-10-10 (error pages) — One error page for every status; Help & Support as a page (commit `5990b0e`)

Front end only; no backend or schema change. Deployed and screenshot-checked at 1360 and 390 px.

**Added**
- `pages/ErrorPage.jsx`: one page for every error status, in the existing `EmptyState` / `.btn` style. Shown for an unknown address (a catch-all route; before, a mistyped URL gave an empty screen), at `/error/:status`, by the permission guard (403), and by the project pages when a project cannot load. It says "Error <status> · <meaning>" and offers *Back to the dashboard*, *Go back*, *Help & Support* and, only for failures that may pass (status `0` = server unreachable, and 5xx), *Try again*. Statuses: 0, 400, 401, 403, 404, 429, 500, 502 / 503 / 504; anything else gets a generic message.
- `pages/Help.jsx` at `/help`: the Help & Support FAQ as a page of its own (four sections plus "Still stuck?"), linked from the sidebar.
- `help-errors.spec.js` (5 Playwright cases).

**Changed**
- `RequirePermission`, `ProjectDetail` and `ProjectViews` use `ErrorPage` instead of their own copies of the same inline message (the 403 wording is unchanged, so the existing test still passes).
- The sidebar's Help & Support is a link like Settings. **Removed** `components/HelpModal.jsx`, which nothing used any more.
- FAQ answers corrected: the password is changed on the **Profile** page (the modal said Settings), and people set their own position and department (the modal said only a Team Admin can). New answers: approvals, deadline reminders, where to see the schedule, what the error messages mean.

**Tests:** Playwright 103 → **108**, 108/108 twice with `--workers=4`; ESLint clean; backend unchanged at 306.

**Docs:** `frontend.md`, `README.md`, `DESIGN.md`, `testing.md`, `issues.md` (F-36), `roadmap.md`, `overview.md`, `PRODUCT.md`, `workflow-conformance.md` (§14), checklist. A final sweep also corrected `testing.md` against the real counts: `ProjectMemberServiceTest` 25 → 30, `roles-permissions.spec.js` 11 → 10, the missing `time-tracking.spec.js` row added (the e2e table now sums to 108 and the backend table to 306), and its "verified on" date.

---

## 2026-10-10 (gantt) — Gantt chart prototype (commit `5990b0e`)

Closes the last item in `docs/checklist/not_done.md` (#38, optional): nothing in the requirements audit is missing any more (17 items are built but incomplete, see `partially_done.md`). Front end only; no backend or schema change. Deployed and screenshot-checked.

**Added**
- `GanttChart.jsx` and a *Gantt* tab on the project views (`/projects/:id/gantt`, open to every member, with a link beside *Timeline* on the project page): one duration bar per task from its start to its due date on a week or month time axis, the task's progress inside the bar, a today line, and an arrow for each task dependency from the prerequisite's end to the dependent task's start. An arrow is red when a task is planned to start before its unfinished prerequisite is due; hovering a bar fades the tasks that do not overlap it. A bar opens the usual task panel.
- `gantt.spec.js` (4 Playwright cases).

**Found on the way**
- Both task dates are required (`NOT NULL` in the database and in the API), so a task without dates cannot exist; the first draft listed "unscheduled" tasks and that handling was removed.
- The Playwright suite is intermittently red at the default 8 workers on this machine, with or without the new spec (a `409` on project creation once, a UI timeout once; both pass alone). It is 103/103 with `--workers=4`, twice. Not investigated further; see R-6.

**Tests:** Playwright 99 → **103**; backend unchanged at 306.

**Docs:** checklist (`done.md` 51 → 52, `not_done.md` now empty), `frontend.md`, `testing.md`, `README.md`, `roadmap.md`, `overview.md`, `PRODUCT.md`, `issues.md` (F-35), `change-plan.md`, `workflow-conformance.md` (§13), `assignment-brief.md`.

---

## 2026-10-10 (scheduler) — Deadline reminders and overdue notices (commit `5990b0e`)

Closes the last two required items in the checklist (#46, #47): a daily job now sends the deadline reminders and the overdue notices that the brief (B9) and the workflow (§27, §28) ask for. No schema change; deployed and verified live.

**Added**
- `DeadlineScheduler` (`config/`, Spring `@Scheduled`): runs every day at 08:00 server time and once when the backend starts, so a day missed while it was down is caught up. Settings `app.deadlines.enabled`, `app.deadlines.cron`, `app.deadlines.run-on-startup` (`DEADLINES_ENABLED`, `DEADLINES_CRON`, `DEADLINES_RUN_ON_STARTUP`). A failure is logged and never stops the application.
- `DeadlineNotificationService`: a `DEADLINE_REMINDER` **3 days and 1 day before** the due date of an open task or milestone and the end date of an open project; an `OVERDUE_TASK` for an open task past its due date, **once** per person and due date. Recipients: the task's assignees and the project's active Owner (milestones and projects: the Owner); people with task notifications off and accounts that are not `ACTIVE` are skipped. A notification with the same type, text, person and item is never created twice.
- Repository queries for open tasks / milestones / projects by date, assignees by task ids, and two `exists…Message` checks on notifications.

**Changed**
- `BackendApplicationTests` starts with `app.deadlines.enabled=false`, so the context test never writes notifications into its database.
- The SQL function `fn_generate_overdue_notifications()` is no longer used by the application (the seed script still calls it once). The Java job replaced it because the function reached assignees only, ignored the notification preference and repeated every day.

**Tests:** backend 290 → **306** (`DeadlineNotificationServiceTest`, 16); Playwright 99/99.

**Verified live:** first startup run created 53 notifications on the development data (52 overdue, 1 reminder), the next startup run created 0, no duplicates, every recipient an assignee or the Owner. The first run on a database with overdue work creates a notice for each of its open overdue tasks.

**Docs:** `notifications.md` (new §8), `backend.md`, `database.md`, `frontend.md`, `README.md`, `setup.md`, `roadmap.md`, `overview.md`, `PRODUCT.md`, `issues.md` (F-34), `change-plan.md`, `testing.md`, `workflow-conformance.md` (§12), ADR-0007, `assignment-brief.md` (B9, G-14), checklist.

---

## 2026-10-10 — Documentation synchronised with the code; friendly network errors (commit `5990b0e`)

A re-check of every document against the code found the checklist and several descriptive pages still showing the state before change-plan batches 1–3c. No schema or backend change.

**Fixed**
- **Network errors (checklist #64):** `frontend/src/api/client.js` routes every request through one `send` helper. An unreachable server now reads "Could not reach the server. Check your connection and try again." (an `ApiError` with status `0`) instead of "Failed to fetch", and a reply that is not JSON, such as a proxy's HTML error page while the backend is down, reads "The server sent an unexpected response. Please try again." instead of a `JSON.parse` message. Lint and build are clean; there is no frontend unit test for it.

**Docs**
- `docs/checklist/`: finished items moved into `done.md` (26 → 49), `partially_done.md` (33 → 17) and `not_done.md` (10 → 3) now list only what is open; the totals still add up to the audit's 69 items. Corrected rows that contradicted the code (login by e-mail, the assignment notification, project and task search and filters, the activity log, role assignment, the "friendly network error" row); fixed the test counts in the risks (R-6, R-7), R-3 and R-10.
- `README.md`: roles and the permission matrix, the approval workflow, notifications, activity log, resource table, endpoint paths, controller and entity counts, test counts (290 backend, 99 Playwright), Flyway, and *Future Enhancements* brought up to date.
- `roadmap.md`, `overview.md`, `PRODUCT.md`, `backend.md`, `database.md` (24 tables, 24 triggers, 21 granted tables, the Compose `migrate` service), `frontend.md`, `testing.md`, `issues.md` (D-08, D-10, F-33), `assignment-brief.md` (batch 3c, 198 grants).
- Removed the links to `Project_requirement_plan.md`, which no longer exists, and the "(uncommitted)" label from entries that are in commits `67d8730`, `4198041` and `5cda340`.
- `workflow-conformance.md` is a dated test log and was left as written.

---

## 2026-10-09 (batch 3c) — Change-plan batch 3c: the five KPIs and the seven named reports

Implements sub-batch 3c of change-plan.md ([assignment-brief.md](../assignment-brief.md) B8, D-12; workflow flows 31 and 32). No schema change. Deployed and verified live.

**Added**
- **Server-side reports, gated by `REPORT:GENERATE_REPORTS`:** `GET /api/reports/kpis`, `/project`, `/tasks`, `/project-status`, `/task-completion`, `/overdue`, `/team-performance`, `/workload`. Until now only the Reports page was hidden from people without the permission; the data endpoints were not. An Administrator reports on every project; anyone else on the projects where they hold the permission (Owner, Team Leader, and the Project Manager as Owner); everyone else gets `403`; a project outside that set is `404` for a stranger.
- **The five KPIs** (approved formulas, D-12): project completion rate, task completion rate, overdue rate, average task completion time (days) and on-time completion rate, each with the counts it was calculated from. A rate whose denominator is empty is `null` and shown as "—"; percentages have one decimal.
- **The seven reports**, each with its filters: Project Report (details, owner, dates, progress, milestones, team, task counts, upcoming deadlines), Task Report (project, assignee, status, priority, due range), Project Status Report (Planning / In Progress / On Hold / Completed / Cancelled / **Delayed**, owner, date range), Task Completion Report (required date range, grouped by project, member or month), Overdue Task Report (project, assignee, priority, days overdue), Team Performance Report (assigned, completed, To Do, In Progress, In Review, overdue, completion rate) and Workload Report (the 3b classification).
- **Reports page:** a tab for the *Overview* (the previous charts), the *KPIs* and each report, with an explicit *Generate* step and the scope and time the report was made.

**Changed**
- `TeamViewsService` exposes `buildWorkload(...)` so the Workload Report and the Team Workload view use the same code.

**Not built:** PDF / Excel export (optional, batch 4).

**Tests:** backend 265 → **290** (`ReportServiceTest`: access rules, the KPI formulas and their empty cases, each report's content and filters); Playwright 86 → **99** (`reports.spec.js`: the KPI numbers against a project with known tasks, 403 for a Team Member on every endpoint, 404 for a stranger, each report's filters and validation, the tabs and generating a report in the browser).

**Docs:** `change-plan.md`, `workflow-conformance.md` (§11), `issues.md`, `assignment-brief.md`, `api-reference.md`, `authentication-authorization.md`, `backend.md`, `frontend.md`, `security.md`, `testing.md`, `roadmap.md`, checklist.

---

## 2026-10-09 (batch 3b) — Change-plan batch 3b: manager views

Implements sub-batch 3b of change-plan.md (assignment-brief.md Part A, B1.3, B3.7, B3.9, D-06, D-13; workflow flows 5, 22, 30, A5). No schema change. Deployed and verified live.

**Added**
- **Dashboard statistics** from the server: `GET /api/dashboard/stats` (projects by status, Delayed, average completion, tasks by status, overdue, the five most-delayed projects) and `GET /api/activity-logs/recent`. The dashboard shows a statistics strip, a *Delayed projects* card, *Recent activity*, and — for people who may assign tasks — a *Team workload* card.
- **Delayed projects**: `ProjectResponse.delayed` and `daysDelayed`, calculated by the new `util/Derived` (end date passed and not Completed / Cancelled), never stored; a *Delayed* badge on project cards and the project page and a *Delayed* filter on the Projects page.
- **Team Tasks** (`GET /api/projects/{id}/team-tasks`, page `/projects/:id/team`): each active member with their tasks, counts and average progress, plus unassigned tasks; reassign or unassign from the list. For people with `TASK:ASSIGN` in the project (Owner, Team Leader, Administrator).
- **Team Workload** (`GET /api/projects/{id}/workload`, `GET /api/workload`, page `/projects/:id/workload`): assigned, active and overdue tasks, estimated and actual hours, and *Overloaded / Underloaded / Balanced* against the team average (D-13, `util/WorkloadClassifier`). Owners and Team Leaders appear only once work is assigned to them.
- **Project timeline** (page `/projects/:id/timeline`, every member): project, milestones and tasks on one time axis with a today marker; a task opens the usual panel.
- **Project roles in the UI**: a role picker on each member of the project page and a confirmed *Owner (transfer ownership)* option (the API already did both).

**Changed**
- `PUT /api/project-members/{id}` now enforces the rules of B3.7 / B3.9: nobody changes their own project role (the Owner stepping down still gets "Transfer ownership first"), and a Team Leader can only make a Team Member a Team Member or a Viewer and cannot touch the role of the Owner or another Team Leader.
- Three existing end-to-end specs picked "the first project card"; they now open *Website Redesign* explicitly (a test that creates a project could otherwise be listed first).

**Tests:** backend 226 → **265** (`DashboardServiceTest`, `TeamViewsServiceTest`, `WorkloadClassifierTest`, `DerivedTest`, the recent-activity feed, five role-rule cases); Playwright 76 → **86** (`manager-views.spec.js`: Delayed, dashboard figures, who may open Team Tasks / Workload, grouping, overloaded / underloaded, role rules, and five UI flows including reassigning a task, the timeline and an ownership transfer).

**Docs:** `change-plan.md`, `workflow-conformance.md` (§10), `issues.md`, `assignment-brief.md` (B1.3, B1.4, D-13, G-19), `api-reference.md`, `authentication-authorization.md`, `backend.md`, `frontend.md`, `users-and-projects.md`, `testing.md`, `roadmap.md`, checklist.

---

## 2026-10-09 (batch 3a) — Change-plan batch 3a: attachments, checklists, comment replies, project activity

Implements sub-batch 3a of change-plan.md ([assignment-brief.md](../assignment-brief.md) B1.5/B1.6, B3.4, B10, D-07, D-17). Deployed after a `pg_dump`; `V13` tried and re-run on a restored copy, and a fresh database built from `01-init.sql` + `02-seed.sql` matched the migrated copy.

**Added**
- **File attachments** on tasks and projects: `POST /api/attachments` (multipart, `file` + `taskId` or `projectId`), `GET /api/attachments/task/{id}`, `/project/{id}`, `GET /api/attachments/{id}/download`, `DELETE /api/attachments/{id}`. **10 MB per file, 25 files per task or project, an allow-list of types** (images, PDF, text, CSV, JSON, Office / OpenDocument, ZIP), content checked against the type, file names cleaned, bytes stored in the database (`attachment_contents`), downloads always `Content-Disposition: attachment` with `nosniff` and a sandboxing CSP, available only to members. The uploader may always delete their own file; the Owner and Team Leader may delete any.
- **Checklists:** `GET /api/checklist-items/task/{id}`, `POST`, `PUT /{id}`, `DELETE /{id}`. A task's progress now counts checklist items together with its subtasks (D-07), kept by the trigger `trg_checklist_items_sync_parent_task`; a completed task whose subtasks are all done stays 100. `TaskResponse` gains `totalChecklistItems` and `completedChecklistItems`.
- **Comment replies in the UI** (threaded under the comment, "Replying to…" on the composer) and a server check that a reply's parent belongs to the same task.
- **Project activity feed:** `GET /api/activity-logs/project/{id}?limit=` (newest first, 50 by default, at most 200) and an *Activity* card on the project page. New events: project created / updated (naming what changed) / completed, milestone created / completed, comment and reply added, file uploaded. `ActivityLogResponse` gains `taskId` and `taskTitle`.
- **Permissions:** two resources, `ATTACHMENT` (Owner / Team Leader: view, create, delete; Team Member: view, create; Viewer: view) and `CHECKLIST_ITEM` (Owner / Team Leader: view, create, edit, delete; Team Member: view, create, edit on tasks assigned to them; Viewer: view). The Roles & Permissions page shows them; the matrix grows from 163 to 198 rows.

**Fixed**
- **nginx refused request bodies over 1 MB** (its default), so profile photos up to the documented 5 MB failed in the Docker deployment. The API location now allows 12 MB; the 5 MB photo limit is checked in `UserService.uploadOwnProfilePhoto` (the multipart ceiling is now 10 MB), and the "file too large" message no longer claims 5 MB for every upload.

**Database — migration `V13__attachments_checklists.sql`** (idempotent): resources `ATTACHMENT` and `CHECKLIST_ITEM` in the `role_permissions` check and their grants; `attachments.file_url` made optional and the new table `attachment_contents`; `checklist_items.created_by`; `fn_compute_task_progress_from_subtasks(task, status)` counting checklist items (the old one-argument function is dropped) and the `checklist_items` trigger; grants for the application role. `01-init.sql`, `03-app-role.sh`, CI, the Flyway baseline (now 13) follow.

**Tests:** backend 175 → **226** (`FileTypeGuardTest`, `AttachmentServiceTest`, `ChecklistItemServiceTest`, `CommentServiceTest`, `ActivityLogServiceTest`, project / milestone feed events, the photo limit, the matrix test now reads `V10` and `V13`); Playwright 66 → **76** (`collaboration.spec.js`: upload / list / download headers / delete rules, type, content and size checks, checklist rules and progress, replies, the project feed and outsider access, the Viewer, three UI flows).

**Docs:** `change-plan.md`, `workflow-conformance.md` (§9), `issues.md`, `assignment-brief.md`, `api-reference.md`, `authentication-authorization.md`, `backend.md`, `database.md`, `frontend.md`, `security.md`, `tasks.md`, `testing.md`, `roadmap.md`, `overview.md`, `PRODUCT.md`, checklist, README.

---

## 2026-10-09 (batch 2) — Change-plan batch 2: the task approval workflow

Implements Batch 2 of change-plan.md ([assignment-brief.md](../assignment-brief.md) B3.8, project-workflow A6, D-05). Deployed after a `pg_dump`, with `V12` first tried (and re-run) on a restored copy of the live database; verified live.

**Added**
- **Approval records and a designated approver.** A task in review has an open request; an approver decides **Approved** (the task is completed, progress 100), **Changes requested** (back to In Progress) or **Rejected** (In Progress or Cancelled, the approver's choice). Changes and rejection need a comment. A task may name its approver (needs `ASSIGN`); then only that person, the project Owner or an Administrator decides. Nobody decides their own work (asked for the review, or assigned to the task) except the Owner and Administrators.
- **API:** `POST /api/tasks/{id}/approval/submit`, `POST /api/tasks/{id}/approval/decision`, `GET /api/tasks/{id}/approvals`, `PUT /api/tasks/{id}/approver`, `GET /api/approvals/pending`; `TaskResponse` gains `approver`, `approvalStatus`, `approvalRequestedBy`, `approvalRequestedAt`.
- **Activity and notifications for every request and decision:** actions `TASK_APPROVAL_REQUESTED`, `TASK_APPROVED`, `TASK_CHANGES_REQUESTED`, `TASK_REJECTED`, `TASK_APPROVER_SET`; notification types `APPROVAL_REQUESTED` (named approver, otherwise every active member who may approve) and `APPROVAL_DECIDED` (the requester). Notifications produced: 4 → 6 of 11 types.
- **UI:** an *Approval* section in the task panel (submit for review, awaiting-approval banner, Approve / Request changes / Reject with a comment, approver picker, history), an *Awaiting approval* / *Changes requested* chip on Tasks and Kanban, and an *Awaiting your approval* inbox on the Tasks page.

**Changed**
- Completing a task through `PUT /api/tasks/{id}` still needs `TASK:APPROVE`, now also follows the who-may-decide rules and is recorded as the approval (an approver who completes a task directly counts as approving it). Moving a task into review through the edit opens a request; moving it out of review withdraws the open request (`WITHDRAWN`). Moving a task to another project clears its approver.
- The quick-advance circle and the status dropdown only offer *Completed* to someone who may decide that task; an approver working on their own task submits it for review instead.

**Database — migration `V12__task_approval_workflow.sql`** (idempotent): `tasks.approver_id`; table `task_approvals` (one open request per task, enforced by a partial unique index); the `activity_logs.action` and `notifications.type` constraints widened; the 6 tasks already `IN_REVIEW` get an open request; grants for the application role. `01-init.sql`, `02-seed.sql`, `03-app-role.sh`, CI, the Flyway baseline (now 12) and `verify_invariants.sql` (two new checks: an open request only on a task in review; every task in review has one) follow.

**Tests:** backend 143 → **175** (`TaskApprovalServiceTest` 27; five new `TaskServiceTest` cases for the status hooks); Playwright 57 → **66** (`approvals.spec.js`: member submits → Team Leader requests changes → approves → project progress moves; rejection; own work; named approver; direct completion and withdrawal; open subtask; two UI flows).

**Docs:** `change-plan.md`, `workflow-conformance.md` (§8), `issues.md`, `assignment-brief.md` (B3.8, B9, G-08, D-05), `api-reference.md`, `authentication-authorization.md`, `backend.md`, `database.md`, `frontend.md`, `notifications.md`, `tasks.md`, `testing.md`, `roadmap.md`, ADR-0015, checklist, overview, PRODUCT.

**Also noticed:** `verify_invariants.sql` query 3 (I-21) now returns no rows on the live database.

---

## 2026-10-09 (batch 1) — Change-plan batch 1: seven quick fixes, `TODO` rename

Implements Batch 1 of change-plan.md. Deployed to the running stack after a `pg_dump`, with `V11` first tried (and re-run) on a copy of the live database; verified live.

**Fixed / Changed**
- **Unknown API paths answer `404 "Resource not found"`**, not `500` with a stack trace (`GlobalExceptionHandler.handleNoResource`) — closes I-22.
- **Labels:** Kanban columns, Tasks groups, the Dashboard overview and the status filters say *To Do / In Progress / In Review / Completed*. The Tasks page now has one group per status (To Do, In Progress, In Review, Completed, Cancelled) instead of To do / Doing / Done.
- **Assignment notification** now reads `<assigner> assigned you to "<task>" in "<project>" — due <date>` (task, project, due date, who assigned it).
- **Sign in with username or e-mail** (`UserService.resolveLoginIdentifier`, `UserRepository.findByEmailIgnoreCase`); the form label is "Username or email" — closes X-02.
- **Own position and department:** the Profile page offers the managed lists; `PUT /api/users/me` accepts `positionId` / `departmentId` (`null` clears, an unknown id is `404`). The Team-page endpoint refuses self-targeting with a message pointing to Profile. (D-16)
- **Project filters** (status, priority, project manager) and **sorting** (name, start, end, priority, progress); **task filters** (status, assignee, due date) and sorting (latest, progress, status added); search widened (manager, status, dates, assignee). Done in the browser over the permission-scoped lists; server-side parameters remain open (brief G-16).
- **Stored status `TO_DO` → `TODO`** (D-15): entities, request patterns, `01-init.sql`, `02-seed.sql`, frontend, tests and docs; the label stays "To Do" (`TextFormat.humanizeEnum` and the frontend `humanizeEnum` special-case it; `NotificationService` now uses the shared helper).

**Database — migration `V11__rename_status_to_do_to_todo.sql`** (idempotent): drops the two `CHECK` constraints that list `TO_DO`, sets the new defaults, rewrites 26 tasks and 77 subtasks with the user triggers switched off (so `updated_at` and progress are untouched), re-adds the constraints and re-creates `v_team_workload`. `init/04-flyway-baseline.sql` now writes version 11. An earlier draft used `SET LOCAL session_replication_role`; the trial run showed Flyway did not honour it (rows got a new `updated_at`), so it was replaced by `ALTER TABLE … DISABLE/ENABLE TRIGGER USER` before anything touched the live database.

**Tests:** backend 130 → **143** (unknown path → 404; e-mail resolves to username; own position/department; assignment-notification text; `TextFormat`); Playwright 43 → **57** (`batch1.spec.js`). A `data-testid="task-row"` was added to the Tasks page rows.

**Docs:** `change-plan.md`, `workflow-conformance.md` (§7), `issues.md` (I-22, X-02 fixed; I-20 updated; F-24 … F-26), `assignment-brief.md` (B1.2, B1.9, B13.1: G-07, G-11, G-16, G-17; D-15, D-16), `api-reference.md`, `authentication-authorization.md`, `backend.md`, `database.md`, `frontend.md`, `notifications.md`, `tasks.md`, `testing.md`, `users-and-projects.md`, `roadmap.md`, ADR-0013/0015, checklist, README.

---

## 2026-10-08 (roles v10) — Two-level roles implemented: system roles and project roles

Implements [ADR-0015](adr/0015-two-level-roles-system-and-project.md) and the approved specification ([assignment-brief.md](../assignment-brief.md) Part B). The earlier four-role model (`TEAM_LEADER` and `TEAM_MEMBER` as system roles) is replaced.

**Database — migration `V10__two_level_roles.sql`** (idempotent; applied to the live database after a `pg_dump`, tested first on a fresh volume and on a copy of the live data)
- System roles `ADMINISTRATOR`, `PROJECT_MANAGER`, `USER`; project roles `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`. `TEAM_LEADER` / `TEAM_MEMBER` removed (their accounts became `USER`); owners made Project Managers.
- Matrix rewritten (163 rows): a Team Member no longer creates tasks or deletes subtasks; Owner and Team Leader generate reports for their project; Project Manager keeps project creation and cross-project reports; a Team Leader may delete everything except the project (D-01).
- **Exactly one owner per project**: the V8 "at least one owner" trigger is replaced by the deferred `trg_project_members_single_owner`, which is skipped when the project is being deleted — **fixes I-19** (a project with a single owner could not be deleted).
- `init/01-init.sql` and `02-seed.sql` mirror the end state; new `init/04-flyway-baseline.sql` writes a Flyway baseline row at version 10 so a fresh volume does not replay `V9`; two new checks in `verify_invariants.sql`. Fixed `03-app-role.sh` having been saved with CRLF line endings (a fresh container could not run it).

**Backend**
- New `ProjectOwnership`: the one place that makes someone the owner (creating a project, an administrator naming another manager, a transfer). The new owner must be an active member who is a Project Manager or Administrator; the previous owner becomes `ADMIN`.
- `ProjectMemberService`: nobody is invited or added as `OWNER`; setting a member's role to `OWNER` transfers ownership; the owner cannot be demoted or removed directly. `UserService`: new accounts are `USER`; a person who owns a project cannot be moved to `USER`. `SubtaskService`: a Team Member edits only subtasks of tasks (or subtasks) assigned to them; deleting a subtask needs `SUBTASK:DELETE`.

**Frontend:** the add-member dialog defaults to User; the invite picker no longer offers Project Manager; Reports (link and route) are available through the system role *or* the role in any project (a Team Leader sees them); the Roles & Permissions page shows business labels (Owner = Project Manager of the project, Admin = Team Leader, Member = Team Member) and the project-level Reports grant; the manager picker lists only people who can own projects.

**Tests:** backend 113 → **130** (`ProjectOwnershipTest`, matrix test now reads `V10`, ownership/transfer/refusal cases, subtask limits, role-assignment guard); Playwright 40 → **43** (ownership transfer and single-owner delete, Team Member limits, Team Leader opens Reports). All 43 pass: the six `project-team.spec.js` cases that failed or were skipped are fixed (one stale CSS selector in a test; the leftover `newuser` invitation they assumed was already gone).

**Docs:** `authentication-authorization.md`, `database.md`, `backend.md`, `api-reference.md`, `users-and-projects.md`, `setup.md`, `testing.md`, ADR-0014/0015, checklist, issues (I-19 fixed; I-21, I-22 added), roadmap, and the brief's §B13.1 updated to the implemented model.

**Data repair:** my earlier test clean-up had left orphaned rows (activity-log entries, notifications, tasks of deleted test projects); they were removed and every foreign key re-scanned clean.

**Not done yet:** the approval workflow, creating extra system roles, own position/department, the `TO_DO` → `TODO` rename, and the missing required features (workflow-conformance.md).

---

## 2026-10-08 (test) — Live workflow conformance test; no code changed

The running application was tested against [project-workflow.md](../project-workflow.md) and the approved specification: 79 API checks, a UI sweep of 10 screens and a source check. Result: of 44 application flows **12 pass, 22 are partial, 10 are missing**. Full table and the ranked differences: workflow-conformance.md. Also found: unknown API paths return `500` instead of `404`; the UI says "Done"/"Review" where the specification says Completed/In Review. One clean-up mistake of mine (orphaned test rows) was repaired; two older orphaned test notifications still break `GET /api/notifications` for two seed users and await permission to delete.

---

## 2026-10-08 (specification) — Requirements resolved on paper; no code changed

The assignment and the project workflow disagreed with each other in 18 places and left many rules undefined. They were resolved **before any further code**, and the project owner approved 18 decisions (D-01 … D-18).

**Added (documentation only)**
- [assignment-brief.md](../assignment-brief.md) **Part B — Resolved Specification**: contradiction log, definitions (statuses, overdue / active / pending / delayed, progress, subtask vs checklist, milestone, dependency, priority, search/filter/sort), feature classification (REQUIRED / OPTIONAL / UNDEFINED), non-functional requirements, the two-level role model and the permission matrix, approval workflow, data model, API requirements, the seven reports and five KPIs, notification and logging rules, acceptance criteria, known gaps and decisions. Part A (the assignment as received) is unchanged.
- [project-workflow.md](../project-workflow.md) rewritten: roles and statuses standardised, optional flows labelled, and nine supporting flows (A1–A9: registration, change password/logout, session management, task dependencies, project timeline, task approval, audit log, Gantt, documents).
- [ADR-0015](adr/0015-two-level-roles-system-and-project.md): the **target** role model — system roles `ADMINISTRATOR` / `PROJECT_MANAGER` / `USER`, project roles `OWNER` / `ADMIN` / `MEMBER` / `VIEWER`, one owner per project, Team Leader and Team Member as labels for `ADMIN` and `MEMBER`.

**Changed (documentation)**
- ADR-0014 is marked as the implemented model whose role set is to be replaced; [authentication-authorization.md](authentication-authorization.md) now opens with a "target vs. current" table; the checklist, issues (I-20), roadmap (§3a) and the requirement links in PRODUCT, overview and the docs README point to the new documents. Roles, permissions and approval moved from *Done* back to *Partially done* in the checklist because the application does not yet match the approved model.

**Decisions of note:** a Team Leader may delete everything except the project (D-01); a system role never widens a project role (D-02); only Project Managers and Administrators may own projects (D-03/D-04); every task needs approval (D-05); Team Members do not create tasks; checklist items count toward task progress (D-07); users edit their own position and department (D-16); administrators can create extra system roles (D-14).

**Not done:** no code, migration or test was changed. The application still follows ADR-0014; the work list is [roadmap.md](roadmap.md) §3a and brief §B13.1.

---

## 2026-10-08 (latest) — Four roles, seven permissions and a real permission matrix

Brings the application in line with `Role_Requirment.md`: Administrator, Project Manager, Team Leader and Team Member, the permissions View / Create / Edit / Delete / Assign / Approve / Generate Reports, and a Role & Permission and a User & Role screen. Decision record: [ADR-0014](adr/0014-requirement-roles-and-permission-matrix.md) (partly supersedes ADR-0002).

**Added**
- **A data-driven permission matrix.** `role_permissions` now holds *(role, permission, resource, scope)* rows (164 of them) and **both the API and the UI read it**; before, the table existed but nothing used it and the rules were hard-coded twice (Java and JavaScript). `PermissionService` keeps an in-memory snapshot (refreshed after every edit); `ProjectAccessGuard` answers through it; the project-scoped model, the `404` for non-members and the ownership rules (comment author, assignee-only status, last owner) are kept.
- **Roles:** `PROJECT_MANAGER`, `TEAM_LEADER`, `TEAM_MEMBER` as system roles and as project roles (`OWNER`→Project Manager, `ADMIN`→Team Leader, `MEMBER`→Team Member), plus the project-only `VIEWER`. New accounts are Team Members.
- **Approval gate (`APPROVE`):** only Project Managers, Team Leaders and Administrators can set a task `COMPLETED`; Team Members submit work for review (`IN_REVIEW`, "Submit for review" / "Awaiting approval" in the UI).
- **Create a project (`PROJECT:CREATE`)** is limited to Project Managers and Administrators (checklist risk R-1 resolved).
- **Generate Reports (`REPORT:GENERATE_REPORTS`)** (Project Manager, Team Leader, Administrator) gates the Reports page, its route and its sidebar link. There are still no server-side report endpoints, so this is a UI-level gate only.
- **API (4 endpoints, 87 → 91):** `GET /api/users/me/permissions`, `PUT /api/users/{id}/role`, `GET /api/permissions/matrix`, `PUT /api/roles/{id}/permissions`. `POST /api/project-members/invite` accepts an optional `projectRole`.
- **UI:** *Administration → Users* (give each account a role) and *Administration → Roles & Permissions* (the role × resource × action grid, editable with Save / Discard; the Administrator role is read-only); a role picker in the invite form; `RequirePermission` route guard. Controls a user cannot use are **hidden, not disabled** across Tasks, Kanban, Calendar, Dashboard, Project detail, the task panel, Team and the position/department "+ Add New".
- **Specific `403` messages** (for example *"Only a Project Manager or an Administrator can create a project"*).
- **Guardrails:** the Administrator role is locked; a project role cannot lose `PROJECT:VIEW`; built-in roles cannot be renamed or deleted; the last Administrator cannot be demoted; a project-only role cannot be given to an account.

**Changed**
- `USER` role removed; the JWT `role` claim now carries one of the four names. `@PreAuthorize("hasRole('ADMINISTRATOR')")` replaced by `@permissions.require(authentication, 'RESOURCE', 'ACTION')`.
- `frontend/src/api/permissions.js` no longer contains any role names or rules; it only turns the server's permission list into `can` / `canSys` / `canAny`.
- Invite dialog and *Add member* use the four roles; *Add member* defaults to Team Member and offers no project-only role.

**Database**
- **Migration `V9__requirement_roles_and_permissions.sql`** (idempotent): `roles.scope / project_role / built_in`, `role_permissions.resource / scope`, the 164-row matrix, backfill of every account's role (owners → Project Manager, project admins → Team Leader, everyone else → Team Member), `USER` removed, grants for `taskmanager_app`. `01-init.sql` and `02-seed.sql` mirror the end state for fresh volumes.
- **Flyway now runs with Docker Compose:** a one-shot `migrate` service (baseline 8, then `V9`) runs before the backend (`depends_on: service_completed_successfully`), so existing volumes — which never re-run `database/init/` — are upgraded. Applied to the live database on 2026-10-08 after a `pg_dump` backup.
- `03-app-role.sh` and the CI grant list now match (17 read-write tables plus `SELECT` on `permissions`), closing the drift noted in X-05.

**Fixed**
- "+ Add New" position/department is hidden from people who cannot create them (was X-01).
- Built-in roles can no longer be renamed or deleted through the roles API (was I-10).

**Found, not fixed**
- **I-19:** a project whose only active owner is one person cannot be deleted — the V8 owner-integrity trigger blocks the cascade. Present before this change; documented in [issues.md](issues.md).

**Tests:** backend 67 → 113 (`PermissionServiceTest` checks every role × resource × action of the V9 matrix; guard, matrix-editing, role-assignment and invite-role tests). Playwright 33 → 40 (`roles-permissions.spec.js`: API and UI per role). Live checks per role after the migration passed (see [authentication-authorization.md](authentication-authorization.md#52-project-scope-matrix)).

**Docs:** [ADR-0014](adr/0014-requirement-roles-and-permission-matrix.md); [authentication-authorization.md](authentication-authorization.md) rewritten for the new model; `database.md`, `api-reference.md` (91 endpoints), `backend.md`, `frontend.md`, `setup.md`, `security.md`, `architecture.md`, `tasks.md`, `testing.md`, `issues.md`, `users-and-projects.md` and the checklist updated.

---

## 2026-10-08 (later) — Folder READMEs merged into `docs/`, requirements checklist

**Changed (documentation structure)**
- **Removed** `api/README.md`, `backend/README.md`, `frontend/README.md` and `database/README.md`. `docs/` is now the only place for project documentation; the team no longer has to update a README and `api/openapi.yaml` alongside the code, only the matching `docs/` page.
- **Added** [backend.md](backend.md) (stack, run, structure, endpoint groups, security reasoning, logging, invitations, task rules, notifications, status, next steps) and [frontend.md](frontend.md) (stack, scripts, structure, routes, behaviours, time tracking, design tokens, end-to-end tests).
- **Extended** [database.md](database.md) with the content only the database README had: running, connecting and inspecting (§11), deliberate design decisions including progress, overdue and report rules (§12), authorization and the unused permission tables (§13), API/backend coverage (§14), and the Flyway layout, migration rules and CLI command (§8.1, §8.2). Corrected `work_logs` (now implemented) and the grant list (16 tables).
- **Extended** [api-reference.md](api-reference.md) with "Behaviour worth knowing" and "Known quirks" (from `api/README.md`) and a new §18 on the legacy `openapi.yaml`; counts corrected to 87 endpoints and 18 controllers.
- **Updated** [README.md](README.md): new entries in the contents, a "Where the old folder READMEs went" map, and the rule "change behaviour → update `docs/`".
- **Re-linked** every reference to the removed READMEs: the root `README.md` (41 links), `docs/` pages and decision records, comments in six Java files, `database/init/01-init.sql`, `03-app-role.sh`, `.env.example` and `api/openapi.yaml`. The historical migration files `V1`–`V8` were deliberately not edited (a migration's checksum must not change) and still mention the old README in comments.
- Corrected statements that had gone stale: tests (60 → 67 backend, 30 → 33 Playwright), "work logs not implemented", entity count (15 → 16).
- `api/openapi.yaml` header now says it is partly out of date and **no longer maintained**; [api-reference.md](api-reference.md) is the reference. Review of 2026-10-08: 57 of 87 endpoints documented, 30 missing, 23 mentions of removed roles, 6 drifted schemas, no `operationId`s.

**Added (requirements audit)**
- [checklist/](checklist/done.md): `done.md` (25), `partially_done.md` (33), `not_done.md` (11), `not_fully_satisfy.md` (20 items and 7 risks) and `unclear.md`, from an audit of the code against `Role_Requirment.md` (completion about 60%). "User Functions" was resolved (the permission matrix exists); debugging and the final presentation were taken out of scope.

---

## 2026-10-08 — Time tracking, accessibility and mobile pass

**Added**
- **Time tracking:** `WorkLog` entity, `/api/work-logs` (list by task, create, delete), `TaskResponse.actualHours`, and a *Time tracking* section in the task panel with estimated-vs-logged summary, a persistent start/stop timer, a manual entry form and an entry list; `1h 30m / 13h` chips on task rows and board cards. The estimate field now accepts hours, minutes or 8-hour days. `WorkLogServiceTest` (7) and Playwright `time-tracking.spec.js` (3). See [tasks.md](tasks.md#time-tracking-estimated-vs-actual).
- Design documents: [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md).

**Changed (frontend)** — dark-mode charcoal inversion and `on-charcoal` tokens, darker text and status colours for contrast, a global focus ring, `prefers-reduced-motion`, a shared `.field` input class, a `.hit-area` tap-target helper, a two-row dashboard (hero and duplicate Kanban preview removed; the list is now "Due & Overdue"), Reports axis labels, Team list scrolls inside its card, Calendar phone dots, 26px minimum avatar. Details and the remaining items are in [DESIGN.md](DESIGN.md#known-drift).

**Database** — `database/init/03-app-role.sh` now grants the application role `work_logs`. A database created before this change needs the same grant applied once (`GRANT SELECT, INSERT, UPDATE, DELETE ON work_logs TO taskmanager_app;`), otherwise `GET /api/tasks` fails with `permission denied for table work_logs`.

---

## 2026-10-06 (later) — Security and permission fixes

**Fixed (security)**
- **User lookups are scoped:** `GET /api/users/{id}` and `/api/users/username/{username}` return a user only to an administrator, the user themself, or someone sharing an active project; everyone else gets the same `404` as for a missing user. *(was I-01)*
- **Membership lookups are scoped:** `GET /api/project-members/user/{userId}` returns only active memberships in projects the caller belongs to (administrators see all). *(was I-02)*
- **No more cross-project moves:** `PUT /api/tasks/{id}` and `PUT /api/milestones/{id}` need manage rights on the **target** project when `projectId` changes; `PUT /api/project-members/{id}` can change only the role (a different project/user is `400`). *(was I-03, I-05)*
- **`VIEWER` is read-only:** creating/editing/deleting subtasks and adding comments need content-edit rights; an assigned `VIEWER` can no longer change a task's status. The task panel hides the comment box and subtask controls from viewers. *(was I-04, I-07)*
- **Deactivated accounts lose access immediately:** every authenticated request checks the account is still `ACTIVE` while the JWT is decoded (`ActiveAccountJwtValidator`, one status-only query per request); suspended, inactive, pending or deleted accounts get `401`. *(was I-06)*

**Fixed (tests)** — the *Add-member picker* e2e test deleted the seeded `dev.tomas` invitation on each run; it now removes only the invitation it sent (the seed row was restored).

**Added** — `ActiveAccountJwtValidatorTest` (5), `TaskServiceTest` (6), `MilestoneServiceTest` (2), `ViewerWriteAccessTest` (6), extra cases in `UserServiceTest` (+5) and `ProjectMemberServiceTest` (+6); Playwright `permissions.spec.js` (9). Backend total 30 → **60**, Playwright 21 → **30**.

**Changed (API behaviour)** — `UserService.getUserById/getUserByUsername` and `ProjectMemberService.getProjectsByUserId` now take the caller's username; `UserRepository.findAccountStatusByUsername` added. Clients that relied on reading arbitrary users (the frontend does not — it only loads the logged-in user) will now see `404`.

**Docs** — `issues.md`, `security.md`, `authentication-authorization.md`, `api-reference.md`, `users-and-projects.md`, `tasks.md`, `testing.md`, `roadmap.md`, ADRs 0001–0004 and the READMEs updated to match.

---

## 2026-10-06 — Invitations, password UX, My Tasks, Java 25 (commits `52a93b4`, `115d52a`; docs in `5d45c24`)

**Added**
- Live **password-requirements checklist** on Register, Profile → Password and *Invite Member*, with specific error messages; backend field errors are surfaced instead of the generic "One or more fields are invalid". Login deliberately unchanged.
- **Auto-generated project codes** (`PRJ-####`); the code field was removed from *New Project* and is read-only on Edit. *New Project* now opens as a right-side drawer matching *New Task*.
- **Add member** on the project page, with a debounced, database-backed **invitable-user search** across the whole organisation (`GET /api/project-members/project/{id}/invitable-users`).
- **Pending-invitation count** endpoint (`GET …/invitations/count`) and a corrected "N pending invitations" line (managers only).
- **My Tasks** is now a filter on the Tasks page; the sidebar entry and page title are renamed **Tasks**.
- Team page hides *Invite to team* for inactive/suspended users and explains why.
- Backend tests: `ProjectServiceTest` (7), `ProjectMemberServiceTest` (12), 3 new `GlobalExceptionHandlerTest` cases. Playwright: `project-team.spec.js` (9), `team.spec.js` (6).

**Changed**
- Inactive, suspended and unverified accounts can no longer be invited or directly added to a project (enforced in the backend).
- `projectCode` is optional in `ProjectRequest`; blank on update keeps the existing code.
- `PendingInvitationCountResponse` / `InvitableUserResponse` DTOs added; `InvitableUserResponse` is deliberately narrow (no email/phone).

**Fixed**
- Duplicate project code now returns a clean **`409 "Project code already exists."`** (new `ConflictException`, plus a safety net for the `projects_project_code_key` constraint) instead of the raw PostgreSQL message.
- "N pending invitations" always counted zero because it was derived from the active-members list.
- `projects.spec.js` selector `getByText(/^Tasks/)` matched both the sidebar link and the project heading.

**Architecture / Build**
- **Java 21 → 25** (`52a93b4`, produced by the automated upgrade recorded in `.github/modernize/java-upgrade/20261006031004/`): `pom.xml`, CI (Temurin 25), both Dockerfiles, READMEs. Compilation passed; the upgrade run's baseline had 7 of 8 tests passing with the database-dependent context test failing for lack of a local database (same before and after). A scan of 14 direct dependencies found no known CVEs.
- `api/openapi.yaml` gained the two new endpoints and the `409` response.

**Docs (this change, not yet committed)** — new `docs/` folder (setup, overview, architecture, authentication & authorization, users & projects, tasks, notifications, database, API reference, security, testing, issues, roadmap, this changelog, decision records); corrections to the root, backend, frontend, database and API READMEs and a banner on `openapi.yaml`.

---

## 2026-09-17 — PR #44 `project/update_Task_Project_kenban_pages` (`5aab491`, `8f7048d`)

**Changed** — Task, Project and Kanban pages refreshed (16 files: pages, UI primitives, `TaskDetailPanel`/`TaskFormModal`-area components, styles).

## 2026-09-15 — PR #43 `project/polishing_taskpage` (`14ef3d9`, `57adf57`, `727f010`)

**Added**
- **Activity log** (per task): `activity_logs` entity/service/controller, `GET /api/activity-logs/task/{taskId}`, an Activity section in the task panel. (`727f010`)
- **Task dependencies** in the UI and API with **blocked-task** detail (the blocking task is named, a lock icon with tooltip, a Blocked Kanban column) and **overdue** tracking (computed flag, badge). (`727f010`, `57adf57`)
- **Project detail page** (status/priority/dates/manager/progress, filterable task list, members, milestones). (`57adf57`)
- **Playwright end-to-end suite** (`auth.spec.js`, `projects.spec.js`, helpers, config) — first frontend tests. (`57adf57`)

**Fixed** — task/subtask **completion consistency**: a task cannot be completed with open subtasks; subtask-derived task progress; consistency triggers added to the schema. (`727f010`)

**Docs** — all READMEs refreshed. (`57adf57`)

## 2026-09-14 — PRs #41 `project/mod_profile_pages`, #42 `project/polishin_frontend_and_update_role/permission` (`35c6daf`, `9f0a872`)

**Architecture — authorization moved from global roles to per-project roles** (`35c6daf`): every project/task permission now comes from `project_members.project_role` (`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`), checked in `ProjectAccessGuard`; `users.role_id` became optional and the system roles shrank to `USER` and `ADMINISTRATOR`. See [ADR-0002](adr/0002-project-level-authorization.md).

**Database** — `V5__project_scoped_authorization.sql`; `V6__store_profile_photo_in_database.sql` (photo bytes + random token in `users`); later in the same PR `V7__add_default_global_user_role.sql` (the `USER` role) and `V8__enforce_project_owner_integrity.sql` (trigger: a project always keeps an active owner). (`9f0a872`)

**Added** — profile/settings pages reworked; project **ownership rules** (last-owner protection in service and database); task/subtask completion validation; UI fixes. (`9f0a872`)

## 2026-09-13 — PRs #38 `project/front_integration`, #40 `project/integration_newdbtable` (`5170e6a`, `5f21740`, `87ccf00`)

The largest day in the history (three commits, ~170 files changed).

**Architecture / Security** — **project-membership data isolation**: task, project, milestone, assignee, member and dependency reads are scoped to the caller's active memberships (administrator sees all), via the new `ProjectAccessGuard`. (`5170e6a`, `87ccf00`)

**Added** — **self-registration with emailed OTP** (`OtpService`, `MailService`, `Register`/`VerifyOtp` pages, Mailpit in Docker Compose, `V3` migration) and the shared **password policy** and change-password endpoint (`5170e6a`); **positions and departments**, **subtasks**, **comments** and the **team-invitation workflow** (`V4` migration, `TeamInviteRequest`, accept/decline) (`87ccf00`); **login rate limiting** (`LoginRateLimiter`) and the **least-privilege database role** `taskmanager_app` (`03-app-role.sh`, compose/env wiring) (`5f21740`, `5170e6a`).

**Database** — the old database layer was **replaced with the new schema** and the backend/frontend re-integrated against it (73 files changed in `87ccf00`; 25 in `5f21740`).

## 2026-09-12 — PRs #35 `database/Harden_database`, #36 `project/update_CIworkflow` (`b692d3b`, `586a834`)

**Database** — hardening: `permissions`/`role_permissions`, **auto-derived project/milestone progress**, dependency-order and assignment-integrity triggers, **overdue view and function**, **reporting views**, `report_exports`, `kpi_snapshots` (`V2__add_permissions_progress_and_integrity_rules.sql`). (`b692d3b`)

**Build / CI** — CI now **fails when `database/verify_invariants.sql` returns rows**. (`586a834`)

## 2026-09-10 — PR #34 `project/wire_function` (`8416ac9`, `52f08b7`, `dfbec1a`, `31ae2ff`)

**Added** — frontend **wired to the real backend** (11 API modules, pages fetch live data); **notifications** (entity, service, controller, bell UI) and **settings**; **file logging** to `backend/logs/log.txt`. (`8416ac9`, `52f08b7`)

**Fixed** — **database trigger errors** surfaced as `500`: validation triggers now raise with `ERRCODE '23514'` so they map to a readable `400`; the seed's login hash corrected so seeded accounts can log in. (`52f08b7`, `8416ac9`)

**Docs** — notifications, settings and the trigger error-code fix documented. (`dfbec1a`)

## 2026-09-09 — PRs #30 `database/flyway-migrations`, #33 `backend/security-and-dto-hardening` (`3a90be9`, `27c9aca`, `d79566e`)

**Security** — backend hardening: **role checks, DTOs on every endpoint, BCrypt password hashing, restricted CORS, request validation**, global exception handler (50 files). (`27c9aca`)

**Database** — expanded schema, **seed data** (`02-seed.sql`) and the **Flyway project** with the `V1` baseline migration. (`3a90be9`)

## 2026-09-08 — PRs #23–#29

**Added** — **authentication foundation** and **JWT login** (`062034f`, `d3a49b5`, PR #25, #29); UI update and **migration of styling to Tailwind CSS** (`f5c9f12`, `4bf2131`, PRs #23, #24); **Docker Compose** stack and CI/CD workflow (`c2a0209`, PR #27); frontend lint fix in CI (`6989966`).

## 2026-09-01 → 2026-09-07 — PRs #14–#21

**Added** — backend **security configuration** (`a20b7a7`), **entities, repositories, services and controllers** (30 files, `4a631da`, PR #20/#21); **database setup 2.0** with Docker and `.env.example` (`a4b92f7`, PR #18); frontend UI updates (`365d2bb`, PR #14); UI placeholder pending a new design (`a403057`); an **ERD design** (`database/erd-design/erd.md`, 579 lines) committed in `c9e1391` and removed again in `541ea49` ("remove db sub folder"); CD workflow and Tailwind configuration (`dfea1c1`). Markdown/documentation updates (`11b4738`, PRs #15, #16).

## 2026-08-27 → 2026-08-31 — Project start (PRs #8–#13)

**Added** — repository created with `Role_Requirment.md` (`5f8edae`, `1d37570`); `Contributing.md` and the git workflow (`d25ac74`, `e6f9a98`, `efa48a1`); GitHub **agent definitions** under `.github/agents/` (`f592d12`, `bd78088`); `.gitignore` (`5377a48`); **frontend scaffold** React + Vite (`4b91d27`); **database setup** scripts (`6e03427`, `261f2be`); **backend initialisation and health endpoint** (`5f597b5`, `a725975`); UI setup (`661fb8a`).

---

## Schema change history (from the migration files)

| Version | Introduced |
|---|---|
| V1 | Baseline: users, roles, projects, members, milestones, tasks, assignees, dependencies, subtasks, checklist items, comments, attachments, work logs, notifications, activity logs |
| V2 | Permissions tables; derived progress; dependency/assignment/milestone rules; overdue view and function; reporting views; `report_exports`; `kpi_snapshots` |
| V3 | Registration OTP and `PENDING_VERIFICATION`; theme and notification preferences |
| V4 | Positions and departments; invitation columns on `project_members`; new notification types |
| V5 | Project-scoped authorization (`role_id` nullable; `OWNER`/`ADMIN`/`MEMBER`/`VIEWER`; old global roles removed) |
| V6 | Profile photo stored in the database with a public token |
| V7 | `USER` role |
| V8 | Last-owner integrity trigger |
| *(init only)* | Task/subtask completion-consistency triggers and functions exist in `01-init.sql` but have **no migration** — see [database.md](database.md#8-migrations-vs-the-init-script) |

## Contributors seen in the history

Commit authors, as recorded by git: Sovannarith, Henze (also `henze`), Skyee (also `Skyeezz`), Kheng David; plus an automated upgrade co-author on `52a93b4`. Roles and ownership are described in `Contributing.md`; the README states that contributor names are not otherwise tracked.
