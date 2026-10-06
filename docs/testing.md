# Testing

What is tested today, how to run it, what the tests prove, and where the gaps are. Counts were verified by running the suites on **2026-10-06**, after the permission fixes: backend **60/60 passing**, Playwright **30/30 passing**, frontend lint and production build clean.

## 1. Overview

| Layer | Tooling | Location | Tests | Runs in CI? |
|---|---|---|---|---|
| Backend unit tests | JUnit 5, Mockito, AssertJ (Spring Boot test starters) | `backend/src/test/java/backend/` | 59 | Yes (`mvn -B verify`) |
| Backend context test | `@SpringBootTest` (needs PostgreSQL) | `BackendApplicationTests` | 1 | Yes (CI starts Postgres) |
| Frontend end-to-end | Playwright (Chromium) against the running stack | `frontend/e2e/` | 30 | **No** |
| Frontend unit/component tests | — none configured | — | 0 | — |
| Database invariants | plain SQL, expects zero rows | `database/verify_invariants.sql` | 7 queries | Yes (fails the build on any output) |
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

## 3. Backend tests (60)

| Class | Tests | What it covers |
|---|---|---|
| `BackendApplicationTests` | 1 | The Spring context starts and the entities validate against the real schema (`ddl-auto=validate`). **Fails without a reachable PostgreSQL** (this was the one failing test in the Java-upgrade baseline run) |
| `exception/GlobalExceptionHandlerTest` | 6 | `NotFoundException` → 404 with its message; `AuthenticationException` → 401 (not 500); unexpected exception → 500 **without leaking the message**; `ConflictException` → 409; duplicate `projects_project_code_key` → 409 `"Project code already exists."` with no raw PostgreSQL text; other integrity violations stay 400 with the cleaned sentence |
| `service/UserServiceTest` | 9 | `createUser` hashes the password; the response does not leak the hash; `updateUser` leaves the hash alone when no password is sent; **scoped lookups** — a user can read themself, an administrator anyone, a teammate (shared active project) is allowed, a stranger gets the same `NotFoundException` as a missing user, by id and by username |
| `service/ProjectServiceTest` | 7 | Duplicate code on create → `ConflictException` and nothing saved; code is trimmed; missing/blank code → next `PRJ-####` (including numeric gaps); update to another project's code → conflict; update keeping its own code allowed; blank code on update keeps the existing one |
| `service/ProjectMemberServiceTest` | 18 | `INACTIVE`/`SUSPENDED` targets rejected by invite (2) **and** by direct add (2); an `ACTIVE` target still invited as `PENDING`/`MEMBER` with a notification; invite still needs manage rights; pending count uses the `PENDING` query and is manager-only; invitable search hits the repository (not the full user list), maps to the narrow DTO, clamps the page size, is manager-only; `likePattern` escaping; **membership lookups** limited to `ACTIVE` rows in the caller's own projects (administrator sees all, a stranger gets `[]`); **a membership can't be re-pointed** at another project or user, but its role can change |
| `service/TaskServiceTest` | 6 | A manager **cannot move a task into a project they don't manage** (nothing saved), can into one they also manage, needs no extra check when editing in place; an assigned `VIEWER` is refused; an assigned `MEMBER` changes only status/progress (not title or project); a member who isn't assigned is refused |
| `service/MilestoneServiceTest` | 2 | Moving a milestone into another project needs manage rights there; editing in place works |
| `service/ViewerWriteAccessTest` | 6 | A `VIEWER` cannot create/edit/delete a subtask or add a comment, but can still read both |
| `config/ActiveAccountJwtValidatorTest` | 5 | A token is accepted only while its account is `ACTIVE`; `SUSPENDED`, `INACTIVE`, `PENDING_VERIFICATION` and deleted accounts are rejected with `invalid_token` |

Style: services are tested with mocked repositories (`@ExtendWith(MockitoExtension.class)`), so these tests verify **logic and authorization calls, not SQL**.

## 4. End-to-end tests (30)

All run against the real backend and database with the seeded accounts (password `DevPassword123!`). Shared helper: `frontend/e2e/helpers.js` (`login`).

