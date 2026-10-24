# Test cases

The formal list of what the application is tested for: one row per case, with the steps, the expected result and the automated test that proves it. [testing.md](testing.md) is the engineering view (tools, counts, how to run, gaps); this page is the checklist a reviewer or tester reads to see **what behaviour is covered**. Last verified **2026-10-24** against the running stack: backend 674/674, frontend unit tests 196/196, Playwright 341 tests in 53 files (335 passed, 5 skipped and 1 failed in a full run at 4 workers; the 5 skipped are the `admin-two-factor.spec.js` tests, which need `ADMIN_2FA_ENABLED=true`, and the failure was `audit-log.spec.js` hard-coding the administrator's display name, edited by hand in the demo database; the spec reads the name now and passes, so 336 pass; see [testing.md](testing.md) for the timing-sensitive specs fixed earlier) (the first 145 also passed on a freshly built stack with an empty database, started the way the CI `e2e` job starts it).

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
| PUB | Public pages, theme toggle, the sign-in code and the Gmail route | [19](#19-public-pages-theme-toggle-and-the-administrators-sign-in-code) |

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
| AUTH-16 | The sign-in lockout is per client | Fail five sign-ins for one name; try a sixth, then a sixth with an `X-Forwarded-For` header naming another address; try the same name from a different client address | The sixth is `429` and so is the one with the header (a client cannot pose as another address); a client at another address is not locked | `hardening.spec.js`; checked by hand with two client addresses (2026-10-14, I-09) |

| AUTH-17 | An administrator's password alone starts no session when the second step is on | With `ADMIN_2FA_ENABLED=true`, sign in as an administrator with the right password | `202` with `twoFactorRequired` and the masked e-mail; no token and no cookie; a 6-digit code is e-mailed | `admin-two-factor.spec.js`; `AuthServiceAdminTwoFactorTest`; `AuthControllerTwoFactorTest` |
| AUTH-18 | The code starts the session, once | Enter a wrong code, then the right one, then the right one again | Wrong: `400` with the general message; right: `200`, the session and the refresh cookie; again: `400` | `admin-two-factor.spec.js`; `OtpServiceLoginCodeTest` |
| AUTH-19 | Everyone else is unaffected, and the step is off by default | Sign in as a non-administrator with the step on; sign in as the administrator with the setting off | Both sign in with the password alone | `admin-two-factor.spec.js`; `AuthServiceAdminTwoFactorTest` |
| AUTH-20 | Wrong codes count toward the lock-out and every failure answers alike | Try codes for an unknown name, a non-administrator, an inactive administrator, and fail five in a row | The same `400` message each time; then `429` | `AuthServiceAdminTwoFactorTest` |
| AUTH-21 | Signing in again at once does not send another e-mail | Sign in twice within a minute | One code is mailed; the first stays valid | `OtpServiceLoginCodeTest` |
| AUTH-22 | A code leaves by SMTP or by the Gmail API, and a failed send is a `503` | Send with and without the `GMAIL_*` values; make the send fail | SMTP by default; the Gmail API (token, then send) when all three are set; `503` on failure | `MailServiceTest` (Google mocked); a real send is [MAN-07](#18-cases-with-no-automated-test) |
| AUTH-23 | Google sign-in is off until a client ID is set | Start the stack without `GOOGLE_CLIENT_ID`; open the sign-in page and Profile; call the Google endpoints | `GET /api/auth/google/config` gives `{ clientId: null }`; no Google button and no Profile card; `POST /api/auth/google` and `POST /api/users/me/google` answer `404` | `google-sign-in.spec.js`; `GoogleControllersTest`; `GoogleTokenVerifierTest` |
| AUTH-24 | A Google token that is not good is refused and starts no session | Send a forged, expired, other-app, other-issuer or garbage token to `POST /api/auth/google` | `400 "Google sign-in could not be verified. Please try again."`; no cookie; counts toward the lock-out | `GoogleTokenVerifierTest` (6 cases); `AuthServiceGoogleTest`; `google-sign-in.spec.js` |
| AUTH-25 | An existing account connects Google from Profile, and a Google sign-in never attaches by e-mail | Sign in with a Google account that is connected to nobody although an account has the same e-mail | `400 "An account with this e-mail address already exists. Sign in with your password, then connect Google on your Profile page."`; nothing is created or linked | `GoogleSignInServiceTest`; `AuthServiceGoogleTest`; `google-signup-ui.spec.js` |
| AUTH-26 | Connecting needs the current password, once per account and per Google account | On Profile connect with a wrong password; connect twice; connect a Google account another account holds | `400` each time with a plain sentence and nothing stored; the right password connects once | `GoogleSignInServiceTest`; `GoogleControllersTest`; `google-sign-in.spec.js` |
| AUTH-27 | Google sign-in follows the password rules | Sign in with a connected account that is suspended; with a connected administrator while the second step is on | Refused (`400 "This account is not active…"`); the administrator gets `202` and the e-mailed code, no session | `AuthServiceGoogleTest`; `GoogleControllersTest` |
| AUTH-28 | Disconnecting is always allowed and the password keeps working | Disconnect on Profile; sign in with the password | `204`; the card offers to connect again; the password sign-in is unchanged | `GoogleSignInServiceTest`; `GoogleControllersTest` |
| AUTH-29 | A Google account connected to nobody is offered an account, and the page asks for a username | Press Google's button on the sign-in page with a Google account that has a verified e-mail no account uses | `200 { signupRequired, email, name }` with no token and no cookie; the page shows *Choose a username* with the e-mail; *Cancel* returns to the sign-in form | `GoogleSignInServiceTest`; `AuthServiceGoogleTest`; `GoogleControllersTest`; `google-signup-ui.spec.js` |
| AUTH-30 | The username must be valid and unused, in any letter case | Choose `ab`, `has space`, `a@b.com`, then a name that exists (`PM.Olivia`), then a free one | `400` for each bad one (the form stays open, nothing is created, a taken name does not count toward the lock-out); the free one creates the account | `GoogleControllersTest`; `UserServiceTest`; `google-sign-in.spec.js`; `google-signup-ui.spec.js` |
| AUTH-31 | The new account is a plain, active `USER` made from the verified token, with no password | Complete the sign-up; read the account | `201` and the session; `ACTIVE`, role `USER`, e-mail and full name from Google (not from the request), Google connected, `passwordSet` false, an `ACCOUNT_CREATED` audit entry; a password sign-in for it fails | `GoogleSignInServiceTest`; `UserServiceTest`; `AuthServiceGoogleTest` |
| AUTH-32 | An account Google created sets its first password with Google | On Profile choose a weak password; then a good one and Google's button; then try again; try to disconnect before and after | The page refuses the weak one before sending; the good one is `204` and the Password card appears; a second try is `400 "already has a password"`; `PUT /api/users/me/password` and *Disconnect* are refused until a password exists | `GoogleSignInServiceTest`; `UserServiceTest`; `GoogleControllersTest`; `google-sign-in.spec.js`; `google-signup-ui.spec.js` |
| AUTH-33 | The Create Account page offers Google, and is plain without a client ID | Open `/register` with and without `GOOGLE_CLIENT_ID` | With: Google's button leads to the same username step. Without: no button, the form is unchanged | `google-signup-ui.spec.js`; `google-sign-in.spec.js` |

## 2. Registration and verification

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| REG-01 | Register, verify, sign in | Fill the registration form with a new username, e-mail and a complete password; read the six-digit code from the e-mail; enter it; sign in | The code is sent, the account is verified, the new user reaches the dashboard | `registration.spec.js` |
| REG-02 | A wrong code | Enter `000000` | An error is shown; the account stays unverified | `registration.spec.js` |
| REG-03 | Sign-in before verification | Register, skip the code, try to sign in | Sign-in is refused | `registration.spec.js` |
| REG-04 | A weak or mismatched password | Register with `password`, or with two different passwords | The form is refused with a message and stays on `/register` | `registration.spec.js`; `validation.test.js` |
| REG-05 | A name that is taken | Register with an existing username | Refused with a message | `registration.spec.js` |
| REG-06 | Password rules | Check passwords against the policy | Length, case, digit and symbol rules decide; the first problem is named | `validation.test.js` |
| REG-07 | An unverified registration expires | Register and never enter the code; wait past 24 hours (the hourly job runs) | The account is deleted with its codes, the username and e-mail can be registered again, and a verified account is never touched | `PendingRegistrationCleanupTest`; checked live with a 10-second schedule (2026-10-14, I-14) |

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
| PRJ-11 | The project cards read their counts, not the tasks | Open *Projects*; `GET /api/tasks/project-stats` as an Administrator and as a member | Each card shows `completed/total tasks` (and the overdue number) and no request reads the whole task list; the counts equal those worked out from the tasks (cancelled tasks left out) and a member's include only their projects | `calendar-projects-server.spec.js`; `TaskServiceTest`; `relations.test.js` |
| PRJ-12 | Pending invitations are listed and can be cancelled | As the owner, invite someone; open the project page; press *Cancel* beside their name | The page lists the person, the role offered and who invited them; after *Cancel* the row and the person's *Team invitation* notification are gone and the count line disappears | `hardening.spec.js`; `project-team.spec.js`; `ProjectMemberServiceTest`; `NotificationServiceTest` |

| PRJ-13 | A completed project or task takes nothing new | Set a project to *Completed*; try to add a task (project page, Tasks, Kanban, the API), a milestone, a subtask, a checklist item, a comment, a time entry (or a timer), a file, a "depends on" link, and to move a task into it; complete a task and try the task-level ones on it; then reopen | Each is refused (`409`, "This project is completed…" / "This task is completed…") and the screens offer no add control and show one notice; existing work stays editable; after the status is changed back, adding works again | `completed-project.spec.js`; `TaskServiceTest`; `SubtaskServiceTest`; `MilestoneServiceTest`; `ChecklistItemServiceTest`; `CommentServiceTest`; `WorkLogServiceTest`; `AttachmentServiceTest`; `TaskDependencyServiceTest` |

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
| MEM-09 | Invite with a role | Project page → *Add member*: pick *Team Leader*, choose the person from the list, send; the person accepts | The dialog offers Team Member (default), Team Leader and Viewer, never Owner; the invitation and then the membership carry the chosen role | `invite-role.spec.js` |
| MEM-10 | Add member and Add User are side panels | Project page → *Add member*; Team page → *Add User*, then choose *+ Add New Position* | Each opens as a panel against the right edge; the small *Add New Position* dialog opens centred on the screen above the panel and closing it leaves the panel open | `side-panels.spec.js`; `project-team.spec.js` |
| MEM-11 | Add Member on the Team page | Team → *Add Member*; choose a project, then a person from the list (type to search, arrow keys and Enter), send | The person box is disabled until a project is chosen; Escape closes only the list; only a listed person can be chosen (an inactive account, an existing member and a pending invitee are not listed); the invitation is sent and shown as pending; a Team Member sees neither *Add Member* nor *Add User* | `add-member.spec.js`; `project-team.spec.js` |
| MEM-12 | One name for a project role | Open a project's team list, the *Add member* panel (project page and Team page), the Team page's invite picker and Roles & Permissions | Every project-role picker and badge reads *Owner*, *Admin (Team Leader)*, *Member (Team Member)* or *Viewer*; Roles & Permissions lists the same four names and keeps its note of the Team Leader / Team Member business names; a role change reads "X is now Admin (Team Leader)"; the stored values and the permissions are unchanged | `role-labels.spec.js`; `invite-role.spec.js`; `manager-views.spec.js`; `api/format.test.js` |

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
| TSK-21 | New Task is a side panel | Open *New Task* from the Tasks page; press Escape; open it again, type a title and press Escape | The form is a panel against the right edge (full height, 440 px; the whole width on a phone); a pristine panel closes at once, one with typed text asks *Discard changes?* | `side-panels.spec.js` |
| TSK-22 | The Tasks page reads 50 at a time | Open *Tasks* (the demo data has 98 tasks); press *Show more*; choose the *Overdue* quick view | 50 rows and *Show more (48 more)*; the rest follow on request; a quick view restarts from its first page and holds only its own tasks; the counts on the quick views come from the server | `tasks-server-list.spec.js` |
| TSK-23 | Quick views, assignees and project grouping run on the server | `GET /api/tasks/summary`; `GET /api/tasks?view=overdue`; `?unassigned=true`; `?assigneeId=a&assigneeId=b`; `?groupBy=project&sort=priority`; then `view=soon` and `groupBy=owner` | each count equals the total its view reports; a view holds only its own tasks; a task names its assignees (`assigneeIds`); several assignees must all hold the task; unassigned plus an assignee matches nothing; each project is one run with finished projects last; a member's summary counts only their projects; a bad value is `400` | `tasks-server-list.spec.js`; `TaskListQueryTest`; `TaskServiceTest` |
| TSK-24 | A refused write answers in plain words | Create a task whose due date is before its start date through the API | `400` with `The task due date cannot be before its start date.`; no table, column or constraint name anywhere in the answer | `hardening.spec.js`; `DatabaseMessagesTest`; `GlobalExceptionHandlerTest` |
| TSK-25 | Each Kanban column reads from the server | Open *Kanban* (the demo data has 37 completed tasks); press *Show more* under Completed; `GET /api/tasks?status=TODO&blocked=true` and `blocked=false`; type a search that matches nothing | Completed shows 25 cards, its badge says 37 and the button says *Show more (12 more)*; pressing it adds the rest; the two blocked queries together are every To Do task and no task is in both; every read of the board is one column's page and nothing reads the whole task list or the assignments; the board is busy until the search has been applied and then every column is empty | `kanban-server.spec.js`; `TaskServiceTest`; `TaskListQueryTest`; `tasks.test.js` |

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
| MIL-05 | Detail on the calendar | Click a day number, then an item in its list; click a task chip and a milestone chip in the grid; use *New task on this day* | A day opens a drawer in two parts: the list of what is due (milestones, then tasks) on the left and, once an item is chosen, its detail on the right (the task panel, or a milestone panel with its linked tasks); the list stays while another item is chosen; the X of the detail closes only the detail, the X of the list closes the drawer; a chip opens the drawer on its day with that item chosen; *New task on this day* opens *New Task* set to that day; a Team Member can open a day and has no add button; on a narrow window or a phone one part is shown at a time | `calendar-details.spec.js` |
| MIL-03 | Gantt | Open a project's Gantt tab | A bar per task in date order, dependency arrows, a conflict flag when a task starts before its prerequisite ends, hover fading, zoom to months, a bar opens the task | `gantt.spec.js` |
| MIL-04 | Timeline | Open the Timeline tab | The project, milestones and tasks are drawn; selecting opens them | `manager-views.spec.js` |
| MIL-06 | The Calendar reads only the days on screen | Open *Calendar*; go to a later month; `GET /api/tasks?dueFrom=&dueTo=` and `GET /api/milestones?dueFrom=&dueTo=` with both days at the edges, an open end, a bad date and a range backwards | Every read of the task list carries a window and a new one is read when the month changes; a task due five weeks ahead appears only when its month is shown; both edge days are included, undated items are left out, a bad value is `400` | `calendar-projects-server.spec.js`; `TaskListQueryTest`; `MilestoneServiceTest`; `calendarRange.test.js` |

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
| DSH-08 | Project health and team workload share a column | Open the dashboard as a manager at 1440 px | Delayed projects, the project previews and Team workload are one column, in that order, to the right of the wider task column; the chart starts below both and spans them; a project preview is one card wide | `dashboard-polish.spec.js` |
| DSH-09 | A long team list scrolls inside its card | Open the dashboard as a manager of a team of more than eight people | The list is at most 400 px tall and scrolls (it can be focused and scrolled from the keyboard); the *Team average* footnote stays below it; the page does not get longer | `dashboard-polish.spec.js` |
| DSH-10 | The activity chart and the due-soon list come from the server | Open the dashboard; choose *This Month*; `GET /api/dashboard/task-activity?days=30&zone=UTC` as an Administrator and as a member; with `projectId`; with `days=0`, `days=367` and an unknown zone | The chart is read for 7 days, then for 30; every read of the task list is the short *Due & Overdue* page and nothing reads the assignments; one row per day, oldest first, ending today, with created and completed counts that equal the tasks' own, and today's overdue equal to the statistics; a member sees only their projects, a project they are not in is `404`, a bad value is `400` | `dashboard-server.spec.js`; `TaskActivityTest`; `DashboardServiceTest`; `stats.test.js` |
| DSH-11 | The six figure cards say what they are made of | Open the dashboard | Each card has an icon, the number and one line of context (planning / on hold / cancelled counts, the share of projects, "Past their end date", "across N projects", "N done · M overdue") equal to the server figures; Average completion has a progress bar; the cards are the same height | `dashboard-cards.spec.js` |

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
| REP-08 | Page layout matches the other pages | Open Reports at 1440 px and at 390 px | Filter and the period are in the page header, above the tab strip; the strip uses the Tasks quick-view pills and is one row (scrolling sideways on a phone); the Overview charts sit in two columns, the top two level and the next row 24 px below; the page does not scroll sideways | `reports.spec.js` |
| REP-09 | The Overview figures come from the server | Open Reports as an Administrator, then choose one project in *Filter*; `GET /api/tasks/summary` with and without `projectId` | The four cards (Total, In Progress, Completed, Overdue) equal the summary's counts, and again for the chosen project; *Team Productivity* equals what each person completed; no request reads the task list or the assignments; a member's figures cover only their projects | `reports-overview-server.spec.js`; `TaskListQueryTest`; `TaskServiceTest` |

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
| NTF-09 | An invitation reaches someone with notifications off | An invitee switches *Task notifications* off; a project manager invites them | They still get the `TEAM_INVITATION` notification naming the project | `hardening.spec.js`; `NotificationServiceTest` |
| NTF-10 | A subtask touch that starts a task is announced | Touch a subtask of a task still in To Do (not blocked), as someone who is not its assignee | The task moves to In Progress and its assignees, the Owner and the Team Leaders are told, not the person who touched the subtask; a blocked task or one already under way sends nothing | `SubtaskServiceTest` |

## 14. Errors, help and every screen

| ID | Case | Steps | Expected result | Automated by |
|---|---|---|---|---|
| ERR-01 | Unknown address | Open a path that does not exist | A 404 inside the normal layout, with a way back | `help-errors.spec.js` |
| ERR-02 | Each status | Open `/error/403`, `/429`, `/500`, `/503`, `/0` and an unknown status | Each has its own title; *Try again* only where it helps; unknown statuses are still readable | `help-errors.spec.js` |
| ERR-03 | Help & Support | Open it from the sidebar | A page of its own with five sections; the item is marked current | `help-errors.spec.js` |
| ERR-04 | An unknown API path | Call `/api/does-not-exist` | `404`, not `500` | `batch1.spec.js`; `GlobalExceptionHandlerTest` |
| ERR-05 | Every screen opens | As an administrator, open the dashboard, tasks, projects, calendar, Kanban, team, reports, the three administration pages (users, roles and permissions, audit log), profile, settings, help, and a project with each of its views | No script error, no `5xx` from the API, no error page | `smoke.spec.js` |
| ERR-06 | Text helpers | Format a title, a status, a date, "time ago" | Readable output; missing values handled | `format.test.js` |
| ERR-07 | The page header stays at the top | Open any page, make the window short and scroll down; on a phone scroll a page whose header wraps (Tasks) and use the menu | The header (title, subtitle, and the bell, theme and profile when they are on the first row) stays at the top while the content scrolls beneath it, on a background equal to the page; on a phone only its first row stays and the action buttons are back when you scroll to the top; the notification panel, a side panel and the menu drawer still open above it; no sideways scroll | `sticky-header.spec.js` |
| ERR-08 | A project page fits a phone | As an administrator, open each project at 390 px wide, including one with a long name | The page is not wider than the screen (no sideways scroll); a long name is cut with an ellipsis in the header; the role picker in the team list stays inside its card | `phone-project-page.spec.js` |

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
| MAN-01 | Password checklist | The live checklist on Register, Profile and Add User ticks as the rules are met; sign-in does not enforce complexity |
| MAN-02 | New Project drawer | The code is generated, and is read-only when editing |
| MAN-03 | Add-member button | Visible only to those allowed to add members |
| MAN-04 | *My Tasks* filter | Shows exactly the tasks assigned to the signed-in user |
| MAN-05 | Settings | Notification and appearance preferences save and apply |
| MAN-06 | Kanban and Profile | Moving the quick-advance circle on a card; changing the photo |
| MAN-07 | A real Gmail API send | Start the backend with real `GMAIL_*` values and register an account with an address you can read | The verification code arrives in that inbox (checked by hand on 2026-10-17) |
| MAN-08 | A real Google sign-in | With a real client ID in `GOOGLE_CLIENT_ID` and the origin listed in Google Cloud Console: connect a Google account on Profile (current password, then Google's button), sign out, press Sign in with Google | Signed in to that account with the same session; disconnecting removes it. **Done by hand 2026-10-24:** the account was connected and then signed in with Google (the link's `last_login_at` recorded it); disconnecting with a real Google account was not tried |
| MAN-09 | A real Google sign-up | With a real client ID, press Continue with Google on the sign-in page with a Google account that has no TaskFlow account; choose a username; later set a password on Profile and sign in with it | The account is created and signed in; Profile offers *Set a password*; after setting it the username and password also sign in. **Half done by hand 2026-10-24:** a real Google account with no TaskFlow account created an account (`ACTIVE`, role `USER`, e-mail and name from Google, `passwordSet` false); *Set a password* and the later password sign-in with a real Google account are not yet confirmed |
| DB-03 | Each trigger rejects a bad write | See [section 16](#16-database-rules) |

## 19. Public pages, theme toggle and the administrator's sign-in code

| ID | Case | Steps | Expected | Automated by |
|---|---|---|---|---|
| PUB-01 | The home page is public | Signed out, open `/` | The introduction, a Sign in and a Create account button, and links to the privacy policy and the terms; no redirect to sign in | `public-pages.spec.js` |
| PUB-02 | The privacy policy and the terms open from a direct address and after a refresh | Open `/privacy-policy` and `/terms-of-service` signed out, then refresh | Each page with its own heading and the contact e-mail; no redirect | `public-pages.spec.js` |
| PUB-03 | The policy says how Google OAuth is really used | Open the Google section of the policy | An optional sign-in and sign-up that keeps only Google's identifier, e-mail and name, never matches by e-mail and reads nothing else of the Google account; the other use is `gmail.send`, to send; nothing is read | `public-pages.spec.js` |
| PUB-04 | The pages link to each other and to the forms | Use the footer links; open Sign in and Register | Policy and terms link each way; sign in and register link to both | `public-pages.spec.js` |
| PUB-05 | A signed-in person still gets the dashboard at `/` | Sign in, open `/`, then `/privacy-policy` | The dashboard at `/`; the policy with an *Open TaskFlow* button | `public-pages.spec.js`; `session.spec.js` |
| PUB-06 | Other protected addresses still lead to sign in | Signed out, open `/projects`, or reload a protected page without a session | The sign-in page; the saved session is cleared | `public-pages.spec.js`; `session.spec.js` |
| PUB-07 | The public pages follow the theme and the screen | Switch light/dark; open at 375 px wide; press Tab once | The colours change; no sideways scroll; the first stop is *Skip to content*; one `main` and one `h1` | `public-pages.spec.js` |
| PUB-08 | One theme toggle in the app | Signed in, click the theme button three times | Light, Dark, System in turn, applied at once, saved to the account and kept after a reload; no three-item menu | `theme-toggle.spec.js` |
