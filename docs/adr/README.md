# Architecture Decision Records

Short records of the important decisions already built into the project: what was decided, why, what was avoided, and what it costs. They were reconstructed from the code, SQL comments, migration headers, READMEs and git history on **2026-10-06**; the original discussions are not in the repository.

Where a reason is stated in the project's own files it is cited. Where it is **inferred** from the code, the record says so. A record's **Status** is *Accepted* when the decision is in force in the code today.

| ADR | Decision | Date introduced |
|---|---|---|
| [0001](0001-stateless-jwt-authentication.md) | Stateless JWT authentication | 2026-09-08 |
| [0002](0002-project-level-authorization.md) | Authorization from per-project roles, not global roles | 2026-09-13/14 |
| [0003](0003-project-membership-and-invitations.md) | A project is the team; invitations live on `project_members` | 2026-09-13 |
| [0004](0004-task-assignment-model.md) | Task assignment as a join table with database-enforced eligibility | 2026-09-04 / 09-13 |
| [0005](0005-database-owned-schema-and-triggers.md) | Hand-written SQL schema; cross-row invariants in triggers | 2026-09-02 → |
| [0006](0006-dto-layer.md) | DTOs on every endpoint, never entities | 2026-09-09 |
| [0007](0007-application-created-notifications.md) | Notifications created by application code | 2026-09-10 |
| [0008](0008-self-registration-with-otp.md) | Self-registration with an emailed one-time code | 2026-09-13 |
| [0009](0009-profile-photos-in-database.md) | Profile photos stored in the database, served by random token | 2026-09-14 |
| [0010](0010-relative-api-paths-and-proxy.md) | Relative `/api` paths behind a proxy | 2026-09-08 |
| [0011](0011-least-privilege-database-role.md) | Backend connects as a least-privilege database role | 2026-09-13 |
| [0012](0012-derived-progress.md) | Progress is derived by the database, not trusted from clients | 2026-09-12 |
| [0013](0013-manual-task-status-with-guards.md) | Task status is manual, with two guarded exceptions | 2026-09-14/15 |
| [0014](0014-requirement-roles-and-permission-matrix.md) | A data-driven permission matrix (role set replaced by 0015) | 2026-10-08 |
| [0015](0015-two-level-roles-system-and-project.md) | Two-level roles: system roles and project roles (**implemented**, migration V10) | 2026-10-08 |

## Template for new records

```markdown
# ADR-NNNN: <short title>

- **Status:** Proposed | Accepted | Superseded by ADR-NNNN
- **Date:** YYYY-MM-DD
- **Area:** authentication | authorization | database | api | frontend | infrastructure

## Context
What problem or constraint forced a decision.

## Decision
What was decided, in one or two sentences, with the main file paths.

## Alternatives considered
What else was possible and why it was not chosen (mark inferred reasons).

## Consequences
Benefits, costs, and anything that must stay true (invariants).

## Evidence
Files, commits, migrations, tests.
```

Add a new record when a decision is hard to reverse or surprising to a newcomer, and link it from [../architecture.md](../architecture.md#6-important-architectural-decisions-summary).
