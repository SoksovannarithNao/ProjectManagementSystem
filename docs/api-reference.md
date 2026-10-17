# API Reference

All **129 endpoints** exposed by the 26 controllers in `backend/src/main/java/backend/controller/`, derived directly from the code (the original 84 were checked against the running application on 2026-10-06; the later ones were added and checked as they were built, and on 2026-10-12 every `@GetMapping` / `@PostMapping` / `@PutMapping` / `@DeleteMapping` was matched against this page: none is missing). **This page is the single source of truth for the API.** The folder `api/` also holds `openapi.yaml`, an older machine-readable contract that documents only 58 of the 129 endpoints and still uses removed role names; it is no longer maintained (see [section 18](#18-the-legacy-openapiyaml)). The former `api/README.md` was removed and its content now lives in [section 2](#2-conventions) below.

Contents: [1 Getting started](#1-getting-started) · [2 Conventions](#2-conventions) · [3 Auth](#3-auth) · [4 Users](#4-users) · [5 Roles, positions, departments](#5-roles-positions-departments) · [6 Projects](#6-projects) · [7 Project members and invitations](#7-project-members-and-invitations) · [8 Milestones](#8-milestones) · [9 Tasks](#9-tasks) · [9b Task approval](#9b-task-approval) · [10 Assignees](#10-task-assignees) · [11 Dependencies](#11-task-dependencies) · [12 Subtasks](#12-subtasks) · [12b Checklist items](#12b-checklist-items) · [12c Attachments](#12c-attachments) · [13 Comments](#13-comments) · [13b Work logs](#13b-work-logs-time-tracking) · [13c Dashboard and manager views](#13c-dashboard-and-manager-views) · [13d KPIs and reports](#13d-kpis-and-reports) · [14 Activity](#14-activity-logs) · [14b Audit log](#14b-audit-log) · [15 Notifications](#15-notifications) · [16 Photos and health](#16-photos-and-health) · [17 Errors](#17-error-responses-and-status-codes) · [18 Legacy openapi.yaml](#18-the-legacy-openapiyaml)

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

**Authentication.** Everything except the endpoints marked *Public* needs `Authorization: Bearer <JWT>`. Missing, malformed or expired token → `401` with an empty body; the browser then asks `POST /api/auth/refresh` for a new one (section 3).

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

**Paging is optional (since 2026-10-14).** `GET /api/projects`, `GET /api/tasks` and `GET /api/notifications` take `page` (from 0) and `size` (1 to 200) and then answer `{ items, total, page, size }` instead of the whole list; without them they answer the whole list, as before. Only the project and task lists take search, filter and sort parameters ([section 6](#6-projects), [section 9](#9-tasks)), and the task list also takes the quick `view`, `unassigned` and `groupBy` (the Tasks page reads it a page at a time, 2026-10-14); the other query parameters in the API are `q` and `limit` on the invitable-user search and `taskId`/`dependsOnTaskId` on dependency delete. Lists are scoped to what the caller may see, and a search or filter only narrows that.

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
- **Authorization is a role × resource × action matrix, project-scoped.** System-wide actions (users, roles, the matrix, positions/departments, creating a project) use `@PreAuthorize("@permissions.require(...)")`; everything else is checked in service code against the grants of the caller's system role plus the role they hold in *that* project (`OWNER` / `ADMIN` / `MEMBER` / `VIEWER`). `PUT /api/tasks/{id}` is the ownership-scoped exception on top: a holder of `TASK:EDIT` can edit any task in full, anyone else can call it only for a task they are assigned to (`403` otherwise) and then only `status` and `progress` take effect; completing a task needs `TASK:APPROVE`. Per-resource policy: [backend.md](backend.md#security); the matrix: [authentication-authorization.md](authentication-authorization.md#52-project-scope-matrix).
- **Login rate limiting.** `POST /api/auth/login` returns `429 Too Many Requests` after 5 failed attempts within 15 minutes for the same `clientAddress:<what was typed>` key (a username or an e-mail address, counted separately; in-memory, resets on restart; a successful login clears the counter). Behind the frontend's nginx the client address is the one nginx saw (it sends `X-Forwarded-For: $remote_addr`, and a header from the client is replaced), so one client cannot lock a name for another.
- **Administrator second step.** With `ADMIN_2FA_ENABLED=true` (default `false`), `POST /api/auth/login` for an `ADMINISTRATOR` answers `202` and e-mails a 6-digit code (purpose `LOGIN_2FA`, same expiry, attempt and cooldown rules as the registration code); the session starts only at `POST /api/auth/login/verify`. A code sent less than the resend cooldown ago and still unused is kept, not replaced. If the e-mail cannot be handed to the mail provider the answer is `503 "The code could not be e-mailed right now. Try again in a moment."` ([ADR-0016](adr/0016-admin-two-factor-and-https-mail.md)).
- **Self-registration is a separate public flow.** `POST /api/auth/register` creates a `PENDING_VERIFICATION` account and emails an OTP (Mailpit locally); `POST /api/auth/verify-otp` activates it, `POST /api/auth/resend-otp` re-sends the code, and `login` rejects an unverified account.
- **`GET /api/photos/{token}` is the one endpoint with no auth at all, on purpose.** An `<img>` tag cannot send a bearer token, so profile photos are served by an unguessable per-upload token instead of the user's id.
- **Every write endpoint validates its body** (`@Valid` plus Bean Validation: required fields, length limits, `@Pattern`-checked enum-like fields, numeric ranges) and a failure comes back as `400` with the real error shape (`timestamp`, `status`, `error`, `message`, `fieldErrors`), not a generic Spring default body.

### Known quirks (still real)

- **Paging, search and filter exist only on the project, task and notification lists** (see above); every other list endpoint returns every row the caller may see, unbounded.
- **Full-replace `PUT`, no `PATCH`.** Every update resends the whole resource body including its relations (changing a task's status still means sending its `projectId`, `title`, dates and so on again).
- **Enum-like fields are plain `String`s**, not Java enums (`status`, `priority`, `accountStatus`, and so on). They are validated on write with `@Pattern` using the same allowed values as the Postgres `CHECK` constraint, so an invalid value is a clean `400` before it reaches the database.
- **Authorization is read from the `role_permissions` table** ([database.md](database.md#13-authorization-and-permissions)); an administrator edits it through `PUT /api/roles/{id}/permissions`. `REPORT:GENERATE_REPORTS` is enforced on the server by every endpoint under `/api/reports` ([section 13d](#13d-kpis-and-reports)). `PUT /api/roles/{id}/permissions` also refuses a `SYSTEM` grant on a project-level resource (only `PROJECT`, `REPORT`, `USER`, `ROLE`, `LOOKUP` are allowed) and *create projects* (`SYSTEM:PROJECT:CREATE`) for an extra role.
- **`GET /api/tasks/status/{status}`** validates `status`: an unrecognised value returns `400 "Invalid status: X"` (verified 2026-10-06).
- **`GET .../project/{id}`, `.../milestone/{id}`, `.../task/{id}`, `.../user/{id}` lookups** return an empty list for an unknown parent id rather than a `404`: they are plain filtered queries, not "does this parent exist" checks.
- **Not implemented anywhere** (no controller): the reporting tables and views (`report_exports`, `kpi_snapshots`, the SQL views). Calendar, Kanban and Gantt endpoints from the requirements do not exist either: the frontend derives those views from the resource endpoints that do. The KPIs and the seven reports are calculated by `ReportService` ([section 13d](#13d-kpis-and-reports)).

## 3. Auth

Controller: `AuthController` · base `/api/auth`

| Method & path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /api/auth/login` | Public | `{ username, password }` — both required; `username` may also be the **e-mail address** of the account (any letter case) | `202` `{ twoFactorRequired: true, username, maskedEmail }` for an **ADMINISTRATOR** when `ADMIN_2FA_ENABLED=true`: a code was e-mailed, and there is no token or cookie yet (continue at `POST /api/auth/login/verify`). Otherwise `200` `{ token, username, role }` and a `Set-Cookie` of the refresh token (`taskflow_refresh`, `HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=604800`, plus `Secure` when `REFRESH_COOKIE_SECURE=true`); the token in the body is a 15-minute access token (`role` is the account's system role: `"ADMINISTRATOR"`, `"PROJECT_MANAGER"`, `"USER"`, or `null` for an account with none) | `401 "Invalid username or password"` (wrong credentials **or** non-`ACTIVE` account); `429` after 5 failures in 15 min per `remoteAddr:username` |
| `POST /api/auth/login/verify` | Public | `{ username, otp }` — `otp` must match `\d{6}`; the username from the `202` answer of `login` | `200` `{ token, username, role }` and the refresh `Set-Cookie`, as `login` | `400 "The code is incorrect or has expired. Request a new code if needed."` for **every** failure (an unknown name, a non-administrator, an inactive account, no code, a used or expired code, too many attempts, a wrong code, or the second step switched off); `429` once failed passwords and wrong codes together reach 5 in 15 min for the same `remoteAddr:username` |
| `POST /api/auth/refresh` | Public (the refresh cookie) | no body; the browser sends the cookie | `200` `{ token, username, role }`: a new 15-minute access token | `401 "Session expired"` with no cookie, an unknown or expired one, or an account that is no longer `ACTIVE`. The refresh token is not rotated, so the cookie stays the same |
| `POST /api/auth/logout` | Public (acts only on the cookie sent) | no body | `204`; deletes that refresh token and clears the cookie | none: with no cookie it just clears it |
| `POST /api/auth/register` | Public | `{ username (3–50, [A-Za-z0-9._-]), email (valid, ≤255), password (policy), confirmPassword }` | `201` `{ username, email, message }`; emails a 6-digit code | `400` validation; `400 "Username is already taken"`, `"Email is already registered"`, `"Password and confirmation do not match"` |
| `POST /api/auth/verify-otp` | Public | `{ username, otp }` — `otp` must match `\d{6}` | `200` (empty) — account becomes `ACTIVE` | `400 "The code is incorrect or has expired. Request a new code if needed."` for **every** failure (an unknown username, an account already verified, no code, a used code, an expired code, too many attempts, a wrong code): one answer, so it does not reveal which usernames exist (since 2026-10-14, I-08) |
| `POST /api/auth/resend-otp` | Public | `{ username }` | `200` (empty) | the same `200` for an unknown username and for an account already verified (nothing is sent; since 2026-10-14, I-08); `429 "Please wait Ns before requesting another code"` (60 s cooldown) for a pending account |

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
| `GET /api/roles` | Any user | — | `200 RoleResponse[]` (`id, name, description, scope, projectRole, builtIn`) | The seven built-in rows (system roles `ADMINISTRATOR`, `PROJECT_MANAGER`, `USER`; project roles `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`) plus any extra system roles (`builtIn` false) |
| `GET /api/roles/{id}` | Any user | — | `200 RoleResponse` | `404 "Role not found"` |
| `POST /api/roles` | Admin (`ROLE:CREATE`) | `{ name (≤50, required), description (≤255) }` | `201 RoleResponse` | The server stores the name in upper case with underscores (`Quality auditor` → `QUALITY_AUDITOR`; 2 to 50 letters, digits, spaces or hyphens, starting with a letter, else `400`). A name in use, in any letter case, → `409`. The role is a `SYSTEM` role, not built in, with no project role and no grants |
| `PUT /api/roles/{id}` | Admin (`ROLE:EDIT`) | same | `200 RoleResponse` | An extra role can be renamed (same rules as create; a name in use → `409`). A built-in role keeps its name (`400` otherwise) and only its description can change |
| `DELETE /api/roles/{id}` | Admin (`ROLE:DELETE`) | — | `204` | Built-in roles cannot be deleted (`400`); a role that accounts still hold → `409` "… is given to N account(s). Give them another role before deleting it"; its grants are deleted with it |
| `GET /api/permissions/matrix` | Admin (`ROLE:VIEW`) | — | `200 { permissions: [{ code, description }], resources: [{ name, label }], roles: [{ role: RoleResponse, locked, grants: [{ scope, resource, permission }] }] }` | Everything the Role & Permission screen needs in one call. `locked` is true for the Administrator |
| `PUT /api/roles/{id}/permissions` | Admin (`ROLE:EDIT`) | `{ grants: [{ scope: SYSTEM\|PROJECT, resource, permission }] }` — the role's **complete** new grant list | `200` the role's `{ role, locked, grants }` | Replaces all grants in one transaction; effective immediately. `403` for the Administrator role; `400` for an unknown scope/resource/permission, a scope the role does not have, or a project role that would lose `PROJECT:VIEW` |
| `GET /api/positions` | Any user | — | `200 PositionResponse[]` (`id, name, description`) | |
| `POST /api/positions` | Admin | `{ name (≤100, required), description (≤255) }` | `201` | `400 "A position named \"X\" already exists"` (case-insensitive) |
| `GET /api/departments` | Any user | — | `200 DepartmentResponse[]` | |
| `POST /api/departments` | Admin | same shape | `201` | same duplicate rule |

There are no update or delete endpoints for positions or departments.

## 6. Projects

Controller: `ProjectController` · base `/api/projects`. `ProjectResponse`: `id, projectCode, name, description, startDate, endDate, manager (UserResponse), lead (UserResponse or null), priority, status, progress, completedAt, createdAt, updatedAt, delayed, daysDelayed`. `completedAt` is set by the database when the status becomes `COMPLETED`, kept while the project is edited and `null` again when it is reopened; it is never taken from the request.

| Method & path | Auth | Request | Success | Notes / errors |
|---|---|---|---|---|
| `GET /api/projects` | Any user | optional query parameters, below | `200 ProjectResponse[]` | administrator: all; others: projects they are an **active** member of; `400` for an unknown `status`, `priority` or `sort` |
| `GET /api/projects/{id}` | Member | — | `200` | `404` for non-members |
| `POST /api/projects` | System `PROJECT:CREATE` (Project Manager, administrator) | `ProjectRequest`: `name` (≤200) ★, `startDate` ★, `endDate` ★; optional `projectCode` (≤30), `description`, `managerId`, `priority` (`LOW/MEDIUM/HIGH/CRITICAL`), `status` (`PLANNING/IN_PROGRESS/ON_HOLD/COMPLETED/CANCELLED`), `progress` (0–100, ignored) | `201` | Code is generated (`PRJ-####`) when omitted/blank; caller becomes manager and `OWNER`; `managerId` honoured only for administrators. **`409 "Project code already exists."`** for a duplicate code; `400` if `endDate < startDate` — message is the raw `new row for relation "projects" violates check constraint "projects_check"` (verified live) |
| `PUT /api/projects/{id}` | Manager | `ProjectRequest` (full replace; blank `projectCode` keeps the current one) | `200` | `409` if the code is taken by another project; `403` without `PROJECT:EDIT` (Team Member, Viewer) |
| `PUT /api/projects/{id}/lead` | Owner or Administrator (`PROJECT:ASSIGN`) | `{ userId }` — a Team Leader of the project, or `null` to clear | `200 ProjectResponse` | `400` if the person is not an active Team Leader of this project; `403` without `PROJECT:ASSIGN` (a Team Leader or Team Member); naming the current lead again changes and logs nothing. Logged as `PROJECT_LEAD_CHANGED`. The lead is cleared by the database when that person stops being a Team Leader of the project (D-09, `V15`) |
| `DELETE /api/projects/{id}` | Owner (`PROJECT:DELETE`) | — | `204` | cascades to members, milestones, tasks and below. A project with a single owner can be deleted (fixed by `V10`) |

★ required.

**Search, filter and sort `GET /api/projects`** (assignment-brief B1.9; all optional, and a request without them returns the list as before). They are applied after the list is limited to what the caller may see, so they only narrow it:

| Parameter | Meaning |
|---|---|
| `search` | text contained (any case) in the name, description, project code, manager's name, status ("in progress", and "active" for an in-progress project), "delayed", or the start or end date (`2026-10`) |
| `status` | one or more of `PLANNING`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CANCELLED`, `DELAYED` (the calculated one); comma-separated or repeated; a project with any of them matches |
| `priority` | one or more of `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`, in the same way |
| `managerId` | the project manager's user id |
| `sort` | `name`, `startDate`, `endDate`, `priority` (most urgent first) or `progress` (highest first); without it the order is unchanged |
| `page`, `size` | optional paging: `page` counts from 0, `size` is 1 to 200 (default 50 when only `page` is sent). With either, the answer is `{ items, total, page, size }` instead of the whole list: the search, filter and sort run first, so `total` counts what matches (never what the caller cannot see) and a page past the end is empty. Without a sort the order is by id, so a page is the same page every time. Out of range is `400` |

Different parameters combine with AND. Example: `GET /api/projects?status=IN_PROGRESS,ON_HOLD&priority=HIGH&sort=endDate`.

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
| `DELETE /api/project-members/{id}` | Manager | — | `204` | `400` if it would remove the last active owner; also removes a `PENDING` row (how an invitation is cancelled: the project page lists the pending invitations with a *Cancel* button, and the invitee's *Team invitation* notification is removed with the row; since 2026-10-14, I-13) |

## 8. Milestones

Controller: `MilestoneController` · base `/api/milestones`. `MilestoneResponse`: `id, project, title, description, dueDate, status, progress, createdAt, updatedAt`.

| Method & path | Auth | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/milestones` | Any user | optional `dueFrom` / `dueTo` (YYYY-MM-DD, both included) | `200[]` | scoped to visible projects; with a window only the milestones due in it (none without a due date); `400` for a bad date or `dueTo` before `dueFrom` (the Calendar asks for the days on screen) |
| `GET /api/milestones/{id}` | Member | — | `200` | |
| `GET /api/milestones/project/{projectId}` | Member | — | `200[]` | |
| `POST /api/milestones` | Manager | `{ projectId ★, title (≤200) ★, dueDate ★, description, status (PENDING/IN_PROGRESS/COMPLETED), progress (0–100, ignored) }` | `201` | `400` if `dueDate` is outside the project's dates |
| `PUT /api/milestones/{id}` | Manager (current project; **and the target project if `projectId` changes**) | same | `200` | `403` when moving a milestone into a project the caller doesn't manage |
| `DELETE /api/milestones/{id}` | Manager | — | `204` | tasks linked to it keep existing (`milestone_id` → NULL) |

## 9. Tasks

Controller: `TaskController` · base `/api/tasks`. `TaskResponse`: `id, project, milestone, title, description, priority, status, startDate, dueDate, estimatedHours, actualHours, progress, completedAt, createdBy, createdAt, updatedAt, totalSubtasks, completedSubtasks, totalChecklistItems, completedChecklistItems, overdue, dueSoon, blocked, blockingTaskTitles, approver, approvalStatus, approvalRequestedBy, approvalRequestedAt, assigneeIds` (`assigneeIds` are the ids of the users the task is assigned to; `approvalStatus` is the newest approval request: `PENDING`, `APPROVED`, `CHANGES_REQUESTED`, `REJECTED`, `WITHDRAWN`, or `null` when never submitted).

| Method & path | Auth | Request | Success | Notes / errors |
|---|---|---|---|---|
| `GET /api/tasks` | Any user | optional query parameters, below | `200[]`, or `200 { items, total, page, size }` when `page` or `size` is sent | administrator: all; others: tasks in their active projects; `400` for an unknown `status`, `priority`, `due`, `view`, `groupBy` or `sort`, a `blocked` that is not `true` or `false`, or a non-numeric `assigneeId` / `projectId` |
| `GET /api/tasks/summary` | Any user | the search and filter parameters below (`view`, `sort`, `groupBy` and paging do not apply) | `200 { viewCounts, assignees, completedByAssignee }` | `viewCounts`: how many tasks each quick view (`all`, `today`, `upcoming`, `inprogress`, `completed`, `overdue`) holds over what the other filters leave, so every count shows whichever view is chosen; `assignees`: every user who holds an assignment on a task the caller may see, by name, not narrowed by the filters (the Tasks page's assignee choices); `completedByAssignee`: user id → how many of the tasks the search and filters leave that person has completed, people with none absent (Reports Overview's Team Productivity chart, with `projectId` for one project); `400` as for the list |
| `GET /api/tasks/project-stats` | Any user | — | `200[]` of `{ projectId, total, completed, overdue }` | one grouped query over the projects the caller may see (a project with no task is absent): `total` and `completed` leave cancelled tasks out, `overdue` is past due and still open; the project cards read it instead of the tasks |
| `GET /api/tasks/{id}` | Member | — | `200` | `404` |
| `GET /api/tasks/project/{projectId}` | Member | — | `200[]` | |
| `GET /api/tasks/milestone/{milestoneId}` | Member | — | `200[]` | `404 "Milestone not found"` |
| `GET /api/tasks/status/{status}` | Any user | — | `200[]` | `400 "Invalid status: X"` for an unknown status (verified live) |
| `POST /api/tasks` | Content | `{ projectId ★, title (≤200) ★, startDate ★, dueDate ★, description, milestoneId, priority (LOW/MEDIUM/HIGH/URGENT), status (TODO/IN_PROGRESS/IN_REVIEW/COMPLETED/CANCELLED), estimatedHours (≥0), progress (0–100), createdById }` | `201` | `403` for `VIEWER`/non-members; `400` for `due < start` (raw `new row for relation "tasks" violates check constraint "tasks_check"`), `due > project end` (clean sentence from the trigger), milestone from another project; `createdById` is honoured only for administrators; writes `TASK_CREATED` |
| `PUT /api/tasks/{id}` | Manager (`TASK:EDIT`), **or** an assignee with `TASK_STATUS:EDIT` (restricted) | same body | `200` | Manager: every field applied; **if `projectId` changes the caller must also be allowed to edit tasks in the target project (`403` otherwise)**. Assignee (Project Manager/Team Leader/Team Member): only `status` and `progress` applied (others, including `projectId`, ignored); a `VIEWER` → `403`; not assigned → `403 "You are not assigned to this task"`. **Setting `COMPLETED` needs `TASK:APPROVE`** (Project Manager, Team Leader, administrator) **and follows the approval rules of [§9b](#9b-task-approval)** (it is recorded as the approver's approval; `403` for your own work or when someone else is the named approver): otherwise `403 "Only a Project Manager or Team Leader can approve a task as completed. Move it to In Review so it can be approved"`. `400 "Complete all subtasks before marking this task as done."`; dependency-gate violations → `400`. Logs status/priority/due-date changes; notifies assignees on a status change |
| `DELETE /api/tasks/{id}` | Manager | — | `204` | writes `TASK_DELETED` |

**Search, filter and sort `GET /api/tasks`** (assignment-brief B1.9; all optional, and a request without them returns the list as before). They are applied after the list is limited to the caller's projects, so they only narrow it:

| Parameter | Meaning |
|---|---|
| `search` | text contained (any case) in the title, description, project name, an assignee's name, priority or status ("in progress"), or the due date (`2026-10-14`) |
| `status` | one or more of `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `COMPLETED`, `CANCELLED`; comma-separated or repeated; a task with any of them matches |
| `priority` | one or more of `LOW`, `MEDIUM`, `HIGH`, `URGENT`, in the same way |
| `assigneeId` | tasks that this user is assigned to; repeated, the task must be assigned to **all** the named users |
| `projectId` | tasks of this project |
| `due` | `overdue` (past due and still open), `today`, `week` (today to 7 days ahead) or `none` (no due date) |
| `unassigned` | `true`: only tasks with no assignee at all (together with `assigneeId` nothing matches) |
| `view` | the quick views of the Tasks page, over what the other filters leave: `today` and `upcoming` (open tasks due today / after today), `inprogress`, `completed`, `overdue`; `all` or nothing changes nothing |
| `blocked` | `true`: only the tasks waiting on a task they depend on that is not completed; `false`: only the others. With `status=TODO` it splits the Kanban board's To Do and Blocked columns (a task can be blocked only while it is To Do); the filter runs after the others and before the paging, so a page and its total count only what matches |
| `groupBy` | `project`: the tasks of a project stay together, projects that are finished (progress 100) last and the others by name, with `sort` ordering the tasks inside each project |
| `dueFrom`, `dueTo` | tasks due on or after / on or before that day (YYYY-MM-DD, both included; either may be left out; a task with no due date is then left out); the Calendar asks for the days on screen; `400` for a bad date or `dueTo` before `dueFrom` |
| `sort` | `latest` (newest first), `dueDate` (no date last), `priority` (most urgent first), `progress` (highest first), `status` (To Do first) or `title` (A to Z, any case); without it the order is unchanged |

Different parameters combine with AND. Example: `GET /api/tasks?assigneeId=12&status=TODO,IN_PROGRESS&due=week&sort=dueDate`. The Tasks page asks for `GET /api/tasks?groupBy=project&sort=dueDate&view=all&page=0&size=50` (plus its filters) and, for the counts and the assignee choices, `GET /api/tasks/summary` with the same filters.

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
| `POST /api/task-dependencies` | Manager (dependent task's project) | `{ taskId ★, dependsOnTaskId ★ }` | `201` | `400` for a self-dependency, a cycle, a task of another project, or an active task with an unfinished prerequisite; `404` when the other task's project is not visible to the caller |
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

Controller: `CommentController` · base `/api/comments`. `CommentResponse`: `id, taskId, userId, authorName, parentCommentId, message, createdAt, updatedAt, mentions` — `mentions` is `[{ id, username, fullName }]`: the active members of the project that the message mentions with `@username` (D-21; empty when none), on the list, create and update responses.

| Method & path | Auth | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/comments/task/{taskId}` | Member | — | `200[]` oldest first | |
| `POST /api/comments` | Content | `{ taskId ★, message (≤4000) ★, parentCommentId }` | `201` | `403` for a `VIEWER` (changed 2026-10-06; reading is still allowed); parent must exist (`404 "Parent comment not found"`) and belong to the same task (`400 "The comment you are replying to belongs to another task"`); writes `COMMENT_ADDED` to the activity feed and notifies the task's assignees, the project's Owner and Team Leaders and, for a reply, the parent comment's author (never the author); a member `@mentioned` in the message gets a `MENTION` notification instead (an edit via `PUT` tells only the newly mentioned) |
| `PUT /api/comments/{id}` | author only | `{ taskId ★, message ★ }` | `200` | `403 "You do not have permission…"` for anyone else, including administrators |
| `DELETE /api/comments/{id}` | author, or Manager | — | `204` | replies are deleted too |


## 13b. Work logs (time tracking)

Controller: `WorkLogController` · base `/api/work-logs`. `WorkLogResponse`: `id, taskId, userId, authorName, workDate, hoursWorked, description, createdAt`. A task's `actualHours` (in `TaskResponse`) is the sum of these.

| Endpoint | Access | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/work-logs/task/{taskId}` | Member | — | `200[]` newest work date first | `404` if the task does not exist or the caller cannot see its project |
| `POST /api/work-logs` | Content | `{ taskId ★, workDate ★ (not later than tomorrow by the server's date, so a person east of the server can log "today"), hoursWorked ★ (0.01–24), description (≤500) }` | `201` | logs time for **the caller**; `403` for a `VIEWER`; `400` for hours ≤ 0 or > 24, a future date or a missing field; `404` for an unknown task. Writes `WORK_LOGGED` to the task's activity feed; no notification |
| `PUT /api/work-logs/{id}` | the author only | same body as `POST` (`taskId` must stay the entry's own task) | `200` | `403 "You can only change your own time entries"` for anyone else, **including an administrator**, and for an author who can no longer log time (a `VIEWER`); `400` for a different `taskId`, a date later than tomorrow, hours <= 0 or > 24; `404` outside the caller's projects. Writes `WORK_LOG_UPDATED` ("Changed a time entry from 1 h on 2026-10-10 to 2.5 h on 2026-10-11") only when something changed |
| `DELETE /api/work-logs/{id}` | author, or Manager | — | `204` | `403 "You can only delete your own time entries"` for anyone else; `404` outside the caller's projects. Writes `WORK_LOG_DELETED` ("…logged by Name" when the author is someone else) |

There is no update endpoint.

## 13c. Dashboard and manager views

Controllers: `DashboardController`, `TeamViewsController`. Everything here is calculated on the server from the projects and tasks the caller may see, so every client shows the same figures. "Delayed" (project) and "overdue" (task) are derived from dates and statuses, never stored (assignment-brief.md B1.3).

| Endpoint | Access | Success | Notes |
|---|---|---|---|
| `GET /api/dashboard/stats` | Any user (scoped) | `200 { projects: { total, planning, active, onHold, completed, cancelled, delayed, averageProgress }, tasks: { total, todo, inProgress, inReview, completed, cancelled, overdue }, delayedProjects: [{ id, projectCode, name, endDate, daysDelayed, progress, status }] }` | `active` = `IN_PROGRESS` only; `delayed` overlaps the status counts; `averageProgress` leaves out cancelled projects; at most 5 delayed projects, most late first; an administrator sees everything |
| `GET /api/dashboard/task-activity` | Any user (scoped). Parameters: `days` (1 to 366, default 7), `zone` (the caller's IANA time zone, e.g. `Asia/Phnom_Penh`; the server's zone when left out), `projectId` (one project; `404` when the caller is not in it) | `200[]` of `{ date, created, completed, overdue }`, one per day, oldest first, ending today | the Dashboard's activity chart: `created` and `completed` count the tasks whose timestamp falls on that day in the given zone, `overdue` counts the tasks open now that were due before that day (so today's figure equals `stats.tasks.overdue`); `400` for `days` outside 1 to 366 or not a number, or an unknown zone |
| `GET /api/projects/{id}/team-tasks` | `TASK:ASSIGN` in the project (Owner, Team Leader, Administrator) | `200 { projectId, projectName, members: [{ user, projectRole, assigned, completed, active, overdue, averageProgress, tasks: [TeamTask] }], unassigned: [TeamTask] }` | `TeamTask`: `id, title, status, priority, startDate, dueDate, progress, overdue, estimatedHours, assignmentId` (the `task_assignees` row, to reassign). Active members except Viewers; cancelled tasks left out; `403` for a Team Member, `404` for a stranger |
| `GET /api/projects/{id}/workload` | same | `200 { projectId, projectName, teamSize, averageOpenTasks, averageEstimatedHours, members: [{ user, assigned, active, overdue, estimatedHours, actualHours, level }] }` | `level` is `OVERLOADED`, `UNDERLOADED` or `BALANCED` against the team average (D-13). `assigned` = non-cancelled tasks, `active` = in progress, `overdue` = past due and not finished, `estimatedHours` = of unfinished tasks, `actualHours` = hours this person logged on the team's tasks. An Owner or Team Leader is listed only once work is assigned to them |
| `GET /api/workload` | needs `TASK:ASSIGN` in at least one project | `200` the same shape across every project the caller manages (`projectId` null) | `403` for someone who manages none |

`ProjectResponse` also carries `delayed` and `daysDelayed` (the end date passed and the project is neither `COMPLETED` nor `CANCELLED`). `TaskResponse.dueSoon` is calculated the same way: the task is not `COMPLETED` or `CANCELLED` and is due today or within the next 3 days (`Derived.DUE_SOON_DAYS`, the first reminder day); an overdue task is `overdue`, never `dueSoon`.

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

A `ProjectRow` (the `project` of the Project Report and every row of the Project Status Report) is `{ id, projectCode, name, status, priority, owner, startDate, endDate, progress, delayed, daysDelayed, completedAt }`; `completedAt` is the project's completion date, `null` until it is completed.

Export (PDF / Excel) has no endpoint: the Excel and PDF files are made in the browser from the report on the screen (since 2026-10-13, D-22).

## 14. Activity logs

| Method & path | Auth | Success | Notes |
|---|---|---|---|
| `GET /api/activity-logs/recent?limit=` | Any user (scoped) | `200 ActivityLogResponse[]` newest first (`limit` default 10, 1–50; entries carry `projectId` and `projectName`) | the latest events across the caller's projects (all projects for an administrator): the dashboard's "Recent activity" |
| `GET /api/activity-logs/project/{projectId}?limit=` | Member | `200 ActivityLogResponse[]` newest first (`limit` default 50, 1–200) | the project feed: project created / updated / completed, milestone created / completed, task, subtask and approval events, comments, files; `404` for a stranger. Each entry has `taskId` and `taskTitle` when it is about a task |
| `GET /api/activity-logs/task/{taskId}` | Member | `200 ActivityLogResponse[]` (`id, action, description, userId, userName, taskId, taskTitle, createdAt`), newest first | Read-only; entries are written by services, never posted. `TASK_DELETED` entries carry no task link, so they appear in the project and recent feeds but not here |

## 14b. Audit log

Controller: `AuditLogController` · base `/api/audit-logs`. The administrator audit log (assignment-brief.md B10, D-11), separate from the project feed above. Read-only: entries are written by the services that do the audited actions, inside the same transaction, and nothing can change or delete them (the application role has `SELECT` and `INSERT` only and a trigger refuses `UPDATE` and `DELETE`).

| Method & path | Auth | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/audit-logs` | Administrator | query: `action`, `targetType` (`USER` / `ROLE` / `PROJECT`), `q` (text in the actor, target, before or after), `from`, `to` (`yyyy-MM-dd`, inclusive), `page` (from 0), `size` (default 25, capped at 100) | `200 { items: AuditLogResponse[], total, page, size }`, newest first | `403 "Only an Administrator can read the audit log"` for anyone else, `401` without a token. `AuditLogResponse`: `id, actorId, actorName, action, targetType, targetId, targetLabel, projectId, beforeValue, afterValue, createdAt`. `%` and `_` in `q` are matched as text |
| `GET /api/audit-logs/project/{projectId}` | Administrator or the project's Owner | — | `200 AuditLogResponse[]`, newest first | The Administrator gets every entry of the project; its Owner only `OWNERSHIP_TRANSFERRED` (D-11); anyone else `403` |

Actions: `USER_ROLE_CHANGED` (before / after: the role name), `PERMISSIONS_CHANGED` (the role's full grant list before and after, as `SCOPE:RESOURCE:PERMISSION` separated by commas; nothing is recorded for a save that changes nothing), `PROJECT_ROLE_CHANGED` (the project role; `projectId` set), `OWNERSHIP_TRANSFERRED` (the previous and the new owner's name; `projectId` set), `ACCOUNT_CREATED` (admin creation and self-registration), `ACCOUNT_STATUS_CHANGED` (also the activation by e-mail code), `ACCOUNT_DELETED`, `PROJECT_DELETED`, `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_DELETED`. The actor is whoever is signed in (`System` when nobody is); the name is stored as it was, so an entry stays readable after the account is deleted.

## 15. Notifications

Controller: `NotificationController` · base `/api/notifications` · all *Self*. Details: [notifications.md](notifications.md).

| Method & path | Success | Notes |
|---|---|---|
| `GET /api/notifications` | `200 NotificationResponse[]` newest first; with `?page` / `?size` (from 0, 1 to 200) `200 { items, total, page, size }`, still newest first | `id, type, title, message, projectId, projectName, taskId, taskTitle, read, createdAt` |
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
| 400 | database constraint or trigger violation | for triggers: the trigger's own sentence with the `ERROR:` prefix stripped (e.g. `"Task due_date (2099-01-01) cannot be later than its project end_date (2026-11-30)"`); for `CHECK` and unique constraints other than the project code, a plain sentence (since 2026-10-14, I-11): `"The task due date cannot be before its start date."`, `"That username is already taken."`, `"That email address is already registered."`, `"Progress must be between 0 and 100."`, and so on for the named ones; `"That value is already in use."` / `"One or more values are not allowed."` for any other; a foreign-key or NOT NULL violation: `"This item is linked to other records, so the change is not allowed."` / `"A required value is missing."` (`DatabaseMessages`; the status stays `400`) |
| 400 | path value of the wrong type; missing request parameter; unreadable JSON; upload too large; multipart request without the file | `"Invalid value for 'id'"`, `"Malformed request body"`, `"File is too large"`, `"No file was uploaded"` |
| **401** | no/invalid/expired token, **or a token whose account is no longer `ACTIVE`** (suspended, inactive, pending, deleted) — from Spring Security, **empty body** | — |
| 401 | login failed (any reason) | `"Invalid username or password"` |
| **403** | `AccessDeniedException` (service checks) and `@PreAuthorize` failures | the specific sentence the permission layer threw, for example `"Only a Project Manager or an Administrator can create a project"`; the generic `"You do not have permission to perform this action"` only when Spring supplies no message of its own (its default `"Access Denied"`) |
| **404** | `NotFoundException`, including project access for non-members; a path no controller serves | `"Project not found"`, `"Task not found"`, `"User not found"`, …; `"Resource not found"` for an unknown path |
| **409** | `ConflictException`, and the safety net for the `projects.project_code` unique constraint — **the only use of 409** | `"Project code already exists."` |
| **429** | login lockout; OTP resend cooldown | `"Too many failed login attempts. Try again later."`, `"Please wait Ns before requesting another code"` |
| **500** | any unhandled exception | `"An unexpected error occurred"` (details only in `backend/logs/log.txt`) |

Notes: most `403` bodies name what is missing (a role, an assignment), which is safe because the caller already knows the project exists. `404` instead of `403` is deliberate for project and notification lookups so existence is not revealed.

## 18. The legacy `openapi.yaml`

`api/openapi.yaml` is an OpenAPI 3.0.3 file written early in the project. Reviewed on 2026-10-08 against the controllers and DTOs, it:

- documents **58 of the 129 endpoints** (45%; 36 paths) and no documented endpoint has been removed. (The review of 2026-10-08 counted 57 of 91; the only endpoint added to the file since is `POST /api/auth/login/verify` (2026-10-17), so the other 37 endpoints added since are undocumented there);
- is missing 71 endpoints: registration, OTP, refresh and logout, the user profile, photo, preferences and permissions, positions and departments, the role and permission matrix, project invitations and the project lead, comments, subtasks, checklist items, attachments, task approval, work logs, activity logs, the audit log, notification delete, the dashboard and manager views, and the KPIs and reports;
- names the roles `PROJECT_MANAGER`, `TEAM_LEADER` and `TEAM_MEMBER` as global roles in 24 places with the old per-endpoint rules, so its authorization text is wrong (the names exist again since 2026-10-08, but the rules differ);
- still says "No pagination/filtering" for `GET /api/projects`, which has taken search, filter and sort parameters since 2026-10-13, and documents none for `GET /api/tasks`;
- has six drifted schemas (`TaskResponse`, `ProjectMemberResponse`, `UserResponse`, `UserCreateRequest`, `UserUpdateRequest`, `SelfProfileUpdateRequest`), 43 of the 64 DTOs with no schema, and no `operationId` on any operation.

It is **not maintained**. This page and [backend.md](backend.md) are the documentation to keep current; the rule is "change behaviour, update `docs/` in the same pull request" ([README.md](README.md#keeping-the-documentation-current)). If a machine-readable contract is wanted again, generate it from the code (for example with springdoc) instead of hand-editing the YAML, so it cannot drift.