| Spec | Tests | Workflows covered |
|---|---|---|
| `auth.spec.js` | 3 | valid login lands on the dashboard; invalid password shows an error and stays on `/login`; an unauthenticated visit to a protected route redirects to `/login` |
| `projects.spec.js` | 3 | project cards render with real data; opening a card shows the detail page (heading, **Tasks**, Members, Milestones); opening a task opens its detail panel |
| `permissions.spec.js` (serial) | 9 | **user and membership lookups are scoped** (a project-less user can't read others, can read themself; hidden and nonexistent users look identical; teammates/administrators still can; memberships limited to shared projects); **an owner cannot move a task into a foreign project** (but can edit it in place); an owner can't move a milestone or re-point a membership; **a `VIEWER` can read but not write comments/subtasks/tasks** (API) and the task panel hides the comment box and subtask controls from a viewer while an owner still sees them; owner and member can still comment and add subtasks; **a token issued before an account was suspended stops working (401) and works again after reactivation** |
| `project-team.spec.js` (serial) | 9 | duplicate project code → clean **409**; inactive and suspended users cannot be invited (and can't be added directly); suggestions search the whole organisation and exclude self, active members, pending invitees and inactive users; search is capped, treats `%`/`_` literally, and is manager-only; pending count from `PENDING` rows and shown to managers but hidden from a plain member; the Add-member picker finds users who share no project, by name or username, sends the invitation and updates the count; the UI shows the backend's message for an inactive account |
| `team.spec.js` | 6 | Team page: inactive and suspended users get **no** invite control and see the explanation; active users still can; the control comes back when switching to an active user; inactive/suspended users remain in the directory list |

Conventions: `project-team.spec.js` and `permissions.spec.js` run serially and delete **only what they created** (the invitations they sent; their own tasks and milestones; the suspended test account is restored in a `finally`). They never touch seed rows — an earlier version of the picker test deleted the seeded `dev.tomas` invitation, now fixed (issue F-19). Each run still leaves a few detached `activity_logs` rows for the tasks it created and deleted (no endpoint can remove them); they are unreachable from any screen. Counts are asserted relative to a baseline because the seed data already has a `PENDING` invitation on `PRJ-2001` (`dev.tomas`). Tests rely on the seed data being intact (see [setup.md](setup.md#resetting-the-database)).

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
| Authorization | The cases that were broken are now tested (viewer writes, cross-project moves, scoped lookups, deactivated tokens), but there is still **no systematic role × action test** for every endpoint (`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`/non-member) | Other write paths (task assignees, dependencies, project members, notifications) rely on code review |
| Services | Only the permission paths of `TaskService.updateTask`, `MilestoneService.updateMilestone`, `SubtaskService` writes and `CommentService.createComment` are tested; none for `TaskAssigneeService`, `TaskDependencyService`, `NotificationService`, `ActivityLogService`, `AuthService`, `OtpService`, `JwtService`, `LoginRateLimiter`, and nothing for task creation/deletion or the completion gate | Core business rules (completion gate, auto-promotion, status notifications, OTP limits, rate limiting) rely on manual testing |
| Controllers / security chain | No `MockMvc` tests: validation messages, status codes, `401` bodies, `@PreAuthorize` | Regressions in the HTTP contract go unnoticed |
| Repositories | No `@DataJpaTest`; custom queries (`findInvitableUsers`, `findBlockingTasks`, `countByTaskIds`, `findActiveCoMemberUserIds`) are only exercised indirectly by e2e | Query errors surface late |
| Database triggers | No tests that attempt each forbidden write | A trigger could be dropped or altered unnoticed (see also the migration drift in [database.md](database.md#8-migrations-vs-the-init-script)) |
| Frontend | No component/unit tests; e2e covers login, projects, invitations and the Team page only | Tasks, Kanban, Calendar, Reports, Dashboard, Profile, Settings, registration/OTP and notifications have **no automated UI test** |
| End-to-end workflow | No single test walking register → project → team → milestone → task → assign → progress → complete | The headline requirement flow is untested as a whole |
| CI | Playwright suite not wired in; `CI` grants fewer tables to the app role than `03-app-role.sh`, so a CI test touching positions/departments/subtasks/comments/activity logs would fail | |
| Tooling | No coverage measurement | Coverage is unknown |
| Environment | e2e depends on seed data and a running Docker stack; the first test is slow (~10 s) | Flakiness if the data has been altered |

## 9. Suggested next steps

1. Extend the permission tests to a role-by-action matrix for every write endpoint (the fixed cases are covered; the rest are not).
2. Add `MockMvc` tests for the security chain and exception contract.
3. Add `@DataJpaTest` (or Testcontainers) coverage for the custom queries and for each database trigger.
4. Convert the manual checks in section 7 into Playwright specs and wire `npm run test:e2e` into CI (start the stack with `docker compose up -d` in the job).
5. Add JaCoCo to measure coverage.
