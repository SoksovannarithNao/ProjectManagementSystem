# ADR-0007: Notifications are created by application code

- **Status:** Accepted
- **Date:** 2026-09-10 (`52f08b7` introduced `NotificationService`); invitation notifications added 2026-09-13
- **Area:** api / database

## Context

Notifications must tell the right person about an event: someone assigned to a task, a status change, an invitation and its response. The database was already doing other work with triggers (see [ADR-0005](0005-database-owned-schema-and-triggers.md)), so a trigger-based design was an option.

## Decision

`service/NotificationService` creates notification rows from Java, called by other services **right after** the triggering change is saved: `TaskAssigneeService` → `notifyTaskAssigned`; `TaskService.updateTask` → `notifyTaskStatusChanged`; `ProjectMemberService.inviteMember` → `notifyTeamInvitation`; `respondToInvitation` → `notifyInvitationResponded`. All of them honour the recipient's `task_notifications_enabled` preference. Reading, marking read and deleting are self-scoped by the token.

## Why (as stated in the project)

`README.md` — *Key Design Decisions* #6: unlike cross-row rules, "who should be notified" already requires looking up related rows (assignees) that the service layer has on hand; keeping it in Java keeps the notification text and type logic **in one reusable place instead of duplicated PL/pgSQL**.

## Alternatives considered

- **Database triggers** — not chosen (above).
- **Event bus / async queue** — not present; notifications are written synchronously in the same transaction *(by code reading)*.
- **A scheduled job** for deadline and overdue reminders — **built 2026-10-10** as a Spring `@Scheduled` job (`DeadlineScheduler` → `DeadlineNotificationService`), in the same application-created style as the other notifications rather than extending the database function: the function reached assignees only, ignored the notification preference and repeated every day. The function is no longer used by the application.

## Consequences

- Message wording and the on/off preference are in one class; easy to extend with a new `notifyX` method.
- Only code paths that call `NotificationService` produce notifications: changes made directly in SQL, and the subtask auto-promotion of a task's status, produce none.
- The single switch `task_notifications_enabled` also controls **invitation** notifications, which are the only place the UI offers Accept/Decline — a user who turns it off cannot see invitations (issue I-12).
- Delivery is in-app only and pull-based (no push; the UI fetches at load and after the user's own actions).
- 4 of the 9 allowed notification types are produced.

## Evidence

`NotificationService`, `TaskAssigneeService`, `TaskService`, `ProjectMemberService`, `frontend/src/layout/TopBar.jsx`; [../notifications.md](../notifications.md).
