# Notifications

In-app notifications only (no email, push or SMS apart from the registration code email). Code: `service/NotificationService.java`, `controller/NotificationController.java`, `entity/Notification.java`, table `notifications`; UI: `frontend/src/data/NotificationsContext.jsx`, `layout/TopBar.jsx` (the bell).

## 1. Notification types

The `notifications.type` CHECK constraint allows 9 values. **Four are produced by the application today.**

| Type | Produced? | Producer | Recipient |
|---|---|---|---|
| `TASK_ASSIGNED` | ✅ | `TaskAssigneeService.createTaskAssignee` → `notifyTaskAssigned` | the person assigned |
| `TASK_STATUS_CHANGED` | ✅ | `TaskService.updateTask` → `notifyTaskStatusChanged` | every current assignee of the task |
| `TEAM_INVITATION` | ✅ | `ProjectMemberService.inviteMember` → `notifyTeamInvitation` | the invitee |
| `TEAM_INVITATION_RESPONDED` | ✅ | `ProjectMemberService.respondToInvitation` → `notifyInvitationResponded` | the person who sent the invitation |
| `COMMENT_ADDED` | ❌ | — (comments notify nobody) | — |
| `PROJECT_UPDATED` | ❌ | — | — |
| `MILESTONE_UPDATED` | ❌ | — | — |
| `DEADLINE_REMINDER` | ❌ | — (no code or database function exists for it) | — |
| `OVERDUE_TASK` | ⚠ | Only the database function `fn_generate_overdue_notifications()` can create it. The **seed script calls it once** (so demo data contains some); at runtime **nothing calls it** (no `@Scheduled` job, no `pg_cron`) | assignees of overdue tasks |

## 2. Trigger conditions and content

| Type | Fires when | Title | Message |
|---|---|---|---|
| `TASK_ASSIGNED` | a `task_assignees` row is created | "New task assigned" | `You were assigned to "<task title>"` |
| `TASK_STATUS_CHANGED` | a task update changes `status` (previous ≠ new) | "Task status updated" | `"<task title>" is now <Status>` (e.g. *In Progress*) |
| `TEAM_INVITATION` | a project invitation is created or re-sent | "Team invitation" | `<inviter name> invited you to join "<project name>"` |
| `TEAM_INVITATION_RESPONDED` | the invitee accepts or declines (and the inviter still exists) | "Invitation accepted" / "Invitation declined" | `<invitee name> accepted|declined your invitation to join "<project name>"` |

Details worth knowing:

- Each row records the related **project** (and **task**, for the first two) so the UI can show names.
- `TASK_STATUS_CHANGED` goes to **all** assignees, **including the person who made the change** — the actor is not excluded.
- The status-change notification is **not** sent when the status changes through the subtask auto-promotion (`SubtaskService.startTaskIfStillToDo` saves the task directly and does not call `NotificationService`).
- Unassigning a task, deleting a task, comments, project edits and milestone edits create **no** notification.
- `fn_generate_overdue_notifications()` (if it were called) inserts one `OVERDUE_TASK` notification per overdue task per current assignee, at most one per (user, task) per calendar day.

## 3. Read / unread behaviour

`notifications.is_read` defaults to `false`. Everything is scoped to the **caller's own** notifications by the token — there is no way to address another user's.

| Operation | Endpoint | Result |
|---|---|---|
| List mine (newest first) | `GET /api/notifications` | `NotificationResponse[]` — `id`, `type`, `title`, `message`, `projectId`, `projectName`, `taskId`, `taskTitle`, `read`, `createdAt` |
| Unread count | `GET /api/notifications/unread-count` | `{ "count": n }` **(verified live)** |
| Mark one read | `PUT /api/notifications/{id}/read` | updated notification |
| Mark all read | `POST /api/notifications/read-all` | `204` |
| Delete one | `DELETE /api/notifications/{id}` | `204` |

Marking or deleting someone else's notification returns **404** (not 403), so a client cannot tell "not yours" from "does not exist" (`NotificationService`).

## 4. Deletion and lifecycle

- Users delete a notification individually ("dismiss"); there is **no "delete all"** and no automatic expiry or cleanup.
- Notifications are removed by the database when the **recipient** is deleted, or when the related **project or task** is deleted (`ON DELETE CASCADE`).
- There is no pagination: the full list is returned each time.

## 5. The preference switch

`users.task_notifications_enabled` (default `true`; Settings page → Notifications; `PUT /api/users/me/preferences`). **Every one of the four producers checks it**, so a user who turns it off stops receiving task *and* invitation notifications.

This has a side effect on invitations: the notification is the only place the UI shows Accept/Decline, so an invitee with the switch off is never shown the invitation (see [users-and-projects.md](users-and-projects.md#43-accepting-or-declining)).

## 6. UI behaviour

- The bell (top bar) shows a dot when there are unread notifications and a dropdown list.
- Clicking an unread notification marks it read; a **Mark all read** control and a per-item dismiss (✕) are available.
- A `TEAM_INVITATION` notification renders **Accept** and **Decline** buttons that call `POST /api/project-members/project/{projectId}/accept|decline`.
- The list is loaded when the app loads / after login and re-fetched after the user marks, dismisses or responds. There is **no polling or live push**, so a notification created while the page is open appears after a reload. (`GET /api/notifications/unread-count` exists but the UI computes the count from the loaded list.)

## 7. Seed data

`02-seed.sql` inserts notifications so the bell has content on first run: invitation notifications, one `TASK_ASSIGNED` per seeded assignment, one `TASK_STATUS_CHANGED` per assignment on a non-`TO_DO` task, and — by calling `fn_generate_overdue_notifications()` once — `OVERDUE_TASK` rows. Read/unread flags on the generated ones are randomised (`random()`), and the seeded status messages print the raw status (for example `IN_PROGRESS`) whereas notifications created by the app print `In Progress`.
