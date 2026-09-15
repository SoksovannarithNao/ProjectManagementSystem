# API

REST API design and contract docs — the shared surface between [frontend](../frontend/README.md) and [backend](../backend/README.md).

Per [Role_Requirment.md](../Role_Requirment.md), this area owns:

- REST API design
- User / Authentication APIs
- Project / Task / Team APIs
- Milestone / Calendar / Kanban / Gantt APIs
- Time Tracking / Notification / Report / KPI APIs

## Status

[`openapi.yaml`](openapi.yaml) covers the core resources — health, auth login, users, roles, projects, project members, milestones, tasks, task assignees, task dependencies, and notifications — but **it has drifted and is no longer a complete list of what `backend/` actually exposes.** Missing from it entirely: registration/OTP (`/api/auth/register`, `/verify-otp`, `/resend-otp`), positions/departments, subtasks, comments, activity logs, photo upload/serve, and several of the newer self-service user endpoints (`/api/users/me/password`, `/me/photo`, `/me/preferences`). For the actual current endpoint list, see [backend/README.md](../backend/README.md#api-endpoints)'s resource table — that's the one kept in sync with the code; treat `openapi.yaml` as a partial, aging reference until it's updated to match.

Not yet implemented anywhere (no controller at all): attachments, work logs, checklist items — all of which exist as DB tables (see [database/README.md](../database/README.md)) but have no API surface yet. (Comments, activity logs, and subtasks *used* to be on this list — all three now have full controllers.) Calendar/Kanban/Gantt/Report/KPI-specific endpoints from the requirements doc also don't exist — the frontend derives those views from the resource endpoints that do exist.

### Current, real behavior worth knowing up front

- **Correct HTTP status codes** — every create endpoint returns `201 Created`, every delete returns `204 No Content`, and a missing row returns a clean `404` JSON body (`{"status":404,"error":"Not Found","message":"..."}`) via `GlobalExceptionHandler`, a real `@RestControllerAdvice`. The one exception: `POST /api/notifications/read-all` returns `204`, not `201` — it's a `POST` that mutates existing rows rather than creating a new one.
- **Every response is a DTO, never a raw JPA entity.** `UserResponse` never includes a password field of any kind, and every place a user/project/task appears nested inside another resource (`Project.manager`, `ProjectMember.user`, `TaskAssignee.user`, `Task.createdBy`) is the same `UserResponse`/`ProjectResponse`/etc. DTO, not the entity.
- **Registration hashes passwords.** `POST /api/users` and `PUT /api/users/{id}`/`PUT /api/users/me` take a plaintext `password` field and BCrypt-hash it server-side before storage (`UserService`, via Spring Security's `PasswordEncoder`).
- **Authorization is project-scoped, not global-role-based.** Only user/role management and a couple of genuinely system-wide actions are gated by `@PreAuthorize("hasRole('ADMINISTRATOR')")`; almost everything else is checked in service code against the caller's own `project_members.project_role` for that specific project (`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`) — see `backend/README.md`'s [Security](../backend/README.md#security) section for the authoritative per-resource policy. `PUT /api/tasks/{id}` is the one ownership-scoped exception on top of that: a project `OWNER`/`ADMIN` can edit any task in full, while anyone else can only call it for a task they're currently assigned to (`403` otherwise), and even then only `status`/`progress` from the request take effect.
- **Login rate limiting**: `POST /api/auth/login` returns `429 Too Many Requests` after 5 failed attempts within 15 minutes for the same `remoteAddr:username` key (in-memory, resets on restart; a successful login clears the counter).
- **Self-registration is a separate, public flow from login.** `POST /api/auth/register` → `PENDING_VERIFICATION` account + emailed OTP (Mailpit locally) → `POST /api/auth/verify-otp` activates it; `login` rejects an unverified account. `POST /api/auth/resend-otp` re-sends the code.
- **`GET /api/photos/{token}` is the one endpoint with no auth at all**, deliberately — an `<img>` tag can't send a bearer token, so profile photos are served by an unguessable per-upload token instead of the user's id.
- **Every write endpoint validates its body** (`@Valid` + Bean Validation — required fields, string length limits, `@Pattern`-checked enum-like fields, numeric ranges) and a failure comes back as a `400` with the real `ErrorResponse` shape (`timestamp`, `status`, `error`, `message`, `fieldErrors`), not a generic/undocumented Spring default body.

### Known quirks (still real, not yet fixed)

- **No pagination or search/filter** beyond a handful of `GET .../project/{id}`-style lookups baked into specific resources. List endpoints return every row, unbounded.
- **Full-replace `PUT`, no `PATCH`** — every update resends the entire resource body, including its relations (e.g. changing a task's status still means sending its `projectId`, `title`, dates, etc. again).
- **Enum-like fields aren't a real Java enum type** — `status`, `priority`, `accountStatus`, etc. are plain `String` columns. They *are* validated on write via Bean Validation's `@Pattern`, matching the same allowed values as the Postgres `CHECK` constraint in `database/init/01-init.sql` — so an invalid value is now rejected as a clean `400` before it ever reaches the database, not silently passed through to fail at the DB layer.
- **Authorization is still hardcoded**, just no longer at the annotation level for most resources — project-scoped checks (`ProjectAccessGuard`) are Java `if`s against `project_members.project_role`, not a lookup against the DB's `permissions`/`role_permissions` tables — see [database/README.md](../database/README.md#authorization--permissions). A new project role, or a finer-grained per-permission tweak, still means a code change and redeploy, not a data change.
- **`GET /api/tasks/status/{status}`** takes `status` as a free-text path segment, not validated against the `TaskStatus` values — an unrecognized value returns an empty list rather than a `400`.
- **`GET .../project/{id}`, `.../milestone/{id}`, `.../task/{id}`, `.../user/{id}`-style lookups** return an empty list for an unknown parent id rather than a `404` — they're plain filtered queries, not "does this parent exist" checks.

## Intent

As real gaps get fixed (pagination, the remaining DB-only tables getting entities/controllers, permissions-table-backed authorization, etc.) or new endpoints land, update `openapi.yaml` to match — this file should track actual backend behavior, not drift into aspirational documentation.

## Contributing

See the root [README](../README.md) and [Contributing.md](../Contributing.md) for branch naming (`api/<task>`) and PR workflow.
