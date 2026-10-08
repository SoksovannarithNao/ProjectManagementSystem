# ADR-0002: Authorization from per-project roles, not global roles

- **Status:** Accepted — partly superseded by [ADR-0014](0014-requirement-roles-and-permission-matrix.md) (the global-role and hard-coded-matrix parts; the project-scoped model and the 404 rule stand)
- **Date:** read isolation 2026-09-13 (`87ccf00`, `ProjectAccessGuard`); write authorization moved 2026-09-14 (`35c6daf`, migration `V5`)
- **Area:** authorization

## Context

`Role_Requirment.md` lists four roles — Administrator, Project Manager, Team Leader, Team Member — and also requires that users only see projects and tasks they have permission for. The first implementation gave each user one **global** role used to gate project and task actions.

## Problem found

The header of `V5__project_scoped_authorization.sql` records the failure: every self-registered user was force-assigned `TEAM_MEMBER`, which then failed the checks for creating projects and tasks — **a brand-new user could never create a project or a task**. A global role also cannot express "owner of project A, only a viewer of project B".

## Decision

- Authority comes from the caller's **own active `project_members` row for that specific project**: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`.
- Only two **global** roles remain, both about the system rather than any project: `ADMINISTRATOR` (manage users and roles, sees every project) and `USER` (a label with no privileges). A user may have no global role at all.
- Anyone may create a project and becomes its `OWNER`.
- The rules live in one helper, `service/ProjectAccessGuard`, used by every project-scoped service; `@PreAuthorize("hasRole('ADMINISTRATOR')")` is kept only for genuinely system-wide actions.
- Reads of single resources return **404**, not 403, for non-members so existence is not revealed.
- A project can never lose its last active owner (service + trigger `trg_project_members_owner_integrity`).

## Alternatives considered

- **Keep four global roles** (the requirement document's literal model) — rejected by migration `V5`: unworkable for new users (stated above). The roles `PROJECT_MANAGER`, `TEAM_LEADER`, `TEAM_MEMBER` were deleted from the database.
- **A data-driven permission matrix** (`permissions` + `role_permissions`) — the tables were built and still exist but are **not consulted** by any code; `../database.md` calls them "vestigial for anything project-scoped" and notes a resource-scoped matrix as a possible future step. Hard-coded checks were chosen for simplicity *(inferred)*.
- **Per-user permission overrides** — explicitly avoided: the `role_permissions` comment says "deliberately role-level only — no per-user override table".

## Consequences

- Matches the requirement that people only see what they are permitted to, and removes the new-user dead end.
- The four requirement roles map to the project roles approximately (Administrator → `ADMINISTRATOR`; Project Manager → `OWNER`; Team Leader → `ADMIN`; Team Member → `MEMBER`/`VIEWER`) — this should be stated in any formal write-up.
- Adding or changing a permission means a **code change and redeploy**.
- The rules exist twice — Java (`ProjectAccessGuard`) and JavaScript (`api/permissions.js`) — and diverged for `VIEWER` until the 2026-10-06 fix; nothing tests that they match.
- **Weaknesses found in this model and fixed on 2026-10-06** (see [../issues.md](../issues.md), F-12 … F-18): permission checks used the resource's *current* project, so a request body that changed `projectId` was not re-checked (now checked on the target project too, and a membership can't be re-pointed); `VIEWER` was only read-only in some endpoints (subtask and comment writes and the assigned-user update now need content-edit rights); user and membership lookups were not scoped (now limited to people/projects the caller can see). **Lesson recorded:** any update endpoint that accepts a relation id must re-check permission on the *target*; this is not yet covered by a role × action test for every endpoint.

## Evidence

`ProjectAccessGuard`, `V5__project_scoped_authorization.sql`, `../database.md` (Authorization), commits `87ccf00`, `35c6daf`, `9f0a872`; [../authentication-authorization.md](../authentication-authorization.md).
