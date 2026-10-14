# Test cases

The formal list of what the application is tested for: one row per case, with the steps, the expected result and the automated test that proves it. [testing.md](testing.md) is the engineering view (tools, counts, how to run, gaps); this page is the checklist a reviewer or tester reads to see **what behaviour is covered**. Last verified **2026-10-14** against the running stack: backend 453/453, frontend unit tests 172/172, Playwright 215 tests in 33 files (215/215 in a clean run; see [testing.md](testing.md) for the timing-sensitive specs fixed on the way) (the first 145 also passed on a freshly built stack with an empty database, started the way the CI `e2e` job starts it).

**Reading the tables**

- **ID** is stable; refer to it in bug reports and pull requests.
- **Steps** are written for a person; the automated test does the same through the browser or the API with the seeded accounts (password `DevPassword123!`, see [setup.md](setup.md#5-test-accounts-and-sample-data)).
- **Automated by** names the spec file (`frontend/e2e/…`), unit-test file or class. A case marked **Manual** has no automated test and is listed again in [section 18](#18-cases-with-no-automated-test).
- Cases that need a clock the test controls use Playwright's fake clock; the others run in real time.

| Prefix | Area | Section |
|---|---|---|
| AUTH | Sign-in, sessions, auto-logout | [1](#1-sign-in-and-sessions) |
| REG | Registration and verification | [2](#2-registration-and-verification) |
| ROLE | Roles, permissions, administration | [3](#3-roles-permissions-and-administration) |
| PRJ | Projects | [4](#4-projects) |
| MEM | Members, invitations, ownership | [5](#5-members-invitations-and-ownership) |
| TSK | Tasks, subtasks, dependencies, quick views | [6](#6-tasks) |
| APR | Task approval | [7](#7-task-approval) |
| COL | Comments, files, checklists, project feed | [8](#8-collaboration) |
| TIM | Time tracking | [9](#9-time-tracking) |
| MIL | Milestones, calendar, Gantt, timeline | [10](#10-milestones-calendar-gantt-and-timeline) |
| DSH | Dashboard and manager views | [11](#11-dashboard-and-manager-views) |
| REP | Reports and KPIs | [12](#12-reports-and-kpis) |
| NTF | Notifications | [13](#13-notifications) |
| ERR | Errors, help, every screen opens | [14](#14-errors-help-and-every-screen) |
| SEC | Data isolation and security | [15](#15-data-isolation-and-security) |
| DB | Database rules | [16](#16-database-rules) |
| UNIT | Pure front-end logic | [17](#17-front-end-unit-tests) |
| E2E | The whole flow | [0](#0-the-whole-flow) |

## 0. The whole flow

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| E2E-01 | A project goes from creation to completion | A Project Manager creates a project, invites a Team Leader and a Team Member, adds a milestone and a task assigned to the member; the member starts and submits it; the member tries to approve it; the leader approves it; the Project Manager completes the project | The code is generated (`PRJ-####`); the assignee is notified; a member cannot approve (`403`); the task completes at 100%; project and milestone progress reach 100%; the project report and the KPIs count it; completing stamps the completion date; the project page shows *Completed on <date>* | `core-workflow.spec.js` |

## 1. Sign-in and sessions

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| AUTH-01 | Sign in with a username | Open `/login`, enter a valid username and password | The dashboard opens ("Hello, …") | `auth.spec.js` |
| AUTH-02 | Sign in with an e-mail address | Enter the account's e-mail (any letter case) instead of the username | Signed in; through the API too, and a wrong password is still `401` | `batch1.spec.js`; `UserServiceTest` |
| AUTH-03 | Wrong password | Enter a valid username and a wrong password | An error is shown and the page stays on `/login` | `auth.spec.js` |
| AUTH-04 | Protected page without signing in | Open `/projects` while signed out | Redirected to `/login` | `auth.spec.js` |
| AUTH-05 | A suspended account's token stops working | Suspend an account that is signed in; call the API with its token; reactivate | `401` while suspended; works again after reactivation | `permissions.spec.js`; `ActiveAccountJwtValidatorTest` |
| AUTH-06 | Inactivity warning and sign-out | Stay idle for 15 minutes | A warning appears; one minute later the user is signed out, the login page says why, and no session is left in `localStorage` | `idle-and-updates.spec.js` |
| AUTH-07 | Stay signed in | Click *Stay signed in* on the warning | The session continues and the 15-minute clock restarts | `idle-and-updates.spec.js` |
| AUTH-08 | Activity restarts the clock | Use the page before the warning | No warning appears at the original time | `idle-and-updates.spec.js` |
| AUTH-09 | Activity in another tab | Keep working in a second tab of the same browser | The idle tab is not signed out | `idle-and-updates.spec.js`; `idleTimeout.test.js` |
| AUTH-10 | Sign out by choice | Click *Sign out now* on the warning | Signed out without the inactivity message | `idle-and-updates.spec.js` |
| AUTH-11 | Network and server errors read plainly | Make a request while the server is unreachable, or while a proxy returns an HTML page | "Could not reach the server…" or "The server sent an unexpected response…", never a raw browser message | `client.test.js` |
| AUTH-12 | The token is not kept in storage | Sign in; look at the browser's local storage and cookies | Storage holds only the username and role; the refresh cookie is `HttpOnly` and `SameSite=Strict`, so a script cannot read it; a reload keeps the session | `session.spec.js` |
| AUTH-13 | A token that ran out is renewed silently | Use the app for longer than 15 minutes (or have one request answered `401`) | The request is repeated with a new token and the person notices nothing; only a failed refresh signs them out | `session.spec.js`; `client.test.js` |
| AUTH-14 | Signing out ends the session on the server | Sign out; replay the old refresh cookie | `401 "Session expired"`; the cookie is cleared; a reload shows the sign-in page | `session.spec.js`; `AuthServiceTest` |
| AUTH-15 | A changed or reset password, or a suspension, ends the session | Change the password (or have an administrator reset it, or suspend the account); refresh with the old cookie | `401 "Session expired"` each time | `session.spec.js`; `UserServiceTest`; `RefreshTokenServiceTest` |

## 2. Registration and verification

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| REG-01 | Register, verify, sign in | Fill the registration form with a new username, e-mail and a complete password; read the six-digit code from the e-mail; enter it; sign in | The code is sent, the account is verified, the new user reaches the dashboard | `registration.spec.js` |
| REG-02 | A wrong code | Enter `000000` | An error is shown; the account stays unverified | `registration.spec.js` |
| REG-03 | Sign-in before verification | Register, skip the code, try to sign in | Sign-in is refused | `registration.spec.js` |
| REG-04 | A weak or mismatched password | Register with `password`, or with two different passwords | The form is refused with a message and stays on `/register` | `registration.spec.js`; `validation.test.js` |
| REG-05 | A name that is taken | Register with an existing username | Refused with a message | `registration.spec.js` |
| REG-06 | Password rules | Check passwords against the policy | Length, case, digit and symbol rules decide; the first problem is named | `validation.test.js` |

## 3. Roles, permissions and administration

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| ROLE-01 | Seeded roles hold the right permissions | List the roles and their system permissions | Each role holds exactly the agreed grants | `roles-permissions.spec.js`; `PermissionServiceTest` |
| ROLE-02 | Only a Project Manager or Administrator creates a project | A Team Member or Team Leader tries to create one | `403` "Only a Project Manager or an Administrator can create a project" | `roles-permissions.spec.js`; `ProjectAccessGuardTest` |
| ROLE-03 | The permission matrix is restricted | A Team Leader opens the matrix or assigns a role | `403`; the Administrator sees all seven roles and seven permissions | `roles-permissions.spec.js` |
| ROLE-04 | Matrix guardrails | Edit the Administrator role; give a project role a system permission; remove `PROJECT:VIEW` | Refused | `RolePermissionServiceTest`; `roles-permissions.spec.js` |
| ROLE-05 | The last Administrator cannot be demoted | Demote the only Administrator | Refused; allowed when another Administrator exists | `UserRoleServiceTest`; `roles-permissions.spec.js` |
| ROLE-06 | What each role sees | Sign in as a Team Member, a Team Leader, a Project Manager and the Administrator | A Team Member has no Reports link, no Administration, no *New Project*; a Team Leader reaches Reports through the project role; a Project Manager creates projects but is not an administrator; the Administrator manages roles and users | `roles-permissions.spec.js` |
| ROLE-07 | Every role × resource × action | Check each grant against the permission matrix | Each listed grant is allowed, every unlisted one is refused | `PermissionServiceTest` |
| ROLE-08 | Permission helpers in the browser | Ask whether a user may do something in a project | The answer follows the user's system and project roles | `permissions.test.js` |
| ROLE-09 | Edit, deactivate and delete an account | In *Administration → Users*, edit an account's name and phone, set it Inactive, then delete it | The changes are saved; the inactive account cannot sign in; the account disappears | `user-management.spec.js` |
| ROLE-10 | The last Administrator is protected | Deactivate or delete the only Administrator | Refused; allowed when another Administrator exists | `UserRoleServiceTest` |
| ROLE-11 | You cannot delete your own account | Delete your own account; a Team Member deletes an account | The screen has no Delete on your own row and the server answers `400`; a Team Member gets `403` | `user-management.spec.js`; `UserRoleServiceTest` |
| ROLE-12 | Create an extra system role and give it permissions | Roles & Permissions → *New role* (opens in the right-hand panel; closing it with text typed asks before discarding); tick *view projects* and *generate reports*; give the role to an account | The role starts with no permissions; the account's effective permissions are exactly those two; *create projects* is disabled for an extra role | `custom-roles.spec.js`; `RoleServiceTest` |
| ROLE-13 | Rename and delete an extra role | Rename it; delete it while an account holds it; give the account another role and delete again | The rename is saved; the first delete is refused; the second succeeds; the built-in roles show no Edit or Delete | `custom-roles.spec.js`; `RoleServiceTest` |
| ROLE-14 | The rules for extra roles | Use a name in use or an odd name; rename or delete a built-in role; give an extra role *create projects* or a system-wide task grant; a Team Member creates, edits or deletes a role | `409` / `400` / `400` / `400` / `400` with a clear message; `403` for the Team Member | `custom-roles.spec.js`; `RoleServiceTest`; `RolePermissionServiceTest` |
| ROLE-15 | The audit log records sensitive changes | As an Administrator create an account, change its role, suspend it and delete it; change a role's permissions; transfer a project's ownership and delete the project | Each step is an entry with the actor, the target and the values before and after (the permissions: the full list); an unchanged save adds nothing; entries stay readable after the account, role or project is gone | `audit-log.spec.js`; `AuditLogServiceTest`; `UserRoleServiceTest`; `RolePermissionServiceTest` |
| ROLE-16 | Who reads the audit log | A Project Manager, Team Leader and Team Member open it; a project's Owner asks for the project's entries | `403` "Only an Administrator can read the audit log" (`401` without a token); the Owner gets only the ownership transfers; a Team Leader or Viewer of the project gets `403` | `audit-log.spec.js`; `AuditLogServiceTest` |
| ROLE-17 | The audit log cannot be changed | `PUT`, `PATCH` or `DELETE` on an entry; `UPDATE` / `DELETE` / `TRUNCATE` in SQL as the application role and as the owner | Refused: no such endpoint, no privilege for the application role, and a trigger that refuses the owner too | `audit-log.spec.js`; checked directly in PostgreSQL (manual, see section 18) |
| ROLE-18 | Search and paging | Search by name, filter by action and dates, page through | Narrowed newest first; the page size is capped at 100 and the total is shown; a typed `%` is text | `audit-log.spec.js` |

## 4. Projects

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| PRJ-01 | Project cards | Open *Projects* | Cards show real data; opening one shows its details, tasks, members and milestones | `projects.spec.js` |
| PRJ-02 | Generated and duplicate codes | Create a project without a code; create one with an existing code | The next `PRJ-####` is generated; a duplicate is a clean `409` "Project code already exists." with no database text | `ProjectServiceTest`; `GlobalExceptionHandlerTest`; `project-team.spec.js` |
| PRJ-03 | Simultaneous creates | Create several projects at the same moment | Every one succeeds with its own code | `ProjectServiceTest` (the code lock); checked by hand with 30 parallel requests (2026-10-12) |
| PRJ-04 | Filter, sort and search | Filter by priority, status and manager; sort by name; search by manager; *Clear* | The cards narrow and sort as asked; *Clear* restores them | `batch1.spec.js` |
| PRJ-05 | Completion date | Complete a project; edit it; reopen it | The date is set by the database and returned by the same save; kept on edit; cleared on reopening; shown on the page and in two reports | `quick-wins.spec.js`; `database/verify_invariants.sql` |
| PRJ-06 | A project that does not exist | Open the address of a project id that does not exist | A 404 page inside the app | `help-errors.spec.js` |
| PRJ-07 | Delayed is calculated | A project passes its end date unfinished | It shows *Delayed* and can be filtered; completing it removes the flag; a future one never is | `manager-views.spec.js`; `DerivedTest`; `DashboardServiceTest` |
| PRJ-08 | Server-side search, filter and sort | `GET /api/projects?status=&priority=&managerId=&search=&sort=` as an Administrator and as a member of two projects; then an unknown value | Only matching projects, within what the caller may see; an unknown status, priority or sort is `400` | `ProjectListQueryTest`; `ProjectServiceTest`; checked by hand against the live stack (2026-10-13) |
| PRJ-09 | Projects a page at a time | `GET /api/projects?page=0&size=3`, then `page=1`, a page past the end, with a `sort` and a `status` filter | `{ items, total, page, size }`; pages do not overlap and follow id order; the total counts what matches; a page past the end is empty; without parameters the whole list | `paging.spec.js`; `ProjectServiceTest`; `PageParamsTest` |
| PRJ-10 | Created date | Open a project | The page shows when the project was created (with the year), beside the dates and the manager | `quick-wins.spec.js` |

## 5. Members, invitations and ownership

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| MEM-01 | Inactive and suspended users cannot be invited | Invite an `INACTIVE` or `SUSPENDED` user, by invitation or direct add | Refused with a message; `ACTIVE` users can still be invited | `project-team.spec.js`; `team.spec.js`; `ProjectMemberServiceTest` |
| MEM-02 | Suggestions | Search for people to add | The whole organisation is searched, excluding self, members, pending invitees and inactive users; capped; `%` and `_` are literal; managers only | `project-team.spec.js`; `ProjectMemberServiceTest` |
| MEM-03 | Pending invitations count | Invite someone | The count comes from `PENDING` rows, is shown to managers and hidden from a plain member | `project-team.spec.js` |
| MEM-04 | One Owner per project | Invite a second Owner; transfer ownership | The second is refused; the previous owner becomes Team Leader; a single-owner project can be deleted by the new Owner | `roles-permissions.spec.js`; `ProjectOwnershipTest` |
| MEM-05 | Project roles | Change a member's role | Nobody changes their own; a Team Leader only moves Team Members and Viewers; the Owner changes anyone's and can transfer ownership | `manager-views.spec.js` |
| MEM-06 | A membership cannot be re-pointed | Change the project or user of a membership | Refused; its role can change | `ProjectMemberServiceTest`; `permissions.spec.js` |
| MEM-07 | Name a Team Leader as the project lead | The Owner clicks *Make lead* beside a Team Leader (or `PUT /api/projects/{id}/lead`); clear it again | The Lead field, the project list and the activity feed show it; only a Team Leader of the project can be named; a Team Leader or Team Member cannot name one | `project-lead.spec.js`; `ProjectServiceTest` |
| MEM-08 | The lead stops being the lead with the role | Demote the lead, remove them from the project, or make them the Owner | The project has no lead afterwards | `project-lead.spec.js`; `ProjectMemberServiceTest` |
| MEM-09 | Invite with a role | Project page → *Add member*: pick *Team Leader*, type a username, send; the person accepts | The dialog offers Team Member (default), Team Leader and Viewer, never Owner; the invitation and then the membership carry the chosen role | `invite-role.spec.js` |

## 6. Tasks

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| TSK-01 | Status names | Open Kanban and Tasks | Columns read To Do / In Progress / In Review / Completed; the API stores `TODO` | `batch1.spec.js` |
| TSK-02 | Task filters | Filter by status; by assignee and due date; clear | Only matching tasks show | `batch1.spec.js` |
| TSK-03 | Quick views | Open Tasks and choose Today, Upcoming, Overdue | Each lists the right tasks | `quick-wins.spec.js` |
| TSK-04 | Due soon | Look at tasks due today to three days ahead | They carry a *Due today / tomorrow / in n days* badge; overdue, finished and far-off tasks do not | `quick-wins.spec.js`; `DerivedTest` |
| TSK-05 | Where a task can be created and moved | An owner moves a task into a project they do not belong to | Refused; editing in place works | `TaskServiceTest`; `permissions.spec.js` |
| TSK-06 | A Team Member's limits | A Team Member creates a task, edits or deletes a subtask of a task not assigned to them, or changes the title of their own task | Refused; they work on the subtasks and the status and progress of tasks assigned to them | `roles-permissions.spec.js`; `TaskServiceTest` |
| TSK-07 | Viewers are read-only | A Viewer comments, adds a subtask or changes a task | Refused (API); the panel hides the controls | `permissions.spec.js`; `ViewerWriteAccessTest` |
| TSK-08 | The quick-advance circle | Click the circle on a task | To Do → In Progress; In Progress → In Review (or Completed for an approver); In Review only for an approver; finished tasks do not move | `tasks.test.js` |
| TSK-09 | Own position and department | Pick them on the Profile page | Saved from the managed lists; an id outside the list is refused | `batch1.spec.js` |
| TSK-10 | Move a card on the Kanban board | Drag a card to another column; or open its *Move to* menu and pick one | The task takes that status (the column lights up while you drag); a finished task can be reopened on purpose | `kanban-moves.spec.js`; `tasks.test.js` |
| TSK-11 | A move the rules refuse | Drop a task with an open subtask on Completed; a blocked task on In Progress; anything on Blocked; a Team Member drops their task on Completed | The card stays and the screen says why (the Move to menu shows the reason beside the disabled column); a Team Member is pointed to In Review, which opens the approval request | `kanban-moves.spec.js`; `tasks.test.js` |
| TSK-12 | Who can move a card | A Team Member looks at cards not assigned to them; a Viewer looks at the board; a Team Member completes a task through the API | No handle and no menu; the server answers `403` | `kanban-moves.spec.js`; `permissions.spec.js` |
| TSK-13 | A move keeps progress and dates right | Move a task up to Completed and back to To Do | Completed: 100% and a completion date, the approval request decided, the project and milestone progress up; reopened: 0% (or derived from its subtasks and items), no completion date, project and milestone progress back | `kanban-integrity.spec.js`; `TaskServiceTest` |
| TSK-14 | A prerequisite cannot be reopened under a running dependant | Move a Completed prerequisite back (or cancel it) while a task that depends on it is In Progress, In Review or Completed | Refused with a message naming the dependants; allowed once they are back in To Do, which blocks them again | `kanban-integrity.spec.js`; `TaskServiceTest` |
| TSK-15 | A move never overwrites a newer edit | Edit a task from another session, then drag its (old) card; or move it from another session first | The edit is kept; a task already moved by someone else is not moved and the board refreshes | `kanban-integrity.spec.js`; `tasks.test.js` |
| TSK-16 | The order of the stages | Drag a To Do card to In Review or Completed | Refused ("A task starts in In Progress"); it goes To Do → In Progress → In Review or Completed, and can be taken back | `kanban-integrity.spec.js`; `tasks.test.js` |
| TSK-17 | Server-side search, filter and sort | `GET /api/tasks?status=&priority=&assigneeId=&projectId=&due=&search=&sort=` as an Administrator and as a member of two projects; then an unknown value | Only matching tasks, within the caller's projects; an unknown status, priority, due or sort is `400` | `TaskListQueryTest`; `TaskServiceTest`; checked by hand against the live stack (2026-10-13) |
| TSK-18 | Tasks a page at a time | `GET /api/tasks?page=0&size=5` as a member and as an Administrator; with `status` and `sort`; `size=0`, `size=201`, `page=-1` | A member's total counts only their projects; the filter runs first; a bad value is `400` | `paging.spec.js`; `TaskServiceTest`; `PageParamsTest` |
| TSK-19 | Created date | Open a task | The task panel shows its start date and when the task was created (with the year) | `quick-wins.spec.js` |
| TSK-20 | A dependency stays inside one project | Link a task to a task of another project; then to a task of its own project | The first is refused (`400`, "same project"; `404` if the caller cannot see the other project), the second is saved | `dependencies-and-notices.spec.js`; `TaskDependencyServiceTest`; `verify_invariants.sql` no. 15 |

## 7. Task approval

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| APR-01 | Submit, request changes, resubmit, approve | A member submits; the Team Leader requests changes with a comment; the member resubmits; the leader approves | The task moves In Review → In Progress → In Review → Completed; project progress rises; the trail, activity and notifications are written | `approvals.spec.js`; `TaskApprovalServiceTest` |
| APR-02 | Rejection | Reject without a comment, then with a comment and a next status | The first is refused; the second moves the task as chosen | `approvals.spec.js` |
| APR-03 | Who may submit and decide | A member who is not assigned submits; a member decides; someone approves their own work | Refused, except the Owner approving their own | `approvals.spec.js` |
| APR-04 | A named approver | Name an approver | Only they (or the Owner) decide; a Team Member cannot be named | `approvals.spec.js` |
| APR-05 | Direct completion and withdrawal | An approver completes a task directly; a task leaves review | The completion counts as the approval; the open request is withdrawn | `approvals.spec.js` |
| APR-06 | Open subtasks block approval | Approve a task with an open subtask | Refused | `approvals.spec.js`; `TaskApprovalServiceTest` |
| APR-07 | In the interface | Submit in the task panel; approve from *Awaiting your approval*; request changes | Works as above; the member sees the comment on the task | `approvals.spec.js` |

## 8. Collaboration

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| COL-01 | Attach a file | A member attaches a file to a task | The name is cleaned, the file is listed, downloaded as an attachment (`nosniff`, sandboxing CSP) and logged | `collaboration.spec.js`; `AttachmentServiceTest` |
| COL-02 | Upload checks | Upload an executable, a renamed file, an empty file, one over the limit | Refused | `collaboration.spec.js`; `FileTypeGuardTest` |
| COL-03 | Who deletes a file | The uploader, a Team Leader, another member | The first two may; another member may not | `collaboration.spec.js` |
| COL-04 | Checklist | Add, tick and delete items | Members add; only the assignee ticks; progress follows (50 → 100 → 50); authors and leaders delete | `collaboration.spec.js`; `ChecklistItemServiceTest` |
| COL-05 | Comments and replies | Comment, and reply to a comment | A reply stays in its own task; comments are logged | `collaboration.spec.js`; `CommentServiceTest` |
| COL-06 | Project feed | Open a project's activity | Project, milestone, task, comment and file events, newest first; a Viewer reads but cannot write; a stranger gets `404` | `collaboration.spec.js`; `ActivityLogServiceTest` |
| COL-07 | A Viewer's page | Open a project as a Viewer | Files are visible; no upload or checklist controls | `collaboration.spec.js` |
| COL-08 | @mention a member | Comment `@dev.mia` on a task of a project she belongs to; also mention yourself, a non-member and an inactive member | Only Mia is mentioned and told; the response lists who is mentioned | `mentions.spec.js`; `CommentServiceTest`; `MentionsTest` |
| COL-09 | Mention in the browser | Type `@mi` in the comment box, pick the member, send | Only the project's members are offered, never yourself; Escape closes the list; the sent comment shows the mention highlighted | `mentions.spec.js`; `mentions.test.js` |

## 9. Time tracking

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| TIM-01 | Log time | Enter `1h30` | The time is saved and shows in the list and the summary | `time-tracking.spec.js`; `duration.test.js` |
| TIM-02 | A time that cannot be read | Enter `2 apples` | Refused with a message that says what to type | `time-tracking.spec.js`; `duration.test.js` |
| TIM-03 | Timer | Start the timer, reload, stop | The clock survives the reload and stops cleanly | `time-tracking.spec.js` |
| TIM-04 | Rules | Log a date two days ahead; a Viewer logs time; delete someone else's entry | Refused; the author or a Project Manager may delete. Tomorrow's date is accepted (the person's own "today" can be one day ahead of the server's) | `WorkLogServiceTest` |
| TIM-05 | Change an entry | Click the pencil on your own entry, change the time and note, save; try a time that cannot be read; cancel | The entry shows the new values; the bad time is refused on the form; nothing else changes. Others' entries have no pencil | `time-log-edit.spec.js`; `WorkLogServiceTest` |
| TIM-06 | Who may change an entry | An Administrator or manager changes someone else's entry; the author moves it to another task or a future date | Refused (`403` even for an administrator; `400`) | `time-log-edit.spec.js`; `WorkLogServiceTest` |
| TIM-07 | Time log in the feed | Log, change and delete an entry; open the task's Activity and the project's Activity card | One line each (`WORK_LOGGED`, `WORK_LOG_UPDATED` with old and new values, `WORK_LOG_DELETED`; a manager's delete names the author); saving without a change adds nothing | `time-log-edit.spec.js`; `WorkLogServiceTest` |

## 10. Milestones, calendar, Gantt and timeline

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| MIL-01 | Edit a milestone | Edit it from the project page; complete it while a task is open | The edit saves; a warning names the open task (in the form and as a warning toast after saving); the task is left untouched; the update keeps fields it did not send | `quick-wins.spec.js`; `MilestoneServiceTest` |
| MIL-02 | Calendar | Open *Calendar* | Milestones appear on their due date in month and day views | `quick-wins.spec.js` |
| MIL-03 | Gantt | Open a project's Gantt tab | A bar per task in date order, dependency arrows, a conflict flag when a task starts before its prerequisite ends, hover fading, zoom to months, a bar opens the task | `gantt.spec.js` |
| MIL-04 | Timeline | Open the Timeline tab | The project, milestones and tasks are drawn; selecting opens them | `manager-views.spec.js` |

## 11. Dashboard and manager views

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| DSH-01 | Dashboard figures | Open the dashboard | Task counts add up; overdue follows the dates; delayed projects, recent activity and a manager's workload show | `manager-views.spec.js`; `DashboardServiceTest` |
| DSH-02 | Team Tasks | Open the Team Tasks tab | Tasks are grouped by member; a Team Leader can reassign; a Team Member gets `403` | `manager-views.spec.js`; `TeamViewsServiceTest` |
| DSH-03 | Workload | Open the Workload tab | Members are marked overloaded or underloaded against the team average; a member cannot open it | `manager-views.spec.js`; `WorkloadClassifierTest` |
| DSH-04 | Task overview and charts | Compute the overview and the daily chart | Counts and shares are right; the chart has one point per day ending today | `stats.test.js` |
| DSH-05 | Overdue pill | Open the dashboard as a manager with overdue tasks; click *N overdue* | The pill is in the Task Overview header and opens the Tasks page | `dashboard-polish.spec.js` |
| DSH-06 | A failed load is said out loud | Make `GET /api/dashboard/stats` fail, open the dashboard, then let it succeed and press *Try again* | A message says some figures could not be loaded and the stat cards read "—"; after the retry the message is gone and the figures are back | `dashboard-polish.spec.js` |
| DSH-07 | Phone and desktop layout | Open the dashboard at 390 px and at 1440 px | At 390 px the workload card shows who is overloaded and the page does not scroll sideways; at 1440 px the two columns start level and stacked cards are 24 px apart | `dashboard-polish.spec.js` |

## 12. Reports and KPIs

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| REP-01 | KPI formulas | Open the KPIs for a project with known tasks | The five KPIs follow the approved formulas (empty denominators are `null`) | `reports.spec.js`; `ReportServiceTest` |
| REP-02 | Who may generate | A Team Member, a stranger | `403` for a Team Member on every report; `404` for someone outside the project | `reports.spec.js`; `ReportServiceTest` |
| REP-03 | Each report | Generate the Project, Task, Project Status, Task Completion, Overdue, Team Performance and Workload reports | Content and filters are right; bad filters return `400` | `reports.spec.js`; `ReportServiceTest` |
| REP-04 | In the interface | Open every tab; generate a report; leave a required filter empty | Every tab loads; figures match the server; the filter is checked first | `reports.spec.js` |
| REP-05 | Formatting | Display a date, a rate, hours | `Oct 12, 2026`, `50.0%`, `1.5`; a dash when there is nothing | `reportFormat.test.js` |
| REP-06 | Export | Generate each report (and open the KPIs); press *Excel*, then *PDF*; look at the page before generating | No buttons before *Generate*; an `.xlsx` and a `.pdf` named after the report and the day are saved, holding its title, scope and tables | `report-export.spec.js`; `reportExport.test.js` |
| REP-07 | Overview workload chart | Open Reports and choose a project in *Filter* | One group of bars per member (assigned, active, overdue); the tooltip adds the estimated and actual hours and the load level; the numbers equal the Workload report's; a person who may not assign tasks has no chart | `reports.spec.js` |

## 13. Notifications

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| NTF-01 | Assignment | Assign a task | The assignee is told, naming the assigner, task, project and due date | `NotificationServiceTest`; `core-workflow.spec.js` |
| NTF-02 | Comments | Comment on a task; reply to a comment | The assignees, Owner and Team Leader are told, not the author or an outsider; a reply also reaches the author of the comment | `idle-and-updates.spec.js`; `UpdateNotificationServiceTest` |
| NTF-03 | Project and milestone edits | Edit or complete a project or milestone; save without changes | The people with work in it are told what changed; completing says so; an unchanged save tells nobody | `idle-and-updates.spec.js`; `UpdateNotificationServiceTest` |
| NTF-04 | The bell | Open the notification bell | The comment notification is shown | `idle-and-updates.spec.js` |
| NTF-05 | Deadline reminders | A task, milestone or project is 3 or 1 days from its end | The assignee and Owner get one reminder; overdue work gets one notice; finished work, switched-off and inactive accounts are skipped | `DeadlineNotificationServiceTest` |
| NTF-06 | Approvals | Submit and decide | Approvers are told of a request, the requester of the decision | `approvals.spec.js`; `TaskApprovalServiceTest` |
| NTF-07 | Mentions | @mention a member in a comment; edit it to mention another | The mentioned member gets "You were mentioned" instead of the generic comment notice, the assignee and Owner still get that one, the author and an outsider get nothing; an edit tells only the newly mentioned | `mentions.spec.js`; `UpdateNotificationServiceTest`; `CommentServiceTest` |
| NTF-08 | Status changes | Move a task to another status as its assignee, then as the Owner | The Owner is told of the assignee's change and the assignee of the Owner's; nobody is told of their own change | `dependencies-and-notices.spec.js`; `UpdateNotificationServiceTest`; `TaskServiceTest` |
| NTF-08 | The bell loads a page at a time | With more than 20 notifications, open the bell; press *Show more* | The newest 20 are shown with *Show more (N older)*; pressing it loads the rest and the button goes; the unread dot comes from the server's count | `paging.spec.js`; `NotificationServiceTest` |

## 14. Errors, help and every screen

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| ERR-01 | Unknown address | Open a path that does not exist | A 404 inside the normal layout, with a way back | `help-errors.spec.js` |
| ERR-02 | Each status | Open `/error/403`, `/429`, `/500`, `/503`, `/0` and an unknown status | Each has its own title; *Try again* only where it helps; unknown statuses are still readable | `help-errors.spec.js` |
| ERR-03 | Help & Support | Open it from the sidebar | A page of its own with five sections; the item is marked current | `help-errors.spec.js` |
| ERR-04 | An unknown API path | Call `/api/does-not-exist` | `404`, not `500` | `batch1.spec.js`; `GlobalExceptionHandlerTest` |
| ERR-05 | Every screen opens | As an administrator, open the dashboard, tasks, projects, calendar, Kanban, team, reports, the three administration pages (users, roles and permissions, audit log), profile, settings, help, and a project with each of its views | No script error, no `5xx` from the API, no error page | `smoke.spec.js` |
| ERR-06 | Text helpers | Format a title, a status, a date, "time ago" | Readable output; missing values handled | `format.test.js` |

## 15. Data isolation and security

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| SEC-01 | Scoped lookups | A user with no projects reads other users | Refused; they can read themself; a hidden and a nonexistent user look the same | `permissions.spec.js`; `UserServiceTest` |
| SEC-02 | Teammates | Look up a teammate | Allowed; memberships are limited to shared projects | `permissions.spec.js` |
| SEC-03 | Passwords are never exposed | Create and update a user | The password is hashed, the response carries no hash, an update without a password leaves it alone | `UserServiceTest` |
| SEC-04 | Errors do not leak | Trigger an unexpected error | `500` without the exception message; `401` for authentication errors | `GlobalExceptionHandlerTest` |
| SEC-05 | Profile photo size | Upload a photo over 5 MB | Refused | `UserServiceTest` |
| SEC-06 | Uploads are checked by content | Upload a script renamed as an image | Refused | `FileTypeGuardTest`; `collaboration.spec.js` |

## 16. Database rules

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| DB-01 | Invariants | Run `database/verify_invariants.sql` on a database built from the init scripts | All fifteen queries return no rows (dates, dependencies, assignees, milestones, progress, one active owner, approvals, completion date, project lead, a completed task at 100%) | CI job `backend`; run by hand against the live and a fresh database |
| DB-02 | A fresh database starts the whole stack | Build the stack on an empty volume | Init scripts and migrations apply, the backend is healthy, and the full browser suite passes | CI job `e2e` |
| DB-03 | Each trigger rejects a bad write | Insert or update a row that breaks a rule | An error naming the rule | **Manual** (not automated) |
| DB-04 | The application role can read every table | Run `database/verify_grants.sql` after the role exists; add a table without a grant and run it again | Nothing is printed; the new table is listed (a table with no entity goes on the script's own list) | CI job `backend` (step *Verify the app role can read every table*); checked by hand 2026-10-14 |

## 17. Front-end unit tests

Small, fast tests of the logic in `frontend/src` that has no screen of its own. They run with `npm test` (Vitest) in a few hundred milliseconds and in CI.

| ID | Case | Expected result | Automated by |
|---|---|---|---|
| UNIT-01 | Durations | `1h30` = 1.5 h, `2d` = 16 h, `20m` = 0.33 h; `-3`, `1:75` and words are rejected; hours and clock text format back | `duration.test.js` |
| UNIT-02 | Passwords | The complexity rules accept and reject the right passwords; the first problem is named | `validation.test.js` |
| UNIT-03 | Permissions | The system and project permission helpers, the project role, the owner or administrator check and the approval rule | `permissions.test.js` |
| UNIT-04 | Display helpers | Task titles, blocked reasons, enum labels, colours and initials, short and long dates, days until, due-soon labels, "time ago" | `format.test.js` |
| UNIT-05 | Task status moves | Which status comes next and who may advance it; the Kanban move rules (`checkTaskMove`); the whole task is resent because the API replaces it | `tasks.test.js` |
| UNIT-06 | Statistics | Board columns (with a Blocked column split out of To Do), the overview shares, the daily chart | `stats.test.js` |
| UNIT-07 | API client | The bearer token is sent; error replies become `ApiError`s with the server message and field errors; `401` signs out (not for login); network and non-JSON failures read plainly; downloads | `client.test.js` |
| UNIT-08 | Auto-logout storage | The limits (15 minutes, 60 seconds); shared activity; the sign-out notice; blocked storage does no harm | `idleTimeout.test.js` |
| UNIT-09 | Report formatting | Dates, rates and hours | `reportFormat.test.js` |
| UNIT-10 | @mention helpers | The `@word` being typed before the caret and what replaces it; who is offered; a message split into plain and mentioned parts | `mentions.test.js` |
| UNIT-11 | Report export documents | The tables of each report as written to Excel and PDF, the sheet layout, the file name | `reportExport.test.js` |

## 18. Cases with no automated test

These were checked by hand during development and are the next candidates for automation ([testing.md](testing.md#7-features-verified-manually-but-without-a-permanent-automated-test)):

| ID | Case | What to check |
|---|---|---|
| MAN-01 | Password checklist | The live checklist on Register, Profile and Invite Member ticks as the rules are met; sign-in does not enforce complexity |
| MAN-02 | New Project drawer | The code is generated, and is read-only when editing |
| MAN-03 | Add-member button | Visible only to those allowed to add members |
| MAN-04 | *My Tasks* filter | Shows exactly the tasks assigned to the signed-in user |
| MAN-05 | Settings | Notification and appearance preferences save and apply |
| MAN-06 | Kanban and Profile | Moving the quick-advance circle on a card; changing the photo |
| DB-03 | Each trigger rejects a bad write | See [section 16](#16-database-rules) |
