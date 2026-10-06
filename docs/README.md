# Project Documentation

Documentation for the **TaskFlow** task and project management system (React frontend, Spring Boot API, PostgreSQL). Everything here was written from the code, the SQL scripts, the running application, the tests and the git history, and cross-checked between layers. Verified on **2026-10-06**. Where something could not be confirmed it is marked *Unknown / Needs clarification*; nothing describes functionality that does not exist.

## Start here

| If you are… | Read |
|---|---|
| New to the project and need it running | [setup.md](setup.md) |
| Looking for the big picture | [overview.md](overview.md), then [architecture.md](architecture.md) |
| Deciding what to fix or build next | [issues.md](issues.md), then [roadmap.md](roadmap.md) |
| Calling the API | [api-reference.md](api-reference.md) |

## Contents

| # | Area | Document |
|---|---|---|
| 1 | Project overview — purpose, scope, stack, structure, status | [overview.md](overview.md) |
| 2 | System architecture — layers, modules, API communication, decisions | [architecture.md](architecture.md) |
| 3 | Authentication & authorization — login, OTP, roles, account statuses, password policy, permission matrix | [authentication-authorization.md](authentication-authorization.md) |
| 4 | User & project management — user lifecycle, projects, membership, invitations, member search | [users-and-projects.md](users-and-projects.md) |
| 5 | Task management — fields, statuses, assignment, *My Tasks*, subtasks, comments, activity, rules | [tasks.md](tasks.md) |
| 6 | Notifications — types, triggers, read/unread, deletion | [notifications.md](notifications.md) |
| 7 | Database — tables, relationships, constraints, ERD, triggers, migrations | [database.md](database.md) |
| 8 | API reference — all 84 endpoints, permissions, payloads, error codes | [api-reference.md](api-reference.md) |
| 9 | Validation & security — validation layers, error handling, hardening, gaps | [security.md](security.md) |
| 10 | Testing — inventory, coverage, regression tests, gaps | [testing.md](testing.md) |
| 11 | Bug & issue tracking — open defects, inconsistencies, fixed, limitations, debt | [issues.md](issues.md) |
| 12 | Feature & development roadmap — done / partial / not started / planned | [roadmap.md](roadmap.md) |
| 13 | Development setup — install, environment, database, run, build, test | [setup.md](setup.md) |
| 14 | Change log — reconstructed from the git history | [changelog.md](changelog.md) |
| 15 | Architecture decision records (13) | [adr/README.md](adr/README.md) |

## Where the rest of the documentation lives

| What | Where |
|---|---|
| Project README, quick start | [../README.md](../README.md) |
| Branching, pull requests, reviews | [../Contributing.md](../Contributing.md) |
| The requirements the project is built against | [../Role_Requirment.md](../Role_Requirment.md) (summary), [../Project_requirement_plan.md](../Project_requirement_plan.md) (detailed plan) |
| Backend internals | [../backend/README.md](../backend/README.md) |
| Frontend structure and E2E tests | [../frontend/README.md](../frontend/README.md) |
| Schema rationale and operations | [../database/README.md](../database/README.md) |
| Machine-readable API contract (partly out of date) | [../api/openapi.yaml](../api/openapi.yaml), [../api/README.md](../api/README.md) |

The component READMEs were kept (not duplicated here) and corrected where they had drifted; [issues.md](issues.md#4-documentation-drift) lists what was corrected and what is still open.

## Conventions used in these documents

- Names (classes, endpoints, tables, fields, files) are the real ones from the code.
- **verified live** = reproduced against the running application; **by code reading** = read in the source, not run; **Needs verification / Unknown** = could not be confirmed.
- ⚠ marks behaviour that contradicts the documented intent or a stated requirement.
- Statuses: *Done* means working through UI, API and database; a UI alone does not count ([roadmap.md](roadmap.md)).

## Keeping the documentation current

- Change behaviour → update the matching page in the same pull request. The pages that go stale fastest are [api-reference.md](api-reference.md), [authentication-authorization.md](authentication-authorization.md) (permission matrix), [issues.md](issues.md), [roadmap.md](roadmap.md) and [testing.md](testing.md).
- Fix a bug listed in [issues.md](issues.md) → move it to the *Fixed* table, add a [changelog.md](changelog.md) entry, and add the regression test to [testing.md](testing.md#6-regression-tests-for-fixed-bugs).
- Make a decision that is hard to reverse → add an [ADR](adr/README.md).
- Change setup, ports, variables or scripts → update [setup.md](setup.md).
