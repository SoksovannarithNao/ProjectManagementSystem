# Project Documentation

Documentation for the **TaskFlow** task and project management system (React frontend, Spring Boot API, PostgreSQL). Everything here was written from the code, the SQL scripts, the running application, the tests and the git history, and cross-checked between layers. First verified on **2026-10-06**; updated on **2026-10-08** (time tracking, frontend design pass, requirements audit, and the move of the `api/`, `backend/`, `frontend/` and `database/` READMEs into this folder). **`docs/` is the single place for project documentation**: the four folder READMEs no longer exist. Where something could not be confirmed it is marked *Unknown / Needs clarification*; nothing describes functionality that does not exist.

## Start here

| If you are… | Read |
|---|---|
| New to the project and need it running | [setup.md](setup.md) |
| Looking for the big picture | [overview.md](overview.md), then [architecture.md](architecture.md) |
| Deciding what to fix or build next | [issues.md](issues.md), then [roadmap.md](roadmap.md) |
| Calling the API | [api-reference.md](api-reference.md) |
| Working on the backend, frontend or database | [backend.md](backend.md), [frontend.md](frontend.md), [database.md](database.md) |
| Checking what the requirements still need | [checklist/](checklist/), then [roadmap.md](roadmap.md) |
| Designing or changing the UI | [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) |

## Contents

| # | Area | Document |
|---|---|---|
| 1 | Project overview — purpose, scope, stack, structure, status | [overview.md](overview.md) |
| 2 | System architecture — layers, modules, API communication, decisions | [architecture.md](architecture.md) |
| 3 | Authentication & authorization — login, OTP, roles, account statuses, password policy, permission matrix | [authentication-authorization.md](authentication-authorization.md) |
| 4 | User & project management — user lifecycle, projects, membership, invitations, member search | [users-and-projects.md](users-and-projects.md) |
| 5 | Task management — fields, statuses, assignment, *My Tasks*, subtasks, comments, activity, rules | [tasks.md](tasks.md) |
| 6 | Notifications — types, triggers, read/unread, deletion | [notifications.md](notifications.md) |
| 7 | Database — tables, relationships, constraints, ERD, triggers, migrations, running and inspecting, design decisions | [database.md](database.md) |
| 8 | API reference — all 119 endpoints, permissions, payloads, error codes, known quirks | [api-reference.md](api-reference.md) |
| 9 | Validation & security — validation layers, error handling, hardening, gaps | [security.md](security.md) |
| 10 | Testing — inventory, coverage, regression tests, gaps | [testing.md](testing.md) |
| 11 | Bug & issue tracking — open defects, inconsistencies, fixed, limitations, debt | [issues.md](issues.md) |
| 12 | Feature & development roadmap — done / partial / not started / planned | [roadmap.md](roadmap.md) |
| 13 | Development setup — install, environment, database, run, build, test | [setup.md](setup.md) |
| 14 | Change log — reconstructed from the git history | [changelog.md](changelog.md) |
| 15 | Architecture decision records (15) | [adr/README.md](adr/README.md) |
| 16 | Backend guide — stack, run, structure, security reasoning, logging, invitations, notifications, status | [backend.md](backend.md) |
| 17 | Frontend guide — stack, scripts, structure, routes, behaviours, design tokens, end-to-end tests | [frontend.md](frontend.md) |
| 18 | Product context and design system | [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) |
| 19 | Requirements audit — done, partially done, not done, falls short, unclear | [checklist/](checklist/done.md) |
| 20 | Workflow conformance test: the running app against the 40 workflows (2026-10-08) | [workflow-conformance.md](workflow-conformance.md) |
| 21 | Change plan: what is still to change, in the proposed order (2026-10-08) | [change-plan.md](change-plan.md) |

## Where the rest of the documentation lives

