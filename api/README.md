# API

REST API design and contract docs — the shared surface between [frontend](../frontend/README.md) and [backend](../backend/README.md).

Per [Role_Requirment.md](../Role_Requirment.md), this area owns:

- REST API design
- User / Authentication APIs
- Project / Task / Team APIs
- Milestone / Calendar / Kanban / Gantt APIs
- Time Tracking / Notification / Report / KPI APIs

## Status

[`openapi.yaml`](openapi.yaml) documents every endpoint that actually exists in `backend/` today — auth, users, projects, project members, milestones, tasks, task assignees, task dependencies, plus health. This is a description of current behavior, not a proposed/idealized contract — see the caveats below before building against it.

Not yet implemented anywhere (no controller at all): roles, comments, attachments, work logs, notifications, activity logs, subtasks/checklists — all of which exist as DB tables (see [database/README.md](../database/README.md)) but have no API surface yet. Calendar/Kanban/Gantt/Report/KPI-specific endpoints from the requirements doc also don't exist — the frontend would need to derive those views from the resource endpoints that do exist.

### Known quirks (documented, not fixed here)

These are called out inline in `openapi.yaml` too, but worth having up front:

- **No pagination or search/filter** beyond a handful of `GET .../project/{id}`-style lookups baked into specific resources.
- **Full-replace `PUT`, no `PATCH`** — every update resends the entire resource body, including its relations.
- **"Not found" comes back as 500, not 404** — no global exception handler exists, so a missing row surfaces as an unhandled exception.
- **`POST` returns 200, not 201** — no controller sets a response status, so Spring's default applies everywhere.
- **Two different "user" shapes** — `GET /api/users` returns a `UserResponse` DTO (no password hash, role flattened to a string), but `manager`/`user`/`createdBy` fields nested inside `Project`/`Task`/`ProjectMember`/`TaskAssignee` responses are the raw `User` entity — which **does** include `passwordHash` and a full nested `role` object. This is a real, current data leak, not a documentation error.
- **Registration doesn't hash passwords** — `POST /api/users` stores whatever string is sent in `passwordHash` as-is.
- **No role-based access control** — every endpoint requires a valid JWT (except `/api/health` and `/api/auth/login`), but any authenticated user can call any endpoint regardless of role.
- **Enum-like fields aren't validated in Java** — `status`, `priority`, etc. are plain strings; the DB `CHECK` constraints are the only enforcement, so an invalid value fails at the database layer (as another unhandled 500) rather than a clean validation error.

## Intent

As real gaps get fixed (auth hardening, DTOs, pagination, etc.) or new endpoints land, update `openapi.yaml` to match — this file should track actual backend behavior, not drift into aspirational documentation.

## Contributing

See the root [README](../README.md) and [Contributing.md](../Contributing.md) for branch naming (`api/<task>`) and PR workflow.
