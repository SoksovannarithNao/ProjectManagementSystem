# API Reference

All **84 endpoints** exposed by the 17 controllers in `backend/src/main/java/backend/controller/`, derived directly from the code and checked against the running application on 2026-10-06. This reference is complete; [api/openapi.yaml](../api/openapi.yaml) is **not** (it documents 57 of the 84 and still uses obsolete role names — see [issues.md](issues.md#4-documentation-drift)).

Contents: [1 Getting started](#1-getting-started) · [2 Conventions](#2-conventions) · [3 Auth](#3-auth) · [4 Users](#4-users) · [5 Roles, positions, departments](#5-roles-positions-departments) · [6 Projects](#6-projects) · [7 Project members and invitations](#7-project-members-and-invitations) · [8 Milestones](#8-milestones) · [9 Tasks](#9-tasks) · [10 Assignees](#10-task-assignees) · [11 Dependencies](#11-task-dependencies) · [12 Subtasks](#12-subtasks) · [13 Comments](#13-comments) · [14 Activity](#14-activity-logs) · [15 Notifications](#15-notifications) · [16 Photos and health](#16-photos-and-health) · [17 Errors](#17-error-responses-and-status-codes)

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
| *Content* | active `OWNER` / `ADMIN` / `MEMBER`, or administrator (not `VIEWER`) |
| *Manager* | active `OWNER` / `ADMIN` of the project, or administrator → `403` otherwise |
| *Owner* | active `OWNER` of the project, or administrator → `403` otherwise |
| *Admin* | system `ADMINISTRATOR` only (`@PreAuthorize`) → `403` otherwise |
| *Self* | acts only on the caller's own data; the target comes from the token |

Rules in full: [authentication-authorization.md](authentication-authorization.md#5-project-level-roles).

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

## 3. Auth

Controller: `AuthController` · base `/api/auth`

| Method & path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /api/auth/login` | Public | `{ username, password }` — both required | `200` `{ token, username, role }` (`role` is `"ADMINISTRATOR"`, `"USER"` or `null`) | `401 "Invalid username or password"` (wrong credentials **or** non-`ACTIVE` account); `429` after 5 failures in 15 min per `remoteAddr:username` |
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
| `POST /api/users` | Admin | `UserCreateRequest`: `fullName` (≤150), `username` (≤50), `email`, `password` (policy) required; `gender` (≤20), `dateOfBirth`, `phoneNumber` (≤30), `positionId`, `departmentId`, `roleId`, `accountStatus` (`ACTIVE`/`INACTIVE`/`SUSPENDED`) optional | `201 UserResponse` | `400` validation; duplicate username/email → `400` with the raw constraint message (see §17) |
| `PUT /api/users/{id}` | Admin | `UserUpdateRequest`: as above but `password` optional (policy applied only if sent), no `PENDING_VERIFICATION` | `200 UserResponse` | `400` if deactivating a sole project owner |
| `DELETE /api/users/{id}` | Admin | — | `204` | `400` if the user is a sole active project owner; FK `RESTRICT` if they manage a project |
| `PUT /api/users/me` | Self | `{ fullName (≤150, required), email (valid, required), gender, dateOfBirth, phoneNumber }` | `200 UserResponse` | Cannot change username, role, status, position, department |
| `PUT /api/users/me/password` | Self | `{ currentPassword, newPassword (policy), confirmNewPassword }` | `200` (empty) | `400 "Current password is incorrect"`, `"New password and confirmation do not match"` |
| `PUT /api/users/me/photo` | Self | multipart form, part `file` | `200 UserResponse` | `400` if empty, not JPEG/PNG/WEBP/GIF, or > 5 MB (`"File is too large (max 5MB)"`) |
| `DELETE /api/users/me/photo` | Self | — | `200 UserResponse` | |
| `PUT /api/users/me/preferences` | Self | `{ themePreference: LIGHT|DARK|SYSTEM, taskNotificationsEnabled: boolean }` — both required | `200 UserResponse` | |
| `PUT /api/users/{id}/position-department` | Team admin (see note) | `{ positionId, departmentId }` (either may be `null` to clear) | `200 UserResponse` | `403` when targeting yourself or when you do not administer a project the target belongs to (administrators are exempt from the second rule, **not** the first) |

*Team admin* = administrator, or active `OWNER`/`ADMIN` of a project the target user is also an active member of.

## 5. Roles, positions, departments

| Method & path | Auth | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/roles` | Any user | — | `200 RoleResponse[]` (`id, name, description`) | Two rows: `USER`, `ADMINISTRATOR` |
| `GET /api/roles/{id}` | Any user | — | `200 RoleResponse` | `404 "Role not found"` |
| `POST /api/roles` | Admin | `{ name (≤50, required), description (≤255) }` | `201` | duplicate name → raw `400` |
| `PUT /api/roles/{id}` | Admin | same | `200` | ⚠ no protection against renaming a role the code depends on by name |
| `DELETE /api/roles/{id}` | Admin | — | `204` | ⚠ no protection against deleting `USER`/`ADMINISTRATOR`; fails with an FK error while users reference the role |
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
| `POST /api/projects` | Any user | `ProjectRequest`: `name` (≤200) ★, `startDate` ★, `endDate` ★; optional `projectCode` (≤30), `description`, `managerId`, `priority` (`LOW/MEDIUM/HIGH/CRITICAL`), `status` (`PLANNING/IN_PROGRESS/ON_HOLD/COMPLETED/CANCELLED`), `progress` (0–100, ignored) | `201` | Code is generated (`PRJ-####`) when omitted/blank; caller becomes manager and `OWNER`; `managerId` honoured only for administrators. **`409 "Project code already exists."`** for a duplicate code; `400` if `endDate < startDate` — message is the raw `new row for relation "projects" violates check constraint "projects_check"` (verified live) |
| `PUT /api/projects/{id}` | Manager | `ProjectRequest` (full replace; blank `projectCode` keeps the current one) | `200` | `409` if the code is taken by another project; `403` for `MEMBER`/`VIEWER` |
| `DELETE /api/projects/{id}` | Owner | — | `204` | cascades to members, milestones, tasks and below |

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
| `POST /api/project-members/invite` | Manager | `{ projectId, username }` — both required | `201` (`status: PENDING`, `projectRole: MEMBER`) | `404 "No user found with that username"`; `400` `"You cannot invite yourself"`, `"<u> has an inactive account and can't be added to a project"`, `"…is already a member of this team"`, `"An invitation is already pending for …"`; creates a `TEAM_INVITATION` notification |
| `POST /api/project-members/project/{projectId}/accept` | Self (invitee) | — | `200` (`status: ACTIVE`) | `404 "No invitation found"`; `400 "This invitation is no longer pending"` |
| `POST /api/project-members/project/{projectId}/decline` | Self (invitee) | — | `200` (`status: DECLINED`) | same errors |
| `POST /api/project-members` | Manager | `{ projectId, userId }` required; `projectRole` (`OWNER/ADMIN/MEMBER/VIEWER`) optional | `201` (immediately `ACTIVE`) | granting `OWNER` needs *Owner*; `400` for an inactive account; duplicate (project, user) → raw `400` |
| `PUT /api/project-members/{id}` | Manager (of the row's project) | same body — `projectId` and `userId` must match the row | `200` | Only the **role** can change: a different `projectId`/`userId` → `400 "A membership's project and user cannot be changed — remove it and add a new one"`; `400` if it would demote the last active owner |
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

Controller: `TaskController` · base `/api/tasks`. `TaskResponse`: `id, project, milestone, title, description, priority, status, startDate, dueDate, estimatedHours, progress, completedAt, createdBy, createdAt, updatedAt, totalSubtasks, completedSubtasks, overdue, blocked, blockingTaskTitles`.

| Method & path | Auth | Request | Success | Notes / errors |
|---|---|---|---|---|
| `GET /api/tasks` | Any user | — | `200[]` | administrator: all; others: tasks in their active projects |
| `GET /api/tasks/{id}` | Member | — | `200` | `404` |
| `GET /api/tasks/project/{projectId}` | Member | — | `200[]` | |
| `GET /api/tasks/milestone/{milestoneId}` | Member | — | `200[]` | `404 "Milestone not found"` |
| `GET /api/tasks/status/{status}` | Any user | — | `200[]` | `400 "Invalid status: X"` for an unknown status (verified live) |
| `POST /api/tasks` | Content | `{ projectId ★, title (≤200) ★, startDate ★, dueDate ★, description, milestoneId, priority (LOW/MEDIUM/HIGH/URGENT), status (TO_DO/IN_PROGRESS/IN_REVIEW/COMPLETED/CANCELLED), estimatedHours (≥0), progress (0–100), createdById }` | `201` | `403` for `VIEWER`/non-members; `400` for `due < start` (raw `new row for relation "tasks" violates check constraint "tasks_check"`), `due > project end` (clean sentence from the trigger), milestone from another project; `createdById` is honoured only for administrators; writes `TASK_CREATED` |
| `PUT /api/tasks/{id}` | Manager, **or** an assignee with content-edit rights (restricted) | same body | `200` | Manager: every field applied; **if `projectId` changes the caller must also manage the target project (`403` otherwise)**. Assignee (`OWNER`/`ADMIN`/`MEMBER`): only `status` and `progress` applied (others, including `projectId`, ignored); a `VIEWER` → `403 "You do not have permission to edit this task"`; not assigned → `403 "You are not assigned to this task"`. `400 "Complete all subtasks before marking this task as done."`; dependency-gate violations → `400`. Logs status/priority/due-date changes; notifies assignees on a status change |
| `DELETE /api/tasks/{id}` | Manager | — | `204` | writes `TASK_DELETED` |

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
| `POST /api/subtasks` | Content | `{ taskId ★, title (≤200) ★, assigneeId, dueDate, status (TO_DO/IN_PROGRESS/COMPLETED) }` | `201` | `403` for a `VIEWER` (changed 2026-10-06; reading is still allowed); assignee must be an active, `ACTIVE` project member; writes `SUBTASK_ADDED` |
| `PUT /api/subtasks/{id}` | Content | same | `200` | writes `SUBTASK_COMPLETED` on first completion; may auto-promote the task `TO_DO → IN_PROGRESS` |
| `DELETE /api/subtasks/{id}` | Content | — | `204` | writes `SUBTASK_DELETED` |

## 13. Comments

Controller: `CommentController` · base `/api/comments`. `CommentResponse`: `id, taskId, userId, authorName, parentCommentId, message, createdAt, updatedAt`.

| Method & path | Auth | Request | Success | Notes |
|---|---|---|---|---|
| `GET /api/comments/task/{taskId}` | Member | — | `200[]` oldest first | |
| `POST /api/comments` | Content | `{ taskId ★, message (≤4000) ★, parentCommentId }` | `201` | `403` for a `VIEWER` (changed 2026-10-06; reading is still allowed); parent must exist (`404`), same-task is not checked; no notification, no activity entry |
| `PUT /api/comments/{id}` | author only | `{ taskId ★, message ★ }` | `200` | `403 "You do not have permission…"` for anyone else, including administrators |
| `DELETE /api/comments/{id}` | author, or Manager | — | `204` | replies are deleted too |

## 14. Activity logs

| Method & path | Auth | Success | Notes |
|---|---|---|---|
| `GET /api/activity-logs/task/{taskId}` | Member | `200 ActivityLogResponse[]` (`id, action, description, userId, userName, createdAt`), newest first | Read-only; entries are written by services, never posted. `TASK_DELETED` entries are not returned by any endpoint |

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
| 400 | path value of the wrong type; missing request parameter; unreadable JSON; upload too large | `"Invalid value for 'id'"`, `"Malformed request body"`, `"File is too large (max 5MB)"` |
| **401** | no/invalid/expired token, **or a token whose account is no longer `ACTIVE`** (suspended, inactive, pending, deleted) — from Spring Security, **empty body** | — |
| 401 | login failed (any reason) | `"Invalid username or password"` |
| **403** | `AccessDeniedException` (service checks) and `@PreAuthorize` failures | always the generic `"You do not have permission to perform this action"` |
| **404** | `NotFoundException`, including project access for non-members | `"Project not found"`, `"Task not found"`, `"User not found"`, … |
| **409** | `ConflictException`, and the safety net for the `projects.project_code` unique constraint — **the only use of 409** | `"Project code already exists."` |
| **429** | login lockout; OTP resend cooldown | `"Too many failed login attempts. Try again later."`, `"Please wait Ns before requesting another code"` |
| **500** | any unhandled exception | `"An unexpected error occurred"` (details only in `backend/logs/log.txt`) |

Notes: `403` bodies never say *why*, so a client cannot distinguish "wrong role" from "not assigned". `404` instead of `403` is deliberate for project and notification lookups so existence is not revealed.
