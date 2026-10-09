# ADR-0015: Two-level roles — system roles and project roles

- **Status:** Accepted and **implemented** on 2026-10-08 (migration `V10__two_level_roles.sql`, `ProjectOwnership`, matrix changes). Replaces the role set of [ADR-0014](0014-requirement-roles-and-permission-matrix.md); what is still open is listed in [assignment-brief.md](../../assignment-brief.md) §B13.1.
- **Date:** 2026-10-08
- **Area:** authorization

## Context

ADR-0014 gave the four requirement roles (Administrator, Project Manager, Team Leader, Team Member) to **both** levels: each exists as a system role and as a project role. Reviewing the assignment brief and the project workflow showed that this blurs two different questions — *what may this person do anywhere* and *what may this person do in this project* — and left several rules undefined (who owns a project, what "approve" means, what a Team Leader may delete). The specification was therefore resolved first, on paper, before any further code ([assignment-brief.md](../../assignment-brief.md) Part B, [project-workflow.md](../../project-workflow.md)).

## Decision

1. **Two independent levels.**
   - **System roles:** `ADMINISTRATOR`, `PROJECT_MANAGER`, `USER` (stored on the account; one per person).
   - **Project roles:** `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` (stored on a project membership; one per person per project).
2. **Business names are labels.** Administrator = `ADMINISTRATOR`. Project Manager = `PROJECT_MANAGER` and normally `OWNER` of the projects they manage — **two different things**: the first grants global project-management capability (create projects, cross-project reports), the second grants authority inside one project. Team Leader = `ADMIN`. Team Member = `MEMBER`. Viewer = `VIEWER`. There are **no** `TEAM_LEADER` / `TEAM_MEMBER` system roles.
3. **Decision chain.** Account must be `ACTIVE` → system role and its permissions → project membership and project role → ownership/assignment restrictions. **`ADMINISTRATOR` bypasses project membership. A system role never widens a project role** (a `PROJECT_MANAGER` who is a `VIEWER` of a project is read-only there). Project permissions stay scoped to the project.
4. **Seven permissions** (View, Create, Edit, Delete, Assign, Approve, Generate Reports) are the high-level categories. The fine-grained *resource × action* checks stay as the enforcement layer under them. Baseline matrix: Owner and the two system roles hold all seven; `ADMIN` holds all except the project-level `DELETE` (it may delete work items and remove members, never the project or the `OWNER`) and may not grant or transfer ownership; `MEMBER` has *limited* Create and Edit and no Delete, Assign, Approve or Reports; `VIEWER` only views.
5. **Creating a project** needs the project-creation capability (held by `ADMINISTRATOR` and `PROJECT_MANAGER`, not by `USER`). The creator becomes the project's `OWNER`. A project has **exactly one** `OWNER`; ownership transfers in a single step to someone who can own projects.
6. **Approval** is a task-level review workflow, separate from the `IN_REVIEW` status: request → Approved / Changes requested / Rejected. Administrator, Project Manager (through its project role), Owner and Team Leader may approve. Only an approved task can become `COMPLETED`.
7. **Team Members do not create tasks** (the brief names Project Managers and Team Leaders). They add subtasks, checklist items, comments, work logs and attachments, and update the tasks assigned to them up to `IN_REVIEW`.
8. **Roles are data.** The permission catalog and the role-permission assignments remain authoritative and are editable by an Administrator, who can also create additional **system** roles. Project roles stay the four built-ins.
9. **Kept from ADR-0014:** the permission matrix in the database read by both API and UI; `404` for non-members and `403` with a specific message otherwise; controls hidden, not disabled; the Flyway `migrate` mechanism.

## Alternatives considered

- **Keep ADR-0014 as built** (four roles at both levels). Works, but makes "Project Manager" mean two things and keeps `TEAM_LEADER` / `TEAM_MEMBER` accounts that carry no meaning outside a project.
- **Rename the project roles** to Manager / Leader / Member. Rejected for the same reason as in ADR-0002: it rewrites every membership and merges two levels.
- **Let the system role widen the project role.** Rejected: it would let a person added as a viewer manage the project.

## Consequences

- **Done in `V10`:** the `TEAM_LEADER` and `TEAM_MEMBER` system roles are retired (their accounts became `USER`), new registrations are `USER`, every project has exactly one `OWNER` (a deferred trigger plus `ProjectOwnership`), `MEMBER` no longer creates tasks or deletes subtasks, and report access comes through the project roles. **Not done yet:** creating additional system roles (D-14). Users editing their own position/department (D-16, batch 1) and the approval records and review workflow (batch 2, `V12`) were done later, on 2026-10-09.
- `USER` and the old `TEAM_MEMBER` system role are the same idea; `TEAM_LEADER` as a system role goes away, so a person leads a project by being `ADMIN` in it.
- The documentation now describes one model. Where the application still differs from the specification, §B13.1 of the brief lists it.
- Open items: calendar views was the last open decision and is now settled; the 18 decisions D-01…D-18 in the brief are recorded there.

## Evidence

[assignment-brief.md](../../assignment-brief.md) Part B (B0, B1, B3, B13), [project-workflow.md](../../project-workflow.md), and the answers recorded on 2026-10-08.
