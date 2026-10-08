# Change Plan

What is still to change in the application, in the order proposed. Written on **2026-10-08**, after the two-level role migration (`V10`). Nothing below is started.

Sources: the approved specification ([assignment-brief.md](../assignment-brief.md) Part B, decisions D-01 … D-18 all approved), the user flows ([project-workflow.md](../project-workflow.md)) and the live test ([workflow-conformance.md](workflow-conformance.md)). Section references like *B8* point into Part B of the brief.

## 1. Where we are

| Done | Where |
|---|---|
| Two-level roles, one owner per project, Team Member limits, permission matrix and its admin screens | [ADR-0015](adr/0015-two-level-roles-system-and-project.md), migration `V10` |
| Specification resolved on paper (contradictions, definitions, reports, notifications, acceptance criteria) | brief Part B, `project-workflow.md` |
| Time tracking (optional feature) | [tasks.md](tasks.md#time-tracking-estimated-vs-actual) |
| Live conformance test of the 40 workflows | [workflow-conformance.md](workflow-conformance.md): 16 pass, 18 partial, 10 missing |

| Remaining | Items | Size |
|---|---|---|
| **1. Quick fixes** | 7 | small |
| **2. Approval workflow** | 1 feature | medium |
| **3. Missing required features** | 5 sub-batches, 16 items | large |
| **4. Optional features** | 6 | optional |
| **5. Housekeeping** | 3 (1 done) | small |

## 2. How every batch is delivered

1. Change the code **and** the tests (unit + Playwright); a new rule gets a test that fails without it.
2. A schema change is a new idempotent `V<n>` migration **plus** the same end state in `database/init/01-init.sql`; raise the version in `init/04-flyway-baseline.sql`.
3. Back up the live database (`pg_dump`) before a migration; try the migration on a throw-away copy first.
4. Rebuild and redeploy (`docker compose build backend frontend`, `docker compose up -d`), then verify against the running stack.
5. Update the affected `docs/` pages and add a [changelog.md](changelog.md) entry in the same change.
6. Nothing is committed by the assistant; the commit is yours.

## 3. Batch 1 — Quick fixes (7)

| # | Change | Why | Where |
|---|---|---|---|
| 1.1 | Unknown API paths return `404`, not `500` | I-22: every typo logs a stack trace | `GlobalExceptionHandler` (handle `NoResourceFoundException`) |
| 1.2 | UI says **Completed** and **In Review**, not "Done" / "Review" | Conflict C-01; X-4 in the brief | Kanban columns, Tasks groups, Dashboard card |
| 1.3 | Assignment notification carries task name, project, due date and who assigned it | Part A requires it (conformance §13) | `NotificationService.notifyTaskAssigned` |
| 1.4 | Sign in with **username or email** | Part A, REQUIRED | `AuthService`, login form label |
| 1.5 | Users edit their **own position and department** (from the managed lists) | D-16 | `SelfProfileUpdateRequest`, `UserService.updateOwnProfile`, Profile page |
| 1.6 | **Project filters** (Active, Completed, On Hold, Priority, Manager) and sorting; task filter by status, assignee, due date | B1.9, Part A REQUIRED | Projects and Tasks pages; list endpoints stay permission-scoped |
| 1.7 | Rename the stored status `TO_DO` → `TODO` | D-15 | migration `V11`, entity/DTO patterns, frontend constants, tests. **Riskiest of the batch**: touches many files, so do it last and on its own |

Done when: the matching rows in [workflow-conformance.md](workflow-conformance.md) turn to PASS and I-22 is closed.

## 4. Batch 2 — Approval workflow (B3.8, A6)

`IN_REVIEW` is a status; **approval is a separate decision** on the task.

- **Data:** an approval record per request (task, requested by/at, decided by/at, decision, comment) and an optional designated approver on the task.
- **Rules (D-05):** every task needs approval to become `COMPLETED`; *Approved* → may complete; *Changes requested* → back to `IN_PROGRESS` with a comment; *Rejected* → the approver chooses `IN_PROGRESS` or `CANCELLED`; Owner / Administrator may approve their own work; Members and Viewers never approve. Who may approve: Administrator, Project Manager (through its project role), Owner, Team Leader.
- **API:** request, decide, designate approver; the existing completion gate stays as the backstop.
- **Side effects:** an activity entry and a notification for every request and decision (recipients per D-10).
- **UI:** "Submit for review" / "Awaiting approval" in the task panel, Tasks and Kanban; an approver sees pending approvals and decides with a comment.
- **Tests:** unit tests for each decision path and who may decide; Playwright: a member submits, a Team Leader approves, the task completes and project progress changes.

Done when: §15 and A6 in the conformance report turn to PASS.

## 5. Batch 3 — Missing required features

Split into five sub-batches. Each is independent except where noted.

### 3a. Collaboration (4)

| Item | Detail |
|---|---|
| File attachments | Upload to a project or task; Owner, Team Leader, Team Member may upload; the uploader or the Owner may delete; validate type and size (limits are still to be chosen, D-17) |
| Comment replies in the UI | The API already supports `parentCommentId` |
| Checklists | Separate from subtasks (B1.6); counted in task progress together with subtasks (D-07) |
| Project-level activity | Project created/updated, comment added, file uploaded, approval events; a feed on the project page |

### 3b. Manager views (6)

| Item | Detail |
|---|---|
| Dashboard statistics | Total / Active (`IN_PROGRESS`) / Completed / **Delayed** projects; recent activities |
| Delayed projects | Calculated, never stored: end date passed and not Completed or Cancelled (B1.3) |
| Team Tasks | Per project, grouped by member, for Owner and Team Leader |
| Project timeline | Project, milestone and task dates on one axis |
| Team workload | Assigned / active / overdue tasks, estimated and actual hours; overloaded / underloaded **relative to the team average** (D-13) |
| Change a member's role, transfer ownership | UI for what the API already does (B3.9) |

### 3c. Reporting and KPIs (2)

| Item | Detail |
|---|---|
| The seven named reports | Project, Task, Project Status (with Delayed), Task Completion, Overdue Task, Team Performance, Workload; columns and filters as in B8; **server-side endpoints gated by `REPORT:GENERATE_REPORTS`** (today only the page is gated). Needs 3b (Delayed, workload) |
| The five KPIs | Formulas approved as D-12 |

### 3d. Notifications and sessions (3)

| Item | Detail |
|---|---|
| Scheduled reminders and overdue notices | A scheduled job: 3 days and 1 day before a deadline, and when overdue; to the assignee and the project Owner. The generator function exists in the database but nothing runs it |
| Remaining notification types | Comment, project update, milestone update, member added/removed; recipients per D-10 |
| Auto-logout (prototype) | Inactivity warning, then sign-out; the timeout value is still to be chosen |

### 3e. Roles (1)

| Item | Detail |
|---|---|
| Create, edit and delete extra system roles | D-14: choose their permissions from the seven; the three built-in system roles and the four project roles stay fixed |

## 6. Batch 4 — Optional features (6)

Not acceptance criteria. Build only if wanted; if shown they are labelled "Optional feature demonstration".

Kanban drag-to-move (same status rules as §15) · report export to PDF/Excel · Gantt chart prototype · document management · audit log (B10) · @mentions (undefined in both sources).

## 7. Batch 5 — Housekeeping (3 left)

| # | Item |
|---|---|
| 5.1 | ~~Delete the leftover pending `newuser` invitation~~ — **done 2026-10-08**: the invitation was already gone; the one remaining failure in `project-team.spec.js` was a stale selector (`text-danger` → the message text), fixed. The suite is 43/43 |
| 5.2 | I-21: tasks 2, 3 and 5 of PRJ-2001 are assigned to `lead.owen`, who has no PRJ-2001 membership in the live database (seed has one) |
| 5.3 | `api/openapi.yaml` is stale (documents 57 of 91 endpoints, old roles); regenerate it from the code or retire it |
| 5.4 | Run the Playwright suite in CI (it needs the Docker stack) |

## 8. Proposed order

`1 → 2 → 3a → 3b → 3c → 3d → 3e`, with batch 5 any time and batch 4 last (or never).

- Batch 1 first: small, removes visible wrong labels and closes real gaps cheaply.
- Batch 2 next: the approval step is the headline of the role model and is only half built.
- 3a before 3b/3c: the activity feed and attachments feed the dashboard and reports.
- 3c needs 3b (Delayed projects and workload are report inputs); 3d needs a scheduler.

## 9. Open questions

None blocking. Values still to be chosen when their batch starts: attachment size/type limits (D-17), the inactivity timeout (3d), the `TODO` rename timing (1.7).
