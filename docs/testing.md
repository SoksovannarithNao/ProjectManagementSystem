# Testing

What is tested today, how to run it, what the tests prove, and where the gaps are. Counts were verified by running the suites on **2026-10-08**, after the two-level role migration `V10`: backend **130/130 passing**, Playwright **37 of 43 passing** (the other six are all in `project-team.spec.js` and fail or are skipped because of one leftover pending invitation, see section 4), frontend lint clean.

## 1. Overview

| Layer | Tooling | Location | Tests | Runs in CI? |
|---|---|---|---|---|
| Backend unit tests | JUnit 5, Mockito, AssertJ (Spring Boot test starters) | `backend/src/test/java/backend/` | 129 | Yes (`mvn -B verify`) |
| Backend context test | `@SpringBootTest` (needs PostgreSQL) | `BackendApplicationTests` | 1 | Yes (CI starts Postgres) |
| Frontend end-to-end | Playwright (Chromium) against the running stack | `frontend/e2e/` | 43 | **No** |
| Frontend unit/component tests | — none configured | — | 0 | — |
| Database invariants | plain SQL, expects zero rows | `database/verify_invariants.sql` | 9 queries | Yes (fails the build on any output) |
| Static checks | ESLint, `vite build` | `frontend/` | — | Yes |
| Docker build check | `docker build` of both images | CI job `docker-build-check` | — | Yes |

Not present: integration tests that exercise controllers (`MockMvc`/`@WebMvcTest`) or repositories (`@DataJpaTest`), a coverage tool (JaCoCo is not configured), performance or load tests, a frontend unit-test runner (the CI file has a commented-out `npm test` step).

## 2. Running the tests

```bash
# Backend — needs JDK 25 and the database container (docker compose up -d postgres mailpit)
cd backend && ./mvnw test            # PowerShell: .\mvnw.cmd test

# Frontend static checks
cd frontend && npm run lint && npm run build

# End-to-end — needs the FULL stack running and the Chromium browser installed once
docker compose up -d --build
cd frontend && npx playwright install chromium && npm run test:e2e
```

