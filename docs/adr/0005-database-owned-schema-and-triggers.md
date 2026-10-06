# ADR-0005: Hand-written SQL schema; cross-row invariants in triggers

- **Status:** Accepted (with a known weakness: the Flyway record has drifted)
- **Date:** 2026-09-02 (`a4b92f7` "set up DB 2.0"); triggers expanded 2026-09-12 (`b692d3b`) and 2026-09-15 (`727f010`)
- **Area:** database

## Context

The requirements contain rules that span rows or tables (a task's due date must not exceed its project's end date; dependent tasks must be completed in order; a project must keep an owner; progress must follow completed work). These must hold no matter which code path writes the data.

## Decision

1. **The schema is plain SQL** in `database/init/01-init.sql` (plus `02-seed.sql`, `03-app-role.sh`), run by PostgreSQL's `docker-entrypoint-initdb.d` on an empty volume and by CI. Hibernate runs with `spring.jpa.hibernate.ddl-auto=validate`: the application **refuses to start** if the entities drift from the real schema.
2. **Enum-like fields** are `VARCHAR` + `CHECK`, not native PostgreSQL enums ("easier to extend later" — `database/README.md`).
3. **Cross-row rules are database triggers** (23 triggers; see [../database.md](../database.md#5-triggers-and-functions)). Per-request rules and friendly messages stay in services; several rules exist in both places on purpose (service = early clean error, trigger = backstop that cannot be bypassed).
4. **Every validation trigger raises with `ERRCODE '23514'`** so Hibernate classifies it as a constraint violation and `GlobalExceptionHandler` returns a readable `400`. Without it the error surfaced as an unclassified `500` (a bug the project hit — commit `52f08b7`; recorded in the README and in `01-init.sql` comments).
5. **Flyway** (`database/taskmanager/`) is kept as a **parallel, versioned record** of the same schema; it is **not** run by the application.
6. `database/verify_invariants.sql` re-checks the main invariants on seeded data and is run by CI.

## Alternatives considered

- **Hibernate-generated schema (`ddl-auto=update/create`)** — avoided so that an entity change cannot silently alter the database (stated: "app fails fast if entities drift from the real schema instead of silently auto-migrating").
- **Validation only in Java** — avoided for cross-row rules because a second writer (SQL, another service, a bug) could bypass it (stated in the trigger comments).
- **Flyway as the real migration mechanism** — **deferred**: `README.md` lists "wire Flyway into the actual startup path" as future work; it would mean adding `flyway-core` or a CLI step.
- **Native enum types** — avoided (above).

## Consequences

- Strong guarantees: invalid states are unrepresentable (assignee not a member, dependency cycles, stale progress).
- Rules are split across SQL and Java; the same logic sometimes appears twice (for example the subtask completion gate).
- **Two schema sources must be kept in sync by hand, and they have drifted:** the five task/subtask consistency objects exist only in `01-init.sql` ([../database.md](../database.md#8-migrations-vs-the-init-script), issue X-04). Editing one without the other "is how the drift this project had before gets reintroduced" (`database/README.md`).
- Changing the schema locally requires wiping the data volume (`docker compose down -v`) because init scripts run only against an empty volume.
- Triggers are not covered by automated tests that try forbidden writes (see [../testing.md](../testing.md#5-database-tests)).
- `CHECK` violations and most unique violations still reach clients as raw PostgreSQL text (issue I-11).

## Evidence

`database/init/01-init.sql`, `database/README.md`, `GlobalExceptionHandler`, `verify_invariants.sql`, `.github/workflows/ci.yml`, migrations `V1`–`V8`.
