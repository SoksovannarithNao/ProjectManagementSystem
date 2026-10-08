# ADR-0014: Four requirement roles and a data-driven permission matrix

- **Status:** Accepted; **its role set was replaced the same day by [ADR-0015](0015-two-level-roles-system-and-project.md)** (system roles `ADMINISTRATOR`/`PROJECT_MANAGER`/`USER`, project roles `OWNER`/`ADMIN`/`MEMBER`/`VIEWER`, migration `V10`). The data-driven matrix, the 404/403 rules, hide-not-disable and the Flyway delivery stand. Partly supersedes [ADR-0002](0002-project-level-authorization.md)
- **Date:** 2026-10-08
- **Area:** authorization

## Context

`Role_Requirment.md` asks for four roles (Administrator, Project Manager, Team Leader, Team Member), seven permissions (View, Create, Edit, Delete, Assign, Approve, Generate Reports), "each role should have different permissions", a Role & Permission screen and a User & Role Management screen.

Before this change the project had two system roles (`USER`, `ADMINISTRATOR`) and four per-project roles (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`). The rules were hard-coded twice (Java in `ProjectAccessGuard`, JavaScript in `frontend/src/api/permissions.js`), and the `permissions` / `role_permissions` tables existed but no code read them. `APPROVE` and `GENERATE_REPORTS` had no meaning anywhere. [ADR-0002](0002-project-level-authorization.md) records why the four global roles were removed once before: a new account holding a global *Team Member* role could never create a project, so the app had no way to start.

## Decision

1. **One set of roles, two scopes.** The four required roles exist as system roles (`users.role_id`) *and* as project roles. A project role is the existing `project_members.project_role` value, mapped to a role row through `roles.project_role`: `OWNER → PROJECT_MANAGER`, `ADMIN → TEAM_LEADER`, `MEMBER → TEAM_MEMBER`, `VIEWER → VIEWER`. `VIEWER` is a fifth, project-only role the requirement does not name but the app already relied on. The stored `project_role` values do not change.
2. **`role_permissions` is the single source of truth.** A grant is *(role, permission, resource, scope)*: "this role may do this action on this resource, anywhere in the system (`SYSTEM`) or inside a project where it holds the role (`PROJECT`)". `PermissionService` loads the table into memory and refreshes it after every matrix edit. `ProjectAccessGuard` answers every check through it; the 404-for-non-members rule of ADR-0002 is kept exactly.
3. **Effective permission** for *(user, project, resource, action)* = the user's system-scope grants ∪ the project-scope grants of the role mapped from their ACTIVE membership of that project. `ADMINISTRATOR` holds every grant and also bypasses the check in code (it cannot be locked out by editing the table).
4. **Creating a project requires `PROJECT:CREATE` at system scope**, held by `PROJECT_MANAGER` and `ADMINISTRATOR`. New self-registered accounts are `TEAM_MEMBER`. This brings back the dead end ADR-0002 removed, **on purpose**, and avoids it with the User & Role Management screen: an Administrator promotes an account to Project Manager. Existing project owners were migrated to `PROJECT_MANAGER` so nobody lost access.
5. **`APPROVE` is a real approval gate.** Setting a task to `COMPLETED` requires `TASK:APPROVE` (Project Manager, Team Leader, Administrator). A Team Member moves work to `IN_REVIEW` ("submit for review") and waits.
6. **`GENERATE_REPORTS` is enforced where reports exist.** There are no server-side report endpoints (the Reports page builds its charts in the browser from data other pages also need), so the permission gates the Reports page, its route and its navigation link only. This is a stated gap, not a hidden one; report endpoints are roadmap Phase 3.
7. **The frontend reads, never decides.** `GET /api/users/me/permissions` returns the caller's grants as `RESOURCE:ACTION` strings; the UI hides controls the user cannot use (it does not disable them). The server still checks every request.
8. **Ownership rules stay in code**, because they are about *who did it*, not *what role you have*: comment edit = author only; comment and work-log delete by the author; assignee-only status change for members; invitee accepts or declines; last-owner and last-Administrator protection; "change project manager" remains Administrator-only.
9. **Editable at runtime with guardrails:** an Administrator can change any role's grants except `ADMINISTRATOR`'s (locked). Built-in roles cannot be deleted. The last Administrator cannot be demoted.
10. **Delivery:** migration `V9__requirement_roles_and_permissions.sql` (idempotent) applied by a one-shot Flyway `migrate` service in `docker-compose.yml`, baselined at version 8 so existing volumes (which do not re-run `database/init/*`) are upgraded. `01-init.sql` mirrors the end state for fresh volumes.

## Alternatives considered

- **Rename the project roles and drop the system/project split.** Rejected: it would repeat the mistake ADR-0002 documents and rewrite every `project_members` row.
- **Keep hard-coded rules; only add the UI.** Rejected: a screen that edits a table nothing reads would be fake permissions.
- **Per-action only (no resource).** Rejected: the existing behaviour is resource-specific (a member may comment but not delete tasks); collapsing it would either loosen or tighten the current rules.
- **Allow everyone to create projects (status quo).** Rejected for the requirement, "Project Manager creates projects".
- **Fabricate report endpoints so `GENERATE_REPORTS` looks enforced.** Rejected: the honest scope is the page, and the gap is recorded.

## Consequences

- One matrix to read, test and edit; the Java guard, the API and the UI cannot drift apart. A unit test generated from the V9 SQL checks every role × resource × action.
- New accounts cannot create projects until promoted; Team Members can no longer mark a task Completed.
- The `USER` role is gone; the JWT `role` claim now carries one of the four names. Tokens issued earlier keep working until they expire.
- Matrix edits take effect immediately for new requests, and for the UI after the next profile refresh.
- Invariants: `ADMINISTRATOR` always has every grant; `PROJECT:VIEW` is granted to every project role so a member can always see their own project; the matrix in `V9`, `01-init.sql` and `authentication-authorization.md` is the same table.
- The `GENERATE_REPORTS` gap remains until report endpoints exist.
- Deleting a project whose only active owner is one person fails on the V8 owner-integrity trigger (found while verifying this change; not caused by it).

## Evidence

`database/taskmanager/migrations/V9__requirement_roles_and_permissions.sql`, `database/init/01-init.sql`, `docker-compose.yml` (`migrate`), `backend/.../service/PermissionService.java`, `ProjectAccessGuard.java`, `RolePermissionService.java`, `controller/PermissionController.java`, `frontend/src/auth/AuthContext.jsx`, `frontend/src/pages/admin/*`, tests `PermissionServiceTest`, `ProjectAccessGuardTest`, `RolePermissionServiceTest`, `UserRoleServiceTest`, `e2e/roles-permissions.spec.js`.