More detail and troubleshooting: [setup.md](setup.md#6-running-the-tests).

## 3. Backend tests (130)

| Class | Tests | What it covers |
|---|---|---|
| `BackendApplicationTests` | 1 | The Spring context starts and the entities validate against the real schema (`ddl-auto=validate`). **Fails without a reachable PostgreSQL**, and fails against a database that has not had the latest migration applied (the schema check sees a missing column) |
| `exception/GlobalExceptionHandlerTest` | 6 | `NotFoundException` → 404 with its message; `AuthenticationException` → 401 (not 500); unexpected exception → 500 **without leaking the message**; `ConflictException` → 409; duplicate `projects_project_code_key` → 409 `"Project code already exists."` with no raw PostgreSQL text; other integrity violations stay 400 with the cleaned sentence |
| `service/UserServiceTest` | 9 | `createUser` hashes the password; the response does not leak the hash; `updateUser` leaves the hash alone when no password is sent; **scoped lookups** — a user can read themself, an administrator anyone, a teammate (shared active project) is allowed, a stranger gets the same `NotFoundException` as a missing user, by id and by username |
| `service/ProjectServiceTest` | 11 | Duplicate code on create → `ConflictException` and nothing saved; code is trimmed; missing/blank code → next `PRJ-####` (including numeric gaps); update to another project's code → conflict; update keeping its own code allowed; blank code on update keeps the existing one |
| `service/ProjectMemberServiceTest` | 25 | `INACTIVE`/`SUSPENDED` targets rejected by invite (2) **and** by direct add (2); an `ACTIVE` target still invited as `PENDING`/`MEMBER` with a notification; invite still needs manage rights; pending count uses the `PENDING` query and is manager-only; invitable search hits the repository (not the full user list), maps to the narrow DTO, clamps the page size, is manager-only; `likePattern` escaping; **membership lookups** limited to `ACTIVE` rows in the caller's own projects (administrator sees all, a stranger gets `[]`); **a membership can't be re-pointed** at another project or user, but its role can change |
| `service/TaskServiceTest` | 10 | A manager **cannot move a task into a project they don't manage** (nothing saved), can into one they also manage, needs no extra check when editing in place; an assigned `VIEWER` is refused; an assigned `MEMBER` changes only status/progress (not title or project); a member who isn't assigned is refused |
| `service/MilestoneServiceTest` | 2 | Moving a milestone into another project needs manage rights there; editing in place works |
| `service/ViewerWriteAccessTest` | 8 | A `VIEWER` cannot create/edit/delete a subtask or add a comment, but can still read both |
| `service/PermissionServiceTest` | 15 | **The permission matrix itself.** Reads the grants out of `V10__two_level_roles.sql` (163 rows) and checks every role × resource × action × scope: each listed grant is allowed and every unlisted one is refused; the Administrator can do everything without a membership; only Project Manager and Administrator can create a project; Team Member works but cannot plan or approve; Team Leader approves and assigns but cannot delete the project or make a Project Manager; Viewer only views; a pending invitation and non-membership grant nothing; the same user has different power in different projects; reports need `GENERATE_REPORTS`; `refresh()` re-reads the matrix |
| `service/ProjectOwnershipTest` | 5 | The single-owner rule: only a Project Manager or Administrator can own a project; assigning the creator adds an active owner and sets the manager; a transfer demotes the previous owner to Team Leader; a transfer to the current owner changes nothing; a plain `USER` or a pending member is refused |
| `service/ProjectAccessGuardTest` | 9 | `assertAccess` keeps the `404` for non-members; `assertCan` / `assertSystemCan` pass when the permission is held and otherwise throw `AccessDeniedException` with a specific message (who can create a project; what to do instead of completing a task; the generic "<verb> <thing> in this project"); a pending invitation gives no active role; `isAdmin` delegates to the role check |
| `service/RolePermissionServiceTest` | 8 | Matrix editing guardrails: the Administrator role is locked; an unknown role is `404`; unknown scope/resource/permission rejected; a project-only role cannot hold system permissions and a system-only role cannot hold project ones; a project role cannot lose `PROJECT:VIEW`; duplicates are stored once; a save replaces the grants and reloads enforcement |
| `service/UserRoleServiceTest` | 9 | Role assignment: self-registration gives Team Member (who cannot create projects); an Administrator can give an account another system role; the project-only `VIEWER` is refused; the last Administrator cannot be demoted, but one can when another exists; unknown role or user → `404`; an account's own permissions come from `PermissionService` |
| `service/WorkLogServiceTest` | 7 | Time tracking: hours recorded for the caller; blank description stored as null; a future date rejected; a read-only Viewer refused; the author can delete their entry, a Project Manager can delete someone else's, another member cannot |
| `config/ActiveAccountJwtValidatorTest` | 5 | A token is accepted only while its account is `ACTIVE`; `SUSPENDED`, `INACTIVE`, `PENDING_VERIFICATION` and deleted accounts are rejected with `invalid_token` |

Style: services are tested with mocked repositories (`@ExtendWith(MockitoExtension.class)`), so these tests verify **logic and authorization calls, not SQL**.

## 4. End-to-end tests (43)

All run against the real backend and database with the seeded accounts (password `DevPassword123!`). Shared helper: `frontend/e2e/helpers.js` (`login`).

| Spec | Tests | Workflows covered |
|---|---|---|
| `auth.spec.js` | 3 | valid login lands on the dashboard; invalid password shows an error and stays on `/login`; an unauthenticated visit to a protected route redirects to `/login` |
| `projects.spec.js` | 3 | project cards render with real data; opening a card shows the detail page (heading, **Tasks**, Members, Milestones); opening a task opens its detail panel |
| `permissions.spec.js` (serial) | 9 | **user and membership lookups are scoped** (a project-less user can't read others, can read themself; hidden and nonexistent users look identical; teammates/administrators still can; memberships limited to shared projects); **an owner cannot move a task into a foreign project** (but can edit it in place); an owner can't move a milestone or re-point a membership; **a `VIEWER` can read but not write comments/subtasks/tasks** (API) and the task panel hides the comment box and subtask controls from a viewer while an owner still sees them; owner and member can still comment and add subtasks; **a token issued before an account was suspended stops working (401) and works again after reactivation** |
| `project-team.spec.js` (serial) | 9 | duplicate project code → clean **409**; inactive and suspended users cannot be invited (and can't be added directly); suggestions search the whole organisation and exclude self, active members, pending invitees and inactive users; search is capped, treats `%`/`_` literally, and is manager-only; pending count from `PENDING` rows and shown to managers but hidden from a plain member; the Add-member picker finds users who share no project, by name or username, sends the invitation and updates the count; the UI shows the backend's message for an inactive account |
| `roles-permissions.spec.js` | 11 | **Roles and permissions (new 2026-10-08; extended for the two-level model).** Also: a project has exactly one Owner (a second Owner invite is refused, a plain `USER` cannot become owner, a Project Manager can: the previous owner becomes Team Leader and cannot delete the project, the new owner deletes a single-owner project); a Team Member cannot create tasks, cannot edit a subtask of an unassigned task or delete a subtask; a Team Leader (`USER` + project role `ADMIN`) opens Reports through the project role. API: each seeded role holds exactly the right system permissions (admin, Project Manager, Team Leader, Team Member); a Team Member or system Team Leader creating a project gets `403` with *"Only a Project Manager or an Administrator can create a project"*; a Team Member cannot complete a task (`403`, approval message) while a Project Manager can, and cannot delete it; the matrix endpoint is `403` for a Team Leader and lists the five roles and seven permissions for the Administrator; a Team Leader cannot assign roles; the Administrator role cannot be edited, the last Administrator cannot be demoted, `VIEWER` cannot be a system role. UI: a Team Member sees no Reports link, no Administration group and no *New Project* button and gets "You do not have access" on `/admin/roles` and `/reports`; a Project Manager sees Reports and *New Project* but no Administration; the Administrator opens Roles & Permissions (five roles, the Administrator role read-only), edits a role's checkboxes (Save/Discard enabled and disabled correctly, nothing saved) and sees every user's role in Users. Creates only a task, deleted in a `finally`; never edits the live matrix or an account |
| `team.spec.js` | 6 | Team page: inactive and suspended users get **no** invite control and see the explanation; active users still can; the control comes back when switching to an active user; inactive/suspended users remain in the directory list |

Conventions: `project-team.spec.js` and `permissions.spec.js` run serially and delete **only what they created** (the invitations they sent; their own tasks and milestones; the suspended test account is restored in a `finally`). They never touch seed rows — an earlier version of the picker test deleted the seeded `dev.tomas` invitation, now fixed (issue F-19). Each run still leaves a few detached `activity_logs` rows for the tasks it created and deleted (no endpoint can remove them); they are unreachable from any screen. Counts are asserted relative to a baseline because the seed data already has a `PENDING` invitation on `PRJ-2001` (`dev.tomas`). Tests rely on the seed data being intact (see [setup.md](setup.md#resetting-the-database)).

**Known leftover (2026-10-08):** the live database holds a `PENDING` invitation of `newuser` to `PRJ-2001` (membership 105, invited by the administrator, created at 05:40 UTC before the roles work). The suggestion tests in `project-team.spec.js` assume `newuser` is invitable, so `suggestions search the whole org…` fails and the serial tests after it are skipped. It is leftover data from an earlier test run, not a product defect; delete that one invitation (`DELETE /api/project-members/105` as the administrator) and the six tests pass.

## 5. Database tests

`database/verify_invariants.sql` runs seven read-only queries that must return no rows: tasks without dates; active tasks with an incomplete dependency; assignees who are not project members; assignees who are not `ACTIVE`; tasks linked to another project's milestone; stale project progress; stale milestone progress. CI executes it right after loading `01-init.sql` and `02-seed.sql` and fails on any output. It checks that **the data is consistent**, not that each trigger *rejects* a bad write — there are no tests that attempt a violating `INSERT`/`UPDATE` and expect an error.

## 6. Regression tests for fixed bugs

Bugs fixed during the 2026-10-06 session and the tests that now guard them:

| Bug | Guarded by |
|---|---|
| Duplicate project code showed the raw PostgreSQL error as a 400 | `ProjectServiceTest` (3 duplicate/blank-code cases), `GlobalExceptionHandlerTest` (409 + no leak), `project-team.spec.js` (API returns 409) |
| "N pending invitations" always counted 0 (it counted the active-members list) | `ProjectMemberServiceTest.pendingCount_*`, `project-team.spec.js` (count API + project page text) |
| Inactive/suspended users could be invited | `ProjectMemberServiceTest.invite_rejects…`/`directAdd_rejects…`, `project-team.spec.js`, `team.spec.js` (UI) |
| Invitation suggestions only included people sharing a project | `ProjectMemberServiceTest.search_*`, `project-team.spec.js` (finds `newuser` who shares no project; exclusions) |
| `projects.spec.js` used `getByText(/^Tasks/)`, which also matched the sidebar link after the rename | the spec now uses `getByRole('heading', { name: 'Tasks', exact: true })` |
| Team page offered "Invite to team" for inactive/suspended users | `team.spec.js` |
| Any user could read any user's profile and any user's project memberships | `UserServiceTest` (5 lookup cases), `ProjectMemberServiceTest` (3), `permissions.spec.js` (3) |
| An owner/admin could move a task or milestone into a project they don't belong to; a membership row could be re-pointed | `TaskServiceTest`, `MilestoneServiceTest`, `ProjectMemberServiceTest`, `permissions.spec.js` |
| A `VIEWER` could add comments and subtasks; an assigned `VIEWER` could change a task's status | `ViewerWriteAccessTest`, `TaskServiceTest`, `permissions.spec.js` (API and UI) |
| A suspended/deactivated account's token kept working until it expired | `ActiveAccountJwtValidatorTest`, `permissions.spec.js` |
| The Add-member picker e2e test deleted the seeded `dev.tomas` invitation on every run | `project-team.spec.js` now deletes only the invitation it sent |

Earlier fixes recorded in the project history that **do have** a guard: login failure returned `500` instead of `401` (`GlobalExceptionHandlerTest`); password hash leaking / not being hashed (`UserServiceTest`).

Earlier fixes recorded in the history or in code comments with **no** automated guard: the `LazyInitializationException` during DTO mapping; `createdAt`/`updatedAt` not populated on create; trigger errors falling through as `500` (missing `ERRCODE`); the task/subtask completion-consistency fixes; the OTP attempt counter being rolled back (`noRollbackFor`). `verify_invariants.sql` indirectly watches some of these (data consistency).

## 7. Features verified manually but **without** a permanent automated test

These were exercised during development (a temporary browser spec was run and then removed) but are not in the repository's test suites:

- Password checklist and friendly errors (Register, Profile, Invite Member); login not enforcing complexity.
- New Project drawer, auto-generated code, read-only code on Edit.
- Add-member button visibility by role.
- Tasks page rename and the **My Tasks** filter (it matched exactly the 5 tasks assigned to `dev.chen` of 17 visible).

They are the best candidates for the next e2e additions.

## 8. Missing or weak coverage

| Area | Gap | Risk |
|---|---|---|
| Authorization | The matrix (`PermissionServiceTest`), the guard, matrix editing and role assignment are covered, and the e2e specs sample the endpoints, but there is **no per-endpoint test** that each controller/service asks for the right (resource, action) | Other write paths (task assignees, dependencies, project members, notifications) rely on code review |
| Services | Only the permission paths of `TaskService.updateTask`, `MilestoneService.updateMilestone`, `SubtaskService` writes and `CommentService.createComment` are tested; none for `TaskAssigneeService`, `TaskDependencyService`, `NotificationService`, `ActivityLogService`, `AuthService`, `OtpService`, `JwtService`, `LoginRateLimiter`, and nothing for task creation/deletion or the completion gate | Core business rules (completion gate, auto-promotion, status notifications, OTP limits, rate limiting) rely on manual testing |
| Controllers / security chain | No `MockMvc` tests: validation messages, status codes, `401` bodies, `@PreAuthorize` | Regressions in the HTTP contract go unnoticed |
| Repositories | No `@DataJpaTest`; custom queries (`findInvitableUsers`, `findBlockingTasks`, `countByTaskIds`, `findActiveCoMemberUserIds`) are only exercised indirectly by e2e | Query errors surface late |
| Database triggers | No tests that attempt each forbidden write | A trigger could be dropped or altered unnoticed (see also the migration drift in [database.md](database.md#8-migrations-vs-the-init-script)) |
| Frontend | No component/unit tests; e2e covers login, projects, invitations and the Team page only | Tasks, Kanban, Calendar, Reports, Dashboard, Profile, Settings, registration/OTP and notifications have **no automated UI test** |
| End-to-end workflow | No single test walking register → project → team → milestone → task → assign → progress → complete | The headline requirement flow is untested as a whole |
| CI | Playwright suite not wired in (the grant lists in CI and `03-app-role.sh` now match, see [database.md](database.md#7-least-privilege-application-role)) | |
| Tooling | No coverage measurement | Coverage is unknown |
| Environment | e2e depends on seed data and a running Docker stack; the first test is slow (~10 s) | Flakiness if the data has been altered |

## 9. Suggested next steps

1. The role × resource × action matrix is now tested exhaustively at the unit level; what is still not tested is each *endpoint* wiring to the right (resource, action) pair, which only the e2e specs sample. `MockMvc` tests would close it.
2. Add `MockMvc` tests for the security chain and exception contract.
3. Add `@DataJpaTest` (or Testcontainers) coverage for the custom queries and for each database trigger.
4. Convert the manual checks in section 7 into Playwright specs and wire `npm run test:e2e` into CI (start the stack with `docker compose up -d` in the job).
5. Add JaCoCo to measure coverage.
