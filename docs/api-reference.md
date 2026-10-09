# API Reference

All **119 endpoints** exposed by the 25 controllers in `backend/src/main/java/backend/controller/`, derived directly from the code (the original 84 were checked against the running application on 2026-10-06; the three work-log endpoints and the four permission endpoints were added and checked on 2026-10-08). **This page is the single source of truth for the API.** The folder `api/` also holds `openapi.yaml`, an older machine-readable contract that documents only 57 of the 87 endpoints and still uses removed role names; it is no longer maintained (see [section 18](#18-the-legacy-openapiyaml)). The former `api/README.md` was removed and its content now lives in [section 2](#2-conventions) below.

Contents: [1 Getting started](#1-getting-started) · [2 Conventions](#2-conventions) · [3 Auth](#3-auth) · [4 Users](#4-users) · [5 Roles, positions, departments](#5-roles-positions-departments) · [6 Projects](#6-projects) · [7 Project members and invitations](#7-project-members-and-invitations) · [8 Milestones](#8-milestones) · [9 Tasks](#9-tasks) · [10 Assignees](#10-task-assignees) · [11 Dependencies](#11-task-dependencies) · [12 Subtasks](#12-subtasks) · [13 Comments](#13-comments) · [13b Work logs](#13b-work-logs-time-tracking) · [14 Activity](#14-activity-logs) · [15 Notifications](#15-notifications) · [16 Photos and health](#16-photos-and-health) · [17 Errors](#17-error-responses-and-status-codes) · [18 Legacy openapi.yaml](#18-the-legacy-openapiyaml)

## 1. Getting started

Base URL: `http://localhost:8080` directly, or `http://localhost:5173` through the frontend's nginx proxy (both serve `/api/...`).

```bash
# 1. log in
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin.system","password":"DevPassword123!"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")

# 2. call anything else with the token
curl http://localhost:8080/api/projects -H "Authorization: Bearer $TOKEN"
```

## 2. Conventions

**Authentication.** Everything except the endpoints marked *Public* needs `Authorization: Bearer <JWT>`. Missing, malformed or expired token → `401` with an empty body.

**Authorization labels used below**

| Label | Meaning |
|---|---|
| *Public* | no token needed |
| *Any user* | any authenticated user |
| *Member* | active member (any project role) of the project concerned, or system administrator; otherwise `404` |
| *Content* | holds the matching project grant for the action (`SUBTASK:CREATE`, `COMMENT:CREATE`, `TASK:CREATE`, …) — Team Member, Team Leader, Project Manager, administrator; **not** `VIEWER` |
| *Manager* | holds the matching project grant (`PROJECT:EDIT`, `MILESTONE:*`, `MEMBER:*`, `TASK:EDIT/DELETE/ASSIGN`) — Project Manager, Team Leader, administrator → `403` with a specific message otherwise |
| *Owner* | holds `PROJECT:DELETE` / `PROJECT:ASSIGN` — Project Manager, administrator → `403` otherwise |
| *Admin* | holds the matching system permission (`USER:*`, `ROLE:*`, `LOOKUP:CREATE`) — in practice the administrator only (`@PreAuthorize` → `403` otherwise) |
| *Self* | acts only on the caller's own data; the target comes from the token |

Which role holds which grant is data (`role_permissions`) and can be edited by an administrator; the full matrix is in [authentication-authorization.md](authentication-authorization.md#5-project-roles-and-the-permission-matrix) ([ADR-0014](adr/0014-requirement-roles-and-permission-matrix.md)). A refused request is `403` with a sentence that names what is missing, for example *"Only a Project Manager or an Administrator can create a project"*.

**Request/response format.** JSON (`Content-Type: application/json`), except `PUT /api/users/me/photo` (multipart). Dates are `YYYY-MM-DD`; timestamps are ISO-8601 with offset. `PUT` is a **full replace** — there is no `PATCH`.

**No pagination, sorting or filtering parameters** exist on list endpoints (the only query parameters in the API are `q` and `limit` on the invitable-user search and `taskId`/`dependsOnTaskId` on dependency delete). Lists are scoped to what the caller may see.

**Success codes:** `200` reads/updates and action `POST`s, `201` creates, `204` every `DELETE` and `POST /api/notifications/read-all`.

**Validation.** Request bodies are validated with Bean Validation. Failure → `400`:

```json
{
  "timestamp": "2026-10-06T03:55:17.280Z",
  "status": 400,
  "error": "Validation Failed",
  "message": "One or more fields are invalid",
  "fieldErrors": { "password": "Password must be at least 8 characters and include …" }
}
```

(`fieldErrors` maps a field name to its message; if several rules fail on one field, one message is kept.)

**Common error shape** for every other failure: `{ timestamp, status, error, message, fieldErrors: null }`. Full list in [section 17](#17-error-responses-and-status-codes).

### Behaviour worth knowing up front

- **Correct HTTP status codes.** Every create returns `201 Created`, every delete `204 No Content`, and a missing row returns a clean `404` JSON body (`{"status":404,"error":"Not Found","message":"..."}`) from `GlobalExceptionHandler`, a real `@RestControllerAdvice`. A path that no controller serves (a mistyped URL) also answers `404 "Resource not found"`; it used to answer `500` and log a stack trace (fixed 2026-10-09). The one exception is `POST /api/notifications/read-all`, which returns `204`: it is a `POST` that changes existing rows rather than creating one.
- **Every response is a DTO, never a raw JPA entity.** `UserResponse` never includes a password field of any kind, and wherever a user, project or task appears nested inside another resource (`Project.manager`, `ProjectMember.user`, `TaskAssignee.user`, `Task.createdBy`) it is the same `UserResponse` / `ProjectResponse` DTO, not the entity.
- **Passwords are hashed.** `POST /api/users`, `PUT /api/users/{id}` and `PUT /api/users/me` accept a plaintext `password` and BCrypt-hash it server-side (`UserService`, through Spring Security's `PasswordEncoder`).
- **Authorization is a role × resource × action matrix, project-scoped.** System-wide actions (users, roles, the matrix, positions/departments, creating a project) use `@PreAuthorize("@permissions.require(...)")`; everything else is checked in service code against the grants of the caller's system role plus the role they hold in *that* project (`OWNER` / `ADMIN` / `MEMBER` / `VIEWER`). `PUT /api/tasks/{id}` is the ownership-scoped exception on top: a holder of `TASK:EDIT` can edit any task in full, anyone else can call it only for a task they are assigned to (`403` otherwise) and then only `status` and `progress` take effect; completing a task needs `TASK:APPROVE`. Per-resource policy: [backend.md](backend.md#security); the matrix: [authentication-authorization.md](authentication-authorization.md#52-permission-matrix).
- **Login rate limiting.** `POST /api/auth/login` returns `429 Too Many Requests` after 5 failed attempts within 15 minutes for the same `remoteAddr:<what was typed>` key (a username or an e-mail address, counted separately; in-memory, resets on restart; a successful login clears the counter).
- **Self-registration is a separate public flow.** `POST /api/auth/register` creates a `PENDING_VERIFICATION` account and emails an OTP (Mailpit locally); `POST /api/auth/verify-otp` activates it, `POST /api/auth/resend-otp` re-sends the code, and `login` rejects an unverified account.
- **`GET /api/photos/{token}` is the one endpoint with no auth at all, on purpose.** An `<img>` tag cannot send a bearer token, so profile photos are served by an unguessable per-upload token instead of the user's id.
- **Every write endpoint validates its body** (`@Valid` plus Bean Validation: required fields, length limits, `@Pattern`-checked enum-like fields, numeric ranges) and a failure comes back as `400` with the real error shape (`timestamp`, `status`, `error`, `message`, `fieldErrors`), not a generic Spring default body.

### Known quirks (still real)

- **No pagination, search or filter** beyond a handful of `GET .../project/{id}`-style lookups. List endpoints return every row the caller may see, unbounded.
- **Full-replace `PUT`, no `PATCH`.** Every update resends the whole resource body including its relations (changing a task's status still means sending its `projectId`, `title`, dates and so on again).
- **Enum-like fields are plain `String`s**, not Java enums (`status`, `priority`, `accountStatus`, and so on). They are validated on write with `@Pattern` using the same allowed values as the Postgres `CHECK` constraint, so an invalid value is a clean `400` before it reaches the database.
- **Authorization is read from the `role_permissions` table** ([database.md](database.md#13-authorization-and-permissions)); an administrator edits it through `PUT /api/roles/{id}/permissions`. `REPORT:GENERATE_REPORTS` is enforced on the server by every endpoint under `/api/reports` ([section 13d](#13d-kpis-and-reports)).
- **`GET /api/tasks/status/{status}`** validates `status`: an unrecognised value returns `400 "Invalid status: X"` (verified 2026-10-06).
- **`GET .../project/{id}`, `.../milestone/{id}`, `.../task/{id}`, `.../user/{id}` lookups** return an empty list for an unknown parent id rather than a `404`: they are plain filtered queries, not "does this parent exist" checks.
- **Not implemented anywhere** (no controller): the reporting tables and views (`report_exports`, `kpi_snapshots`, the SQL views). Calendar, Kanban and Gantt endpoints from the requirements do not exist either: the frontend derives those views from the resource endpoints that do. The KPIs and the seven reports are calculated by `ReportService` ([section 13d](#13d-kpis-and-reports)).

## 3. Auth

Controller: `AuthController` · base `/api/auth`

| Method & path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /api/auth/login` | Public | `{ username, password }` — both required; `username` may also be the **e-mail address** of the account (any letter case) | `200` `{ token, username, role }` (`role` is `"ADMINISTRATOR"`, `"USER"` or `null`) | `401 "Invalid username or password"` (wrong credentials **or** non-`ACTIVE` account); `429` after 5 failures in 15 min per `remoteAddr:username` |
| `POST /api/auth/register` | Public | `{ username (3–50, [A-Za-z0-9._-]), email (valid, ≤255), password (policy), confirmPassword }` | `201` `{ username, email, message }`; emails a 6-digit code | `400` validation; `400 "Username is already taken"`, `"Email is already registered"`, `"Password and confirmation do not match"` |
| `POST /api/auth/verify-otp` | Public | `{ username, otp }` — `otp` must match `\d{6}` | `200` (empty) — account becomes `ACTIVE` | `400` `"This account is already verified"`, `"No verification code found…"`, `"This code has already been used"`, `"…has expired — request a new one"`, `"Too many incorrect attempts…"`, `"Incorrect code — N attempt(s) remaining"`; `404 "User not found"` |
| `POST /api/auth/resend-otp` | Public | `{ username }` | `200` (empty) | `400 "This account is already verified"`; `429 "Please wait Ns before requesting another code"` (60 s cooldown) |

## 4. Users

Controller: `UserController` · base `/api/users`. `UserResponse` fields: `id, fullName, username, email, gender, dateOfBirth, phoneNumber, profilePhotoUrl, positionId, positionName, departmentId, departmentName, role, roleDescription, accountStatus, themePreference, taskNotificationsEnabled, createdAt, updatedAt` (never a password).

| Method & path | Auth | Request | Success | Notes / errors |
|---|---|---|---|---|
| `GET /api/users` | Any user | — | `200 UserResponse[]` | **Scoped:** administrator sees all; others see themselves plus users sharing an active project |
| `GET /api/users/{id}` | Any user (**scoped**) | — | `200 UserResponse` | Visible only to an administrator, the user themself, or someone sharing an active project; **otherwise `404 "User not found"`** — the same as for a missing user. (Before 2026-10-06 any authenticated user could read any user, including email, phone and date of birth.) |
| `GET /api/users/username/{username}` | Any user (**scoped**) | — | `200 UserResponse` | Same visibility rule and `404` as above. Used by the frontend to load the logged-in profile (always allowed: it is the caller's own) |
| `POST /api/users` | Admin | `UserCreateRequest`: `fullName` (≤150), `username` (≤50), `email`, `password` (policy) required; `gender` (≤20), `dateOfBirth`, `phoneNumber` (≤30), `positionId`, `departmentId`, `roleId` (default `USER`; project roles → `400`), `accountStatus` (`ACTIVE`/`INACTIVE`/`SUSPENDED`) optional | `201 UserResponse` | `400` validation; duplicate username/email → `400` with the raw constraint message (see §17) |
| `PUT /api/users/{id}` | Admin | `UserUpdateRequest`: as above but `password` optional (policy applied only if sent), no `PENDING_VERIFICATION` | `200 UserResponse` | `400` if deactivating a sole project owner |
| `DELETE /api/users/{id}` | Admin | — | `204` | `400` if the user is a sole active project owner; FK `RESTRICT` if they manage a project |
| `PUT /api/users/me` | Self | `{ fullName (≤150, required), email (valid, required), gender, dateOfBirth, phoneNumber, positionId, departmentId }` — the last two are chosen from `GET /api/positions` / `/api/departments`; `null` clears | `200 UserResponse` | Cannot change username, role or status. `404 "Position not found"` / `"Department not found"` for an id outside the lists (new entries are administrator-only). It is a full replace: leaving the two ids out clears them |
| `PUT /api/users/me/password` | Self | `{ currentPassword, newPassword (policy), confirmNewPassword }` | `200` (empty) | `400 "Current password is incorrect"`, `"New password and confirmation do not match"` |
| `PUT /api/users/me/photo` | Self | multipart form, part `file` | `200 UserResponse` | `400` if empty, not JPEG/PNG/WEBP/GIF, or > 5 MB (`"Photo is too large (max 5MB)"`) |
| `DELETE /api/users/me/photo` | Self | — | `200 UserResponse` | |
| `PUT /api/users/me/preferences` | Self | `{ themePreference: LIGHT|DARK|SYSTEM, taskNotificationsEnabled: boolean }` — both required | `200 UserResponse` | |
| `GET /api/users/me/permissions` | Self | — | `200 { role, administrator, system: ["RESOURCE:ACTION", …], projects: [{ projectId, projectRole, roleName, grants: ["RESOURCE:ACTION", …] }] }` | What the caller may do: system-wide grants and, per active project, the grants of their project role. The UI uses it to hide controls; the server still checks every request |
| `PUT /api/users/{id}/role` | Admin (`USER:ASSIGN`) | `{ roleId }` | `200 UserResponse` | Gives an account its system role. `400` for a project-only role (`VIEWER`) or when it would remove the last Administrator (`"At least one Administrator is required…"`); `404` unknown user/role |
| `PUT /api/users/{id}/position-department` | Team admin (see note) | `{ positionId, departmentId }` (either may be `null` to clear) | `200 UserResponse` | `403` when targeting yourself (use `PUT /api/users/me`) or when you do not administer a project the target belongs to (administrators are exempt from the second rule, **not** the first) |

*Team admin* = administrator, or someone holding `MEMBER:EDIT` (Project Manager, Team Leader) in a project the target user is also an active member of.

## 5. Roles, positions, departments

| Method & path | Auth | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/roles` | Any user | — | `200 RoleResponse[]` (`id, name, description, scope, projectRole, builtIn`) | Seven rows: system roles `ADMINISTRATOR`, `PROJECT_MANAGER`, `USER`; project roles `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` |
| `GET /api/roles/{id}` | Any user | — | `200 RoleResponse` | `404 "Role not found"` |
| `POST /api/roles` | Admin | `{ name (≤50, required), description (≤255) }` | `201` | duplicate name → raw `400` |
| `PUT /api/roles/{id}` | Admin | same | `200` | ⚠ no protection against renaming a role the code depends on by name |
| `DELETE /api/roles/{id}` | Admin | — | `204` | Built-in roles cannot be deleted (`400`); fails with an FK error while users reference the role |
| `GET /api/permissions/matrix` | Admin (`ROLE:VIEW`) | — | `200 { permissions: [{ code, description }], resources: [{ name, label }], roles: [{ role: RoleResponse, locked, grants: [{ scope, resource, permission }] }] }` | Everything the Role & Permission screen needs in one call. `locked` is true for the Administrator |
| `PUT /api/roles/{id}/permissions` | Admin (`ROLE:EDIT`) | `{ grants: [{ scope: SYSTEM\|PROJECT, resource, permission }] }` — the role's **complete** new grant list | `200` the role's `{ role, locked, grants }` | Replaces all grants in one transaction; effective immediately. `403` for the Administrator role; `400` for an unknown scope/resource/permission, a scope the role does not have, or a project role that would lose `PROJECT:VIEW` |
| `GET /api/positions` | Any user | — | `200 PositionResponse[]` (`id, name, description`) | |
| `POST /api/positions` | Admin | `{ name (≤100, required), description (≤255) }` | `201` | `400 "A position named \"X\" already exists"` (case-insensitive) |
| `GET /api/departments` | Any user | — | `200 DepartmentResponse[]` | |
| `POST /api/departments` | Admin | same shape | `201` | same duplicate rule |

There are no update or delete endpoints for positions or departments.

## 6. Projects

Controller: `ProjectController` · base `/api/projects`. `ProjectResponse`: `id, projectCode, name, description, startDate, endDate, manager (UserResponse), priority, status, progress, createdAt, updatedAt`.

| Method & path | Auth | Request | Success | Notes / errors |
|---|---|---|---|---|
| `GET /api/projects` | Any user | — | `200 ProjectResponse[]` | administrator: all; others: projects they are an **active** member of |
| `GET /api/projects/{id}` | Member | — | `200` | `404` for non-members |
| `POST /api/projects` | System `PROJECT:CREATE` (Project Manager, administrator) | `ProjectRequest`: `name` (≤200) ★, `startDate` ★, `endDate` ★; optional `projectCode` (≤30), `description`, `managerId`, `priority` (`LOW/MEDIUM/HIGH/CRITICAL`), `status` (`PLANNING/IN_PROGRESS/ON_HOLD/COMPLETED/CANCELLED`), `progress` (0–100, ignored) | `201` | Code is generated (`PRJ-####`) when omitted/blank; caller becomes manager and `OWNER`; `managerId` honoured only for administrators. **`409 "Project code already exists."`** for a duplicate code; `400` if `endDate < startDate` — message is the raw `new row for relation "projects" violates check constraint "projects_check"` (verified live) |
| `PUT /api/projects/{id}` | Manager | `ProjectRequest` (full replace; blank `projectCode` keeps the current one) | `200` | `409` if the code is taken by another project; `403` without `PROJECT:EDIT` (Team Member, Viewer) |
| `DELETE /api/projects/{id}` | Owner (`PROJECT:DELETE`) | — | `204` | cascades to members, milestones, tasks and below. A project with a single owner can be deleted (fixed by `V10`) |

★ required.

## 7. Project members and invitations

Controller: `ProjectMemberController` · base `/api/project-members`. `ProjectMemberResponse`: `id, project, user, projectRole, status, invitedById, invitedByName, respondedAt, joinedAt`. Workflow and rules: [users-and-projects.md](users-and-projects.md#4-invitations).

| Method & path | Auth | Request | Success | Notes / errors |
|---|---|---|---|---|
| `GET /api/project-members` | Any user | — | `200 ProjectMemberResponse[]` | **Active** members of projects the caller can see |
| `GET /api/project-members/{id}` | Member of that row's project | — | `200` | `404` otherwise |
| `GET /api/project-members/project/{projectId}` | Member | — | `200` | active members only |
| `GET /api/project-members/user/{userId}` | Any user (**scoped**) | — | `200` | Administrator: every row. Others: only the user's **`ACTIVE`** memberships in projects the caller is an active member of (an unrelated user gets `[]`). Before 2026-10-06 it returned every project and status to anyone |
| `GET /api/project-members/project/{projectId}/invitations` | Manager | — | `200` pending rows | |
| `GET /api/project-members/project/{projectId}/invitations/count` | Manager | — | `200 { "count": n }` | counts `PENDING` rows |
| `GET /api/project-members/project/{projectId}/invitable-users?q=&limit=` | Manager | `q` text (default `""`), `limit` (default 10, clamped 1–20) | `200` `[{ id, fullName, username, positionName, profilePhotoUrl }]` | `ACTIVE` accounts only; excludes the caller and anyone `ACTIVE`/`PENDING` on the project; substring match on username or full name; ordered by full name |
| `POST /api/project-members/invite` | Manager (`MEMBER:CREATE`) | `{ projectId, username }` required; `projectRole` (`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`) optional, default `MEMBER` | `201` (`status: PENDING`) | `403 "You do not have permission to invite or add people to this project"` (`projectRole: OWNER` → `400 "A project has exactly one owner…"`); `404 "No user found with that username"`; `400` `"You cannot invite yourself"`, `"<u> has an inactive account and can't be added to a project"`, `"…is already a member of this team"`, `"An invitation is already pending for …"`; creates a `TEAM_INVITATION` notification |
| `POST /api/project-members/project/{projectId}/accept` | Self (invitee) | — | `200` (`status: ACTIVE`) | `404 "No invitation found"`; `400 "This invitation is no longer pending"` |
| `POST /api/project-members/project/{projectId}/decline` | Self (invitee) | — | `200` (`status: DECLINED`) | same errors |
| `POST /api/project-members` | Manager | `{ projectId, userId }` required; `projectRole` (`OWNER/ADMIN/MEMBER/VIEWER`) optional | `201` (immediately `ACTIVE`) | `projectRole` `OWNER` is refused (`400 "…exactly one owner…"`); `400` for an inactive account; duplicate (project, user) → raw `400` |
| `PUT /api/project-members/{id}` | Manager (of the row's project; see the role rules) | same body — `projectId` and `userId` must match the row | `200` | Only the **role** can change: a different `projectId`/`userId` → `400 "A membership's project and user cannot be changed — remove it and add a new one"`; `400` if it would demote the last active owner **Setting the role to `OWNER` transfers ownership** (needs `PROJECT:ASSIGN`): the previous owner becomes `ADMIN`, the project's manager changes; `400` if the person cannot own projects (not a Project Manager or Administrator) or is not an active member; demoting or removing the owner directly → `400 "…Transfer ownership…"` |
| `DELETE /api/project-members/{id}` | Manager | — | `204` | `400` if it would remove the last active owner; also removes a `PENDING` row (a way to cancel an invitation) |

## 8. Milestones

Controller: `MilestoneController` · base `/api/milestones`. `MilestoneResponse`: `id, project, title, description, dueDate, status, progress, createdAt, updatedAt`.

| Method & path | Auth | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/milestones` | Any user | — | `200[]` | scoped to visible projects |
| `GET /api/milestones/{id}` | Member | — | `200` | |
| `GET /api/milestones/project/{projectId}` | Member | — | `200[]` | |
| `POST /api/milestones` | Manager | `{ projectId ★, title (≤200) ★, dueDate ★, description, status (PENDING/IN_PROGRESS/COMPLETED), progress (0–100, ignored) }` | `201` | `400` if `dueDate` is outside the project's dates |
| `PUT /api/milestones/{id}` | Manager (current project; **and the target project if `projectId` changes**) | same | `200` | `403` when moving a milestone into a project the caller doesn't manage |
| `DELETE /api/milestones/{id}` | Manager | — | `204` | tasks linked to it keep existing (`milestone_id` → NULL) |

## 9. Tasks

Controller: `TaskController` · base `/api/tasks`. `TaskResponse`: `id, project, milestone, title, description, priority, status, startDate, dueDate, estimatedHours, actualHours, progress, completedAt, createdBy, createdAt, updatedAt, totalSubtasks, completedSubtasks, overdue, blocked, blockingTaskTitles, approver, approvalStatus, approvalRequestedBy, approvalRequestedAt` (`approvalStatus` is the newest approval request: `PENDING`, `APPROVED`, `CHANGES_REQUESTED`, `REJECTED`, `WITHDRAWN`, or `null` when never submitted).

| Method & path | Auth | Request | Success | Notes / errors |
|---|---|---|---|---|
| `GET /api/tasks` | Any user | — | `200[]` | administrator: all; others: tasks in their active projects |
| `GET /api/tasks/{id}` | Member | — | `200` | `404` |
| `GET /api/tasks/project/{projectId}` | Member | — | `200[]` | |
| `GET /api/tasks/milestone/{milestoneId}` | Member | — | `200[]` | `404 "Milestone not found"` |
| `GET /api/tasks/status/{status}` | Any user | — | `200[]` | `400 "Invalid status: X"` for an unknown status (verified live) |
| `POST /api/tasks` | Content | `{ projectId ★, title (≤200) ★, startDate ★, dueDate ★, description, milestoneId, priority (LOW/MEDIUM/HIGH/URGENT), status (TODO/IN_PROGRESS/IN_REVIEW/COMPLETED/CANCELLED), estimatedHours (≥0), progress (0–100), createdById }` | `201` | `403` for `VIEWER`/non-members; `400` for `due < start` (raw `new row for relation "tasks" violates check constraint "tasks_check"`), `due > project end` (clean sentence from the trigger), milestone from another project; `createdById` is honoured only for administrators; writes `TASK_CREATED` |
| `PUT /api/tasks/{id}` | Manager (`TASK:EDIT`), **or** an assignee with `TASK_STATUS:EDIT` (restricted) | same body | `200` | Manager: every field applied; **if `projectId` changes the caller must also be allowed to edit tasks in the target project (`403` otherwise)**. Assignee (Project Manager/Team Leader/Team Member): only `status` and `progress` applied (others, including `projectId`, ignored); a `VIEWER` → `403`; not assigned → `403 "You are not assigned to this task"`. **Setting `COMPLETED` needs `TASK:APPROVE`** (Project Manager, Team Leader, administrator) **and follows the approval rules of [§9b](#9b-task-approval)** (it is recorded as the approver's approval; `403` for your own work or when someone else is the named approver): otherwise `403 "Only a Project Manager or Team Leader can approve a task as completed. Move it to In Review so it can be approved"`. `400 "Complete all subtasks before marking this task as done."`; dependency-gate violations → `400`. Logs status/priority/due-date changes; notifies assignees on a status change |
| `DELETE /api/tasks/{id}` | Manager | — | `204` | writes `TASK_DELETED` |

### 9b. Task approval

Controller: `TaskApprovalController`. IN_REVIEW is only a status; approval is a separate decision (assignment-brief.md B3.8). `TaskApprovalResponse`: `id, taskId, taskTitle, projectId, projectName, requestedBy, requestedAt, decidedBy, decidedAt, decision, comment`.

| Method & path | Auth | Request | Success | Notes / errors |
|---|---|---|---|---|
| `POST /api/tasks/{id}/approval/submit` | `TASK:EDIT`, or an assignee with `TASK_STATUS:EDIT` | — | `201 TaskApprovalResponse` (`PENDING`) | moves the task `IN_PROGRESS` → `IN_REVIEW`; `400 "Only a task that is in progress can be submitted for review"`; `403 "You are not assigned to this task"`; notifies the named approver, otherwise every active member who may approve |
| `POST /api/tasks/{id}/approval/decision` | `TASK:APPROVE` (see rules) | `{ decision ★ (APPROVED / CHANGES_REQUESTED / REJECTED), comment (≤1000), nextStatus (IN_PROGRESS / CANCELLED) }` | `200 TaskApprovalResponse` | `APPROVED` completes the task (progress 100; `400 "Complete all subtasks…"` while one is open); `CHANGES_REQUESTED` → `IN_PROGRESS`, comment required; `REJECTED` → `nextStatus` (required) with a comment (required). `400 "This task has no pending approval request"`. `403` when the caller lacks `TASK:APPROVE`, when another person is the named approver (the Owner and Administrators may still decide), or for your own work (you asked for the review or are assigned to the task; the Owner and Administrators may). Notifies the requester |
| `GET /api/tasks/{id}/approvals` | Member | — | `200[]` newest first | every request and decision on the task |
| `PUT /api/tasks/{id}/approver` | `TASK:ASSIGN` | `{ approverId }` (`null` clears) | `200 TaskResponse` | `400 "<name> cannot approve tasks in this project"` (not an active member who holds `TASK:APPROVE`); notifies the new approver when a request is already waiting |
| `GET /api/approvals/pending` | Any user | — | `200[]` oldest first | the open requests the caller may decide (the approver's inbox) |

## 10. Task assignees

Controller: `TaskAssigneeController` · base `/api/task-assignees`. `TaskAssigneeResponse`: `id, task (TaskResponse), user, assignedAt`.

| Method & path | Auth | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/task-assignees` | Any user | — | `200[]` | scoped to visible projects (used by the *My Tasks* filter) |
| `GET /api/task-assignees/{id}` | Member | — | `200` | |
| `GET /api/task-assignees/task/{taskId}` | Member | — | `200[]` | |
| `GET /api/task-assignees/user/{userId}` | Any user | — | `200[]` | filtered to the caller's visible projects |
| `POST /api/task-assignees` | Manager | `{ taskId ★, userId ★ }` | `201` | `400` if the user is not an active member / not `ACTIVE`, or already assigned; notifies the assignee; writes `TASK_ASSIGNED` |
| `DELETE /api/task-assignees/{id}` | Manager | — | `204` | writes `TASK_UNASSIGNED` |

## 11. Task dependencies

Controller: `TaskDependencyController` · base `/api/task-dependencies`. `TaskDependencyResponse`: `{ task, dependsOnTask }` (both `TaskResponse`).

| Method & path | Auth | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/task-dependencies` | Any user | — | `200[]` | scoped by the dependent task's project |
| `GET /api/task-dependencies/task/{taskId}` | Member | — | `200[]` | what this task depends on |
| `GET /api/task-dependencies/depends-on/{taskId}` | Member | — | `200[]` | tasks that depend on this one |
| `POST /api/task-dependencies` | Manager (dependent task's project) | `{ taskId ★, dependsOnTaskId ★ }` | `201` | `400` for a self-dependency, a cycle, or an active task with an unfinished prerequisite |
| `DELETE /api/task-dependencies?taskId=&dependsOnTaskId=` | Manager | query parameters (both required) | `204` | `400` if a parameter is missing |

## 12. Subtasks

Controller: `SubtaskController` · base `/api/subtasks`. `SubtaskResponse`: `id, taskId, title, assigneeId, assigneeName, dueDate, status, createdAt, updatedAt`.

| Method & path | Auth | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/subtasks/task/{taskId}` | Member | — | `200[]` ordered by id | |
| `POST /api/subtasks` | Content | `{ taskId ★, title (≤200) ★, assigneeId, dueDate, status (TODO/IN_PROGRESS/COMPLETED) }` | `201` | `403` for a `VIEWER` (changed 2026-10-06; reading is still allowed); assignee must be an active, `ACTIVE` project member; writes `SUBTASK_ADDED` |
| `PUT /api/subtasks/{id}` | Content | same | `200` | writes `SUBTASK_COMPLETED` on first completion; may auto-promote the task `TODO → IN_PROGRESS` |
| `DELETE /api/subtasks/{id}` | Content | — | `204` | writes `SUBTASK_DELETED` |

## 12b. Checklist items

Controller: `ChecklistItemController` · base `/api/checklist-items`. `ChecklistItemResponse`: `id, taskId, content, completed, sortOrder, createdById, createdByName, createdAt`. Not subtasks: no assignee or due date, just done or not (assignment-brief.md B1.6). They count toward the task's progress together with its subtasks (D-07).

| Endpoint | Access | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/checklist-items/task/{taskId}` | Member | — | `200[]` in list order | `404` outside the caller's projects |
| `POST /api/checklist-items` | `CHECKLIST_ITEM:CREATE` (Owner, Team Leader, Team Member) | `{ taskId ★, content ★ (≤300) }` | `201` | the item goes last; `403` for a Viewer; `400` blank content |
| `PUT /api/checklist-items/{id}` | `CHECKLIST_ITEM:EDIT`, and for a Team Member only on tasks assigned to them | `{ content ★, completed }` (omit `completed` to keep it) | `200` | `403 "You can only change the checklist of tasks assigned to you"` |
| `DELETE /api/checklist-items/{id}` | `CHECKLIST_ITEM:DELETE` (Owner, Team Leader), or the person who added it | — | `204` | `403 "You can only delete checklist items you added"` |

## 12c. Attachments

Controller: `AttachmentController` · base `/api/attachments`. `AttachmentResponse`: `id, taskId, projectId, fileName, mimeType, fileSize, uploadedById, uploadedByName, uploadedAt` (never the bytes). A file belongs to **one** task or **one** project.

| Endpoint | Access | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/attachments/task/{taskId}` | Member | — | `200[]` newest first | `404` outside the caller's projects |
| `GET /api/attachments/project/{projectId}` | Member | — | `200[]` newest first | files attached to the project itself |
| `POST /api/attachments` | `ATTACHMENT:CREATE` (Owner, Team Leader, Team Member) | multipart: part `file ★`, and exactly one of `taskId` / `projectId` | `201 AttachmentResponse` | `400` for an empty file, both or neither target, a type that is not allowed, content that does not match the type, more than 10 MB (`"The file is too large (max 10 MB)"`), or 25 files already on the task / project; `403` for a Viewer |
| `GET /api/attachments/{id}/download` | Member | — | `200` the bytes | always `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cache-Control: private, no-store`; `404` outside the caller's projects |
| `DELETE /api/attachments/{id}` | the uploader, or `ATTACHMENT:DELETE` (Owner, Team Leader) | — | `204` | `403 "You can only delete files you uploaded"` |

Allowed types (`util/FileTypeGuard`): png, jpg, jpeg, gif, webp, pdf, txt, md, csv, json, doc, docx, xls, xlsx, ppt, pptx, odt, ods, odp, zip. The stored MIME type comes from the extension, never from the client; the first bytes must match the type; folder parts and odd characters are removed from the name. Limits are `app.attachments.max-size-bytes` and `app.attachments.max-per-target` (and `spring.servlet.multipart.*`, 10 MB) in `application.properties`.

## 13. Comments

Controller: `CommentController` · base `/api/comments`. `CommentResponse`: `id, taskId, userId, authorName, parentCommentId, message, createdAt, updatedAt`.

| Method & path | Auth | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/comments/task/{taskId}` | Member | — | `200[]` oldest first | |
| `POST /api/comments` | Content | `{ taskId ★, message (≤4000) ★, parentCommentId }` | `201` | `403` for a `VIEWER` (changed 2026-10-06; reading is still allowed); parent must exist (`404`), same-task is not checked; no notification, no activity entry |
| `PUT /api/comments/{id}` | author only | `{ taskId ★, message ★ }` | `200` | `403 "You do not have permission…"` for anyone else, including administrators |
| `DELETE /api/comments/{id}` | author, or Manager | — | `204` | replies are deleted too |


## 13b. Work logs (time tracking)

Controller: `WorkLogController` · base `/api/work-logs`. `WorkLogResponse`: `id, taskId, userId, authorName, workDate, hoursWorked, description, createdAt`. A task's `actualHours` (in `TaskResponse`) is the sum of these.

| Endpoint | Access | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/work-logs/task/{taskId}` | Member | — | `200[]` newest work date first | `404` if the task does not exist or the caller cannot see its project |
| `POST /api/work-logs` | Content | `{ taskId ★, workDate ★ (not in the future), hoursWorked ★ (0.01–24), description (≤500) }` | `201` | logs time for **the caller**; `403` for a `VIEWER`; `400` for hours ≤ 0 or > 24, a future date or a missing field; `404` for an unknown task. No activity entry or notification |
| `DELETE /api/work-logs/{id}` | author, or Manager | — | `204` | `403 "You can only delete your own time entries"` for anyone else; `404` outside the caller's projects |

There is no update endpoint.

## 13c. Dashboard and manager views

Controllers: `DashboardController`, `TeamViewsController`. Everything here is calculated on the server from the projects and tasks the caller may see, so every client shows the same figures. "Delayed" (project) and "overdue" (task) are derived from dates and statuses, never stored (assignment-brief.md B1.3).

| Endpoint | Access | Success | Notes |
|---|---|---|---|
| `GET /api/dashboard/stats` | Any user (scoped) | `200 { projects: { total, planning, active, onHold, completed, cancelled, delayed, averageProgress }, tasks: { total, todo, inProgress, inReview, completed, cancelled, overdue }, delayedProjects: [{ id, projectCode, name, endDate, daysDelayed, progress, status }] }` | `active` = `IN_PROGRESS` only; `delayed` overlaps the status counts; `averageProgress` leaves out cancelled projects; at most 5 delayed projects, most late first; an administrator sees everything |
| `GET /api/projects/{id}/team-tasks` | `TASK:ASSIGN` in the project (Owner, Team Leader, Administrator) | `200 { projectId, projectName, members: [{ user, projectRole, assigned, completed, active, overdue, averageProgress, tasks: [TeamTask] }], unassigned: [TeamTask] }` | `TeamTask`: `id, title, status, priority, startDate, dueDate, progress, overdue, estimatedHours, assignmentId` (the `task_assignees` row, to reassign). Active members except Viewers; cancelled tasks left out; `403` for a Team Member, `404` for a stranger |
| `GET /api/projects/{id}/workload` | same | `200 { projectId, projectName, teamSize, averageOpenTasks, averageEstimatedHours, members: [{ user, assigned, active, overdue, estimatedHours, actualHours, level }] }` | `level` is `OVERLOADED`, `UNDERLOADED` or `BALANCED` against the team average (D-13). `assigned` = non-cancelled tasks, `active` = in progress, `overdue` = past due and not finished, `estimatedHours` = of unfinished tasks, `actualHours` = hours this person logged on the team's tasks. An Owner or Team Leader is listed only once work is assigned to them |
| `GET /api/workload` | needs `TASK:ASSIGN` in at least one project | `200` the same shape across every project the caller manages (`projectId` null) | `403` for someone who manages none |

`ProjectResponse` also carries `delayed` and `daysDelayed` (the end date passed and the project is neither `COMPLETED` nor `CANCELLED`).

**Role rules of `PUT /api/project-members/{id}`** (B3.7, B3.9): nobody changes their own project role (`403`; the Owner stepping down is told `400 "Transfer ownership"` first); the Owner and an Administrator may set any role (setting `OWNER` is the transfer); a Team Leader may only make a Team Member a Team Member or a Viewer and cannot change the role of the Owner or another Team Leader (`403`).

## 13d. KPIs and reports

Controller: `ReportController` (assignment-brief.md B8, D-12). Every endpoint is a `GET`, answers JSON and is calculated on the server from the projects the caller may report on. Dates are ISO (`yyyy-MM-dd`). Every response starts with `scope: { projectId, projectName, projects, from, to, generatedAt }`.

**Access (all endpoints).** An Administrator reports on every project; anyone else on the projects where they hold `REPORT:GENERATE_REPORTS` (Owner, Team Leader, and a Project Manager through the Owner role). Nobody reportable → `403 "You do not have permission to generate reports"`. A `projectId` outside the reportable set → `404` for a stranger, `403` for a member without the right. Unknown `status` / `priority` / `groupBy`, a reversed date range or a missing required parameter → `400`.

| Endpoint | Parameters | Success | Notes |
|---|---|---|---|
| `GET /api/reports/kpis` | `projectId` (optional: one project, else all) | `200 { scope, projectCompletionRate, taskCompletionRate, overdueRate, averageTaskCompletionDays, onTimeCompletionRate, basis }` | Rates are 0–100 with one decimal, `null` when the denominator is empty. `basis` holds the counts used (`projects, completedProjects, cancelledProjects, tasks, completedTasks, cancelledTasks, overdueTasks, completedOnTime`). Formulas: B8 |
| `GET /api/reports/project` | `projectId` (**required**) | `200 { scope, project, description, team: [{ user, projectRole }], milestones: [{ id, title, dueDate, status, progress }], taskCounts: { total, todo, inProgress, inReview, completed, cancelled, overdue }, upcomingDeadlines: [TaskRow] }` | Upcoming = open tasks due in the next 14 days, plus the overdue ones |
| `GET /api/reports/tasks` | `projectId`, `assigneeId`, `status`, `priority`, `dueFrom`, `dueTo` | `200 { scope, rows: [TaskRow] }` | `TaskRow`: `id, title, projectId, projectName, assignees[], priority, status, progress, startDate, dueDate, estimatedHours, completedAt, daysOverdue` |
| `GET /api/reports/project-status` | `status` (a project status or `DELAYED`), `ownerId`, `from`, `to` | `200 { scope, groups: [{ key, label, count, projects: [ProjectRow] }] }` | Groups: `PLANNING, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED, DELAYED`; `DELAYED` is calculated and overlaps the others. A date range keeps projects whose period overlaps it |
| `GET /api/reports/task-completion` | `from`, `to` (**required**), `groupBy` = `project` \| `member` \| `month` (**required**), `projectId` | `200 { scope, groupBy, overall, groups, completedTasks: [TaskRow] }` | A group is `{ key, label, total, completed, percentage }`; the scope is the non-cancelled tasks due in the range |
| `GET /api/reports/overdue` | `projectId`, `assigneeId`, `priority` | `200 { scope, rows: [TaskRow] }` | Most overdue first; `daysOverdue` > 0 |
| `GET /api/reports/team-performance` | `projectId`, `from`, `to` (due range) | `200 { scope, members: [{ user, assigned, completed, todo, inProgress, inReview, overdue, completionRate }] }` | Over each member's non-cancelled tasks; `todo` is the B1.3 "pending" |
| `GET /api/reports/workload` | `projectId` | `200 { scope, workload }` | `workload` has the shape of `GET /api/projects/{id}/workload` ([section 13c](#13c-dashboard-and-manager-views)) |

Export (PDF / Excel) is optional and not built.

## 14. Activity logs

| Method & path | Auth | Success | Notes |
|---|---|---|---|
| `GET /api/activity-logs/recent?limit=` | Any user (scoped) | `200 ActivityLogResponse[]` newest first (`limit` default 10, 1–50; entries carry `projectId` and `projectName`) | the latest events across the caller's projects (all projects for an administrator): the dashboard's "Recent activity" |
| `GET /api/activity-logs/project/{projectId}?limit=` | Member | `200 ActivityLogResponse[]` newest first (`limit` default 50, 1–200) | the project feed: project created / updated / completed, milestone created / completed, task, subtask and approval events, comments, files; `404` for a stranger. Each entry has `taskId` and `taskTitle` when it is about a task |
| `GET /api/activity-logs/task/{taskId}` | Member | `200 ActivityLogResponse[]` (`id, action, description, userId, userName, taskId, taskTitle, createdAt`), newest first | Read-only; entries are written by services, never posted. `TASK_DELETED` entries are not returned by any endpoint |

## 15. Notifications

Controller: `NotificationController` · base `/api/notifications` · all *Self*. Details: [notifications.md](notifications.md).

| Method & path | Success | Notes |
|---|---|---|
| `GET /api/notifications` | `200 NotificationResponse[]` newest first | `id, type, title, message, projectId, projectName, taskId, taskTitle, read, createdAt` |
| `GET /api/notifications/unread-count` | `200 { "count": n }` | |
| `PUT /api/notifications/{id}/read` | `200` | `404` if not yours |
| `POST /api/notifications/read-all` | `204` | |
| `DELETE /api/notifications/{id}` | `204` | `404` if not yours |

## 16. Photos and health

| Method & path | Auth | Success | Notes |
|---|---|---|---|
| `GET /api/photos/{token}` | **Public** | `200` image bytes with the stored content type | `404 "Photo not found"` for an unknown token or a non-UUID. Tokens are random per upload |
| `GET /api/health` | **Public** | `200` plain text `Backend API is running` | Used by the Docker healthcheck |

## 17. Error responses and status codes

Which codes this API actually returns, and from where (`GlobalExceptionHandler` unless noted):

| Code | When | Body message (examples) |
|---|---|---|
| **400** | Bean Validation failure | `"One or more fields are invalid"` + `fieldErrors`; an enum-like `@Pattern` failure reads `must match "LOW\|MEDIUM\|HIGH\|URGENT"` |
| 400 | `IllegalArgumentException` raised by services | the specific sentence (e.g. `"Username is already taken"`) |
| 400 | database constraint or trigger violation | for triggers: the trigger's own sentence with the `ERROR:` prefix stripped (e.g. `"Task due_date (2099-01-01) cannot be later than its project end_date (2026-11-30)"`); for `CHECK` constraints and unique constraints other than the project code: the **raw** PostgreSQL text, e.g. `new row for relation "tasks" violates check constraint "tasks_check"` or `duplicate key value violates unique constraint "idx_users_username_lower"` ⚠ (all verified live) |
| 400 | path value of the wrong type; missing request parameter; unreadable JSON; upload too large; multipart request without the file | `"Invalid value for 'id'"`, `"Malformed request body"`, `"File is too large"`, `"No file was uploaded"` |
| **401** | no/invalid/expired token, **or a token whose account is no longer `ACTIVE`** (suspended, inactive, pending, deleted) — from Spring Security, **empty body** | — |
| 401 | login failed (any reason) | `"Invalid username or password"` |
| **403** | `AccessDeniedException` (service checks) and `@PreAuthorize` failures | always the generic `"You do not have permission to perform this action"` |
| **404** | `NotFoundException`, including project access for non-members; a path no controller serves | `"Project not found"`, `"Task not found"`, `"User not found"`, …; `"Resource not found"` for an unknown path |
| **409** | `ConflictException`, and the safety net for the `projects.project_code` unique constraint — **the only use of 409** | `"Project code already exists."` |
| **429** | login lockout; OTP resend cooldown | `"Too many failed login attempts. Try again later."`, `"Please wait Ns before requesting another code"` |
| **500** | any unhandled exception | `"An unexpected error occurred"` (details only in `backend/logs/log.txt`) |

Notes: `403` bodies never say *why*, so a client cannot distinguish "wrong role" from "not assigned". `404` instead of `403` is deliberate for project and notification lookups so existence is not revealed.

## 18. The legacy `openapi.yaml`

`api/openapi.yaml` is an OpenAPI 3.0.3 file written early in the project. Reviewed on 2026-10-08 against the controllers and DTOs, it:

- documents **57 of the 91 endpoints** (63%) and no documented endpoint has been removed;
- is missing 34 endpoints: registration and OTP, profile photo and preferences, positions and departments, comments, subtasks, invitations, activity logs, notification delete and work logs;
- names the roles `PROJECT_MANAGER`, `TEAM_LEADER` and `TEAM_MEMBER` as global roles in 23 places with the old per-endpoint rules, so its authorization text is wrong (the names exist again since 2026-10-08, but the rules differ);
- has six drifted schemas (`TaskResponse`, `ProjectMemberResponse`, `UserResponse`, `UserCreateRequest`, `UserUpdateRequest`, `SelfProfileUpdateRequest`), 22 DTOs with no schema, and no `operationId` on any operation.

It is **not maintained**. This page and [backend.md](backend.md) are the documentation to keep current; the rule is "change behaviour, update `docs/` in the same pull request" ([README.md](README.md#keeping-the-documentation-current)). If a machine-readable contract is wanted again, generate it from the code (for example with springdoc) instead of hand-editing the YAML, so it cannot drift.
