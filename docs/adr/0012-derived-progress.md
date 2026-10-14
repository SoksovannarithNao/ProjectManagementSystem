# ADR-0012: Progress is derived by the database, not trusted from clients

- **Status:** Accepted
- **Date:** 2026-09-12 (`b692d3b`, migration `V2`); task-from-subtask progress 2026-09-15 (`727f010`, init only)
- **Area:** database / business logic

## Context

`Role_Requirment.md`: "Project Progress should be calculated as a percentage based on completed tasks compared with total tasks", and progress must update when a task changes. Tasks, milestones and projects all have a `progress` column that clients can also send.

## Decision

`progress` columns stay ordinary writable `NUMERIC(5,2)` columns (so the API contract did not change) but are **derived**, never authoritative:

- **Project and milestone progress** = `round(100 × completed ÷ non-cancelled tasks, 2)` (0 when none) — functions `fn_compute_project_progress` / `fn_compute_milestone_progress`.
  - An `AFTER` trigger on `tasks` recomputes the parent project and milestone whenever a task is inserted, updated (including moving between projects/milestones) or deleted.
  - `BEFORE UPDATE` triggers on `projects` and `milestones` recompute and **overwrite** `NEW.progress` on every update, so a client-supplied value cannot stick.
- **Task progress** = `round(100 × completed ÷ subtasks, 2)` when the task has subtasks; with no subtasks the stored value is left alone.
- `CANCELLED` tasks are excluded from both numerator and denominator.

## Why (as stated in the project)

The init-script comments call it "writable but not authoritative"; the goal is that progress "can never go stale" and the UI/API need no extra work to keep it consistent (`../database.md`, *Progress, overdue detection, and reports*).

## Alternatives considered

- **Compute in Java on read or write** — not chosen: a second writer could leave it stale (inferred from the choice of triggers, [ADR-0005](0005-database-owned-schema-and-triggers.md)).
- **Remove the column and compute on read** — not chosen: the existing API/DTO contract and sorting by progress rely on a stored value *(inferred)*.
- **Trust the client's value** — rejected (the point of the decision).

## Consequences

- Progress is always consistent with tasks; verified by `verify_invariants.sql` (checks 6 and 7) in CI.
- Side effect: a project's/milestone's `updated_at` changes whenever any of its tasks change.
- Writes fan out (a task change updates its project and milestone rows); heavy bulk updates would be slower.
- Any value sent in `progress` for a project or milestone is silently ignored.
- The task-progress triggers exist only in `01-init.sql`, not in Flyway (drift, issue X-04).
- The formula counts task *status*, not effort: a task's size (estimated hours) does not weight the percentage.

## Evidence

`01-init.sql` (section "project/milestone progress (derived)" and "task/subtask completion consistency"), `verify_invariants.sql`, `TaskResponse` (progress shown as stored).
