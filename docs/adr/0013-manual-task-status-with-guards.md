# ADR-0013: Task status is manual, with two guarded exceptions

- **Status:** Accepted
- **Date:** 2026-09-14/15 (`9f0a872`, `727f010`)
- **Area:** business logic

## Context

Subtasks represent a task's checklist, and dependencies say some tasks must wait for others. It would be easy to let the system change a task's status automatically (complete a task when all subtasks are done, reopen it when one is unchecked) — but that second-guesses the user.

## Decision

A task's **status is set by people**. The system intervenes in exactly three narrow, one-directional ways:

1. **Completion gate:** a task cannot **enter** `COMPLETED` while any subtask is not `COMPLETED` (service check with a clean message, plus trigger `trg_tasks_not_completed_with_open_subtasks`). It never reaches back: an already-completed task stays completed if a subtask is added or reopened.
2. **Dependency gate:** a task cannot move to `IN_PROGRESS`, `IN_REVIEW` or `COMPLETED` while a prerequisite is not `COMPLETED` (triggers). `TO_DO` and `CANCELLED` are always allowed.
3. **Auto-promotion:** the first time a subtask of a still-`TO_DO` task is touched, the task moves to `IN_PROGRESS` once (`SubtaskService.startTaskIfStillToDo`) — skipped if the task is blocked by a dependency. It never demotes or completes anything.

Only the task's **progress %** follows its subtasks automatically ([ADR-0012](0012-derived-progress.md)). The backend does not enforce a fixed transition order (any status can be set from any other, subject to the gates).

## Why (as stated in the project)

`README.md` — *Key Design Decisions* #9: a subtask touch can promote its parent (a clear "work has started" signal) but nothing auto-completes a task, and unchecking a subtask never reverts the parent — "task status stays otherwise entirely manual, so a user's own explicit status change is never second-guessed."

## Alternatives considered

- **Derive status fully from subtasks** — rejected (stated).
- **Strict transition state machine** — not implemented; the UI's quick-advance control walks To Do → Doing → Done, but the API and dropdown allow any move *(by code reading)*.
- **Fail the subtask update when the parent cannot be promoted** — avoided: the promotion is skipped for blocked tasks because the trigger would throw and roll the subtask update back too (stated in `SubtaskService`).

## Consequences

- Predictable behaviour; users are never surprised by automatic status changes beyond the one auto-promotion.
- A task can sit at `TO_DO` with every subtask done (by design).
- The auto-promotion changes status without creating a notification and does log an activity entry (issue I-17).
- Reopening a task clears `completed_at` (`trg_tasks_completed_at` clears it whenever the status is not `COMPLETED`).
- The completion-gate message exists in three places (service, trigger, UI) and must stay identical.

## Evidence

`SubtaskService`, `TaskService.assertNotCompletingWithOpenSubtasks`, `01-init.sql` (triggers), `frontend/src/api/tasks.js`, `TaskDetailPanel.jsx`; [../tasks.md](../tasks.md#5-subtasks).
