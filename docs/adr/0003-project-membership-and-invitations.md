# ADR-0003: A project is the team; invitations live on `project_members`

- **Status:** Accepted
- **Date:** 2026-09-13 (`87ccf00`, migration `V4`); eligibility and search extended 2026-10-06 (`115d52a`)
- **Area:** database / authorization

## Context

The requirements talk about "teams" and "adding team members" to a project, and the application needs a way to add people who must consent. Both a team entity and an invitation entity were possible.

## Decision

- There is **no `teams` table**. A **project is the team**; `project_members` rows are the team's membership (comment in `02-seed.sql` and `../database.md`).
- An **invitation is a `project_members` row that has not been accepted yet**, distinguished by `status`: `PENDING` → `ACTIVE` (accepted) or `DECLINED`; plus `invited_by` and `responded_at`.
- `UNIQUE (project_id, user_id)`: a person has at most one row per project, so declining and being re-invited **reuses the row**.
- A `PENDING` or `DECLINED` row grants **no access** — every visibility check filters `status = 'ACTIVE'`; the assignee trigger does the same.
- Only `OWNER`/`ADMIN` (or the administrator) may invite. The invitee responds with `POST …/accept|decline`; the inviter is notified. The invitation carries an optional project role (`ADMIN`, `MEMBER` — the default — or `VIEWER`; never `OWNER`).
- Eligibility is enforced in the backend: the target must be an `ACTIVE` account, not the caller, and not already `ACTIVE`/`PENDING` on the project. Suggestions come from a database query that applies the same filters.

## Alternatives considered

- **Separate `teams` and `team_members` tables** — avoided: the data model already scopes everything by project, so a second grouping would duplicate it (stated in `../database.md`: "a project IS a team").
- **A separate `invitations` table** — avoided: a pending invitation is just a membership in a different state; one table keeps the unique rule and the visibility filter in one place *(inferred from the design)*.
- **Direct add only (no consent)** — the direct-add endpoint still exists for owners/admins and for project creation; invitations were added on top (`V4`).

## Consequences

- One row to query for "who is on this project", with a single status filter everywhere.
- Declined and pending rows persist (no audit table, no expiry). The project page lists the pending invitations with a Cancel button (since 2026-10-14, I-13); cancelling deletes the row and the invitee's notice.
- Accepting is only offered through the **notification bell**. The invitation notification is created even when the invitee switched task notifications off (issue I-12, fixed 2026-10-14), so it is always there to answer.
- The invite request takes an optional role (since 2026-10-09 the Team page sends it, and since 2026-10-14 so does the project page's *Add Member* dialog, which has a *Role in this project* picker with Team Member as the default); a later role change goes through the project page's role picker.
- `GET /api/project-members/user/{userId}` used to return every status and every project to anyone, exposing membership (and pending invitations) beyond the model; since 2026-10-06 it returns only active memberships in projects the caller belongs to (issue F-13). A membership row's project and user can no longer be changed by update — only its role.

## Evidence

`ProjectMemberService`, `V4__add_team_invitations_…sql`, `V8__enforce_project_owner_integrity.sql`; tests `ProjectMemberServiceTest`, `project-team.spec.js`, `team.spec.js`; [../users-and-projects.md](../users-and-projects.md).