| What | Where |
|---|---|
| Project README, quick start | [../README.md](../README.md) |
| Branching, pull requests, reviews | [../Contributing.md](../Contributing.md) |
| The requirements the project is built against | [../assignment-brief.md](../assignment-brief.md) (the assignment; **Part B is the resolved specification** — roles, permissions, definitions, reports, acceptance criteria, open gaps), [../project-workflow.md](../project-workflow.md) (the user flows), [../Project_requirement_plan.md](../Project_requirement_plan.md) (detailed plan). [../Role_Requirment.md](../Role_Requirment.md) now holds only the team-responsibility areas |
| Legacy machine-readable API contract (partial, not maintained) | [../api/openapi.yaml](../api/openapi.yaml); see [api-reference.md](api-reference.md#18-the-legacy-openapiyaml) |

## Where the old folder READMEs went

The `README.md` files in `api/`, `backend/`, `frontend/` and `database/` were removed on 2026-10-08 and their content moved here, with out-of-date statements corrected (endpoint count 84 → 87, tests 60 → 67 and 30 → 33, work logs now implemented, 16 entities).

| Old file and section | Now |
|---|---|
| `api/README.md`: status, current behaviour, known quirks, intent | [api-reference.md](api-reference.md#2-conventions) (behaviour and quirks), [section 18](api-reference.md#18-the-legacy-openapiyaml) (the YAML's status); the "keep it in sync" intent is replaced by the rule below |
| `backend/README.md`: stack, getting started, structure | [backend.md](backend.md) |
| `backend/README.md`: API endpoints table | [backend.md](backend.md#api-endpoints) and [api-reference.md](api-reference.md) |
| `backend/README.md`: security, rate limiting, photos, CORS, error handling | [backend.md](backend.md#security), [authentication-authorization.md](authentication-authorization.md), [security.md](security.md) |
| `backend/README.md`: database role, logging | [backend.md](backend.md#database), [backend.md](backend.md#logging), [database.md](database.md#7-least-privilege-application-role) |
| `backend/README.md`: team invitations, task and subtask rules, notifications | [backend.md](backend.md#team-invitations), [backend.md](backend.md#task--subtask-rules), [backend.md](backend.md#notifications) with full detail in [users-and-projects.md](users-and-projects.md), [tasks.md](tasks.md), [notifications.md](notifications.md) |
| `backend/README.md`: frontend integration, current status, next steps | [backend.md](backend.md#frontend-integration), [backend.md](backend.md#current-status), [backend.md](backend.md#next-steps), [roadmap.md](roadmap.md) |
| `frontend/README.md`: stack, scripts, structure, routes, status, testing | [frontend.md](frontend.md) |
| `database/README.md`: running locally, connection details, re-running scripts, inspecting | [database.md](database.md#11-running-connecting-and-inspecting) |
| `database/README.md`: schema, tables, ER diagram | [database.md](database.md#1-entity-relationship-diagram), [database.md](database.md#3-tables) |
| `database/README.md`: design decisions, task integrity, progress, overdue, reports | [database.md](database.md#12-deliberate-design-decisions), [database.md](database.md#5-triggers-and-functions) |
| `database/README.md`: authorization and permissions | [database.md](database.md#13-authorization-and-permissions) |
| `database/README.md`: least-privilege role | [database.md](database.md#7-least-privilege-application-role) |
| `database/README.md`: invariants, business rules | [database.md](database.md#9-invariant-checks), [database.md](database.md#5-triggers-and-functions) |
| `database/README.md`: API / backend coverage | [database.md](database.md#14-api--backend-coverage) |
| `database/README.md`: Flyway migrations and CLI | [database.md](database.md#8-migrations-vs-the-init-script) (sections 8.1 and 8.2) |

## Conventions used in these documents

- Names (classes, endpoints, tables, fields, files) are the real ones from the code.
- **verified live** = reproduced against the running application; **by code reading** = read in the source, not run; **Needs verification / Unknown** = could not be confirmed.
- ⚠ marks behaviour that contradicts the documented intent or a stated requirement.
- Statuses: *Done* means working through UI, API and database; a UI alone does not count ([roadmap.md](roadmap.md)).

## Keeping the documentation current

- **`docs/` is the only documentation to keep current.** There are no folder READMEs and `api/openapi.yaml` is no longer maintained, so whenever you change something, update the matching page here in the same pull request and add a [changelog.md](changelog.md) entry.
- The pages that go stale fastest are [api-reference.md](api-reference.md), [authentication-authorization.md](authentication-authorization.md) (permission matrix), [backend.md](backend.md) and [frontend.md](frontend.md) (status tables), [database.md](database.md) (table list and grants), [issues.md](issues.md), [roadmap.md](roadmap.md), [testing.md](testing.md) and [checklist/](checklist/done.md).
- Fix a bug listed in [issues.md](issues.md) → move it to the *Fixed* table, add a [changelog.md](changelog.md) entry, and add the regression test to [testing.md](testing.md#6-regression-tests-for-fixed-bugs).
- Make a decision that is hard to reverse → add an [ADR](adr/README.md).
- Change setup, ports, variables or scripts → update [setup.md](setup.md).
