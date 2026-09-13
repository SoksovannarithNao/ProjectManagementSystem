# API

REST API design and contract docs — the shared surface between [frontend](../frontend/README.md) and [backend](../backend/README.md).

Per [Role_Requirment.md](../Role_Requirment.md), this area owns:

- REST API design
- User / Authentication APIs
- Project / Task / Team APIs
- Milestone / Calendar / Kanban / Gantt APIs
- Time Tracking / Notification / Report / KPI APIs

## Status

[`openapi.yaml`](openapi.yaml) documents every endpoint that actually exists in `backend/` today — health, auth, users, roles, projects, project members, milestones, tasks, task assignees, task dependencies, and notifications. This is a description of current behavior, not a proposed/idealized contract — see the caveats below before building against it.

Not yet implemented anywhere (no controller at all): comments, attachments, work logs, activity logs, subtasks/checklists — all of which exist as DB tables (see [database/README.md](../database/README.md)) but have no API surface yet. Calendar/Kanban/Gantt/Report/KPI-specific endpoints from the requirements doc also don't exist — the frontend derives those views from the resource endpoints that do exist.

### Current, real behavior worth knowing up front

- **Correct HTTP status codes** — every create endpoint returns `201 Created`, every delete returns `204 No Content`, and a missing row returns a clean `404` JSON body (`{"status":404,"error":"Not Found","message":"..."}`) via `GlobalExceptionHandler`, a real `@RestControllerAdvice`. The one exception: `POST /api/notifications/read-all` returns `204`, not `201` — it's a `POST` that mutates existing rows rather than creating a new one.
- **Every response is a DTO, never a raw JPA entity.** `UserResponse` never includes a password field of any kind, and every place a user/project/task appears nested inside another resource (`Project.manager`, `ProjectMember.user`, `TaskAssignee.user`, `Task.createdBy`) is the same `UserResponse`/`ProjectResponse`/etc. DTO, not the entity.
- **Registration hashes passwords.** `POST /api/users` and `PUT /api/users/{id}`/`PUT /api/users/me` take a plaintext `password` field and BCrypt-hash it server-side before storage (`UserService`, via Spring Security's `PasswordEncoder`).
- **Role-based access control is enforced** via `@PreAuthorize` on (almost) every write endpoint — see `backend/README.md`'s [Security](../backend/README.md#security) section for the authoritative per-resource policy table. `PUT /api/tasks/{id}` is the one ownership-scoped exception: `ADMINISTRATOR`/`PROJECT_MANAGER`/`TEAM_LEADER` can edit any task in full, while a `TEAM_MEMBER` can only call it for a task they're currently assigned to (`403` otherwise), and even then only `status`/`progress` from the request take effect.
- **Login rate limiting**: `POST /api/auth/login` returns `429 Too Many Requests` after 5 failed attempts within 15 minutes for the same `remoteAddr:username` key (in-memory, resets on restart; a successful login clears the counter).
- **Every write endpoint validates its body** (`@Valid` + Bean Validation — required fields, string length limits, `@Pattern`-checked enum-like fields, numeric ranges) and a failure comes back as a `400` with the real `ErrorResponse` shape (`timestamp`, `status`, `error`, `message`, `fieldErrors`), not a generic/undocumented Spring default body.

### Known quirks (still real, not yet fixed)

- **No pagination or search/filter** beyond a handful of `GET .../project/{id}`-style lookups baked into specific resources. List endpoints return every row, unbounded.
- **Full-replace `PUT`, no `PATCH`** — every update resends the entire resource body, including its relations (e.g. changing a task's status still means sending its `projectId`, `title`, dates, etc. again).
- **Enum-like fields aren't a real Java enum type** — `status`, `priority`, `accountStatus`, etc. are plain `String` columns. They *are* validated on write via Bean Validation's `@Pattern`, matching the same allowed values as the Postgres `CHECK` constraint in `database/init/01-init.sql` — so an invalid value is now rejected as a clean `400` before it ever reaches the database, not silently passed through to fail at the DB layer.
- **Authorization is still hardcoded role-name checks** (`@PreAuthorize("hasRole('ADMINISTRATOR')")` and friends), not a lookup against the DB's `permissions`/`role_permissions` tables — see [database/README.md](../database/README.md#authorization--permissions). Functionally equivalent today (there are only 4 roles and the policy is coarse-grained), but a new role or a per-permission tweak means a code change and redeploy, not a data change.
- **`GET /api/tasks/status/{status}`** takes `status` as a free-text path segment, not validated against the `TaskStatus` values — an unrecognized value returns an empty list rather than a `400`.
- **`GET .../project/{id}`, `.../milestone/{id}`, `.../task/{id}`, `.../user/{id}`-style lookups** return an empty list for an unknown parent id rather than a `404` — they're plain filtered queries, not "does this parent exist" checks.

## Intent

As real gaps get fixed (pagination, the remaining DB-only tables getting entities/controllers, permissions-table-backed authorization, etc.) or new endpoints land, update `openapi.yaml` to match — this file should track actual backend behavior, not drift into aspirational documentation.

## Contributing

See the root [README](../README.md) and [Contributing.md](../Contributing.md) for branch naming (`api/<task>`) and PR workflow.
