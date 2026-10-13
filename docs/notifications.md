# Notifications

In-app notifications only (no email, push or SMS apart from the registration code email). Code: `service/NotificationService.java`, `controller/NotificationController.java`, `entity/Notification.java`, table `notifications`; UI: `frontend/src/data/NotificationsContext.jsx`, `layout/TopBar.jsx` (the bell).

## 1. Notification types

The `notifications.type` CHECK constraint allows 12 values and **all twelve are produced by the application today** (the approval pair since 2026-10-09; the deadline reminder and the overdue notice since 2026-10-10; comments, project updates and milestone updates since 2026-10-12; `MENTION` since 2026-10-13).

| Type | Produced? | Producer | Recipient |
|---|---|---|---|
| `TASK_ASSIGNED` | ✅ | `TaskAssigneeService.createTaskAssignee` → `notifyTaskAssigned` | the person assigned |
| `TASK_STATUS_CHANGED` | ✅ | `TaskService.updateTask` → `notifyTaskStatusChanged` | every current assignee of the task |
| `TEAM_INVITATION` | ✅ | `ProjectMemberService.inviteMember` → `notifyTeamInvitation` | the invitee |
| `TEAM_INVITATION_RESPONDED` | ✅ | `ProjectMemberService.respondToInvitation` → `notifyInvitationResponded` | the person who sent the invitation |
| `APPROVAL_REQUESTED` | ✅ | `TaskApprovalService.openRequest` / `designateApprover` → `notifyApprovalRequested` | the approver named for the task; otherwise every active member of the project who may approve; never the person asking |
| `APPROVAL_DECIDED` | ✅ | `TaskApprovalService.decide` / `recordDirectCompletion` → `notifyApprovalDecided` | the person who asked for the review (not when they decided it themselves) |
| `COMMENT_ADDED` | ✅ | `CommentService.createComment` → `UpdateNotificationService.notifyCommentAdded` (see §9) | the task's assignees, the project's Owner and Team Leaders, and for a reply the author of the comment it answers; never the author |
| `MENTION` | ✅ | `CommentService.createComment` / `updateComment` → `UpdateNotificationService.notifyMentioned` (see §9) | each active member of the task's project that the comment @mentions (an edit tells only the newly mentioned); never the author. They are not also sent the generic `COMMENT_ADDED` for that comment |
| `PROJECT_UPDATED` | ✅ | `ProjectService.updateProject` → `UpdateNotificationService.notifyProjectUpdated` (see §9) | the assignees of the project's tasks and the project's Owner and Team Leaders; never the person who edited |
| `MILESTONE_UPDATED` | ✅ | `MilestoneService.updateMilestone` → `UpdateNotificationService.notifyMilestoneUpdated` (see §9) | the assignees of the milestone's linked tasks and the project's Owner and Team Leaders; never the person who edited |
| `DEADLINE_REMINDER` | ✅ | `DeadlineNotificationService.sendReminders`, run by `DeadlineScheduler` (see §8) | the assignees of the task and the project's active Owner; for a milestone or a project, the Owner |
| `OVERDUE_TASK` | ✅ | `DeadlineNotificationService.sendOverdueNotices`, run by `DeadlineScheduler` (see §8). The seed script also calls `fn_generate_overdue_notifications()` once, so demo data contains older rows | the assignees of the overdue task and the project's active Owner |

## 2. Trigger conditions and content

| Type | Fires when | Title | Message |
|---|---|---|---|
| `TASK_ASSIGNED` | a `task_assignees` row is created | "New task assigned" | `<assigner> assigned you to "<task title>" in "<project>" — due <yyyy-mm-dd or "no due date set">` (since 2026-10-09; before: `You were assigned to "<task title>"`) |
| `TASK_STATUS_CHANGED` | a task update changes `status` (previous ≠ new) | "Task status updated" | `"<task title>" is now <Status>` (e.g. *In Progress*) |
| `APPROVAL_REQUESTED` | a task enters In Review, or an approver is named for a task already waiting | "Approval requested" | `<requester> asked you to review "<task>" in "<project>"` |
| `APPROVAL_DECIDED` | an approver approves, requests changes or rejects (or completes the task directly) | "Task approved" / "Changes requested" / "Task rejected" | `<approver> approved\|asked for changes on\|rejected "<task>"[: <comment>]` |
| `TEAM_INVITATION` | a project invitation is created or re-sent | "Team invitation" | `<inviter name> invited you to join "<project name>"` |
| `TEAM_INVITATION_RESPONDED` | the invitee accepts or declines (and the inviter still exists) | "Invitation accepted" / "Invitation declined" | `<invitee name> accepted|declined your invitation to join "<project name>"` |
| `COMMENT_ADDED` | a comment or a reply is added to a task | "New comment" / "New reply" | `<author> commented on\|replied on "<task>" in "<project>": <the first 100 characters>` |
| `MENTION` | a comment, or an edited comment, contains `@username` of an active member of the task's project | "You were mentioned" | `<author> mentioned you on "<task>" in "<project>": <the first 100 characters>` |
| `PROJECT_UPDATED` | a project is saved with at least one change (name, status, priority, dates or description), or becomes Completed | "Project updated" / "Project completed" | `<editor> updated "<project>" (status, end date)` / `<editor> marked "<project>" as completed` |
| `MILESTONE_UPDATED` | a milestone is saved with at least one change (title, description, due date, status), or becomes Completed | "Milestone updated" / "Milestone completed" | `<editor> updated milestone "<title>" in "<project>" (due date)` / `<editor> completed milestone "<title>" in "<project>"` |
| `DEADLINE_REMINDER` | 3 days or 1 day before a task's or milestone's due date or a project's end date, while it is not finished | "Deadline approaching" | `"<task>" in "<project>" is due in 3 days (<yyyy-mm-dd>)` / `… is due tomorrow (<date>)`; `Milestone "<title>" in "<project>" is due …`; `Project "<name>" ends in 3 days (<date>)` |
| `OVERDUE_TASK` | the day after a task's due date, while it is not Completed or Cancelled | "Task overdue" | `"<task>" in "<project>" was due on <yyyy-mm-dd> and is not yet completed` |

Details worth knowing:

- Each row records the related **project** (and **task**, for the first two and for comments) so the UI can show names.
- `TASK_STATUS_CHANGED` goes to **all** assignees, **including the person who made the change** — the actor is not excluded.
- The status-change notification is **not** sent when the status changes through the subtask auto-promotion (`SubtaskService.startTaskIfStillToDo` saves the task directly and does not call `NotificationService`).
- Unassigning a task, deleting a task, creating a project and creating a milestone create **no** notification, and neither does saving a project or a milestone without changing anything.
- The database function `fn_generate_overdue_notifications()` is no longer used by the application (only the seed script calls it, and it reaches assignees only). The scheduled job in §8 replaced it.

## 3. Read / unread behaviour

`notifications.is_read` defaults to `false`. Everything is scoped to the **caller's own** notifications by the token — there is no way to address another user's.

| Operation | Endpoint | Result |
|---|---|---|
| List mine (newest first) | `GET /api/notifications` (`?page=0&size=20` answers `{ items, total, page, size }`) | `NotificationResponse[]` — `id`, `type`, `title`, `message`, `projectId`, `projectName`, `taskId`, `taskTitle`, `read`, `createdAt` |
| Unread count | `GET /api/notifications/unread-count` | `{ "count": n }` **(verified live)** |
| Mark one read | `PUT /api/notifications/{id}/read` | updated notification |
| Mark all read | `POST /api/notifications/read-all` | `204` |
| Delete one | `DELETE /api/notifications/{id}` | `204` |

Marking or deleting someone else's notification returns **404** (not 403), so a client cannot tell "not yours" from "does not exist" (`NotificationService`).

## 4. Deletion and lifecycle

- Users delete a notification individually ("dismiss"); there is **no "delete all"** and no automatic expiry or cleanup.
- Notifications are removed by the database when the **recipient** is deleted, or when the related **project or task** is deleted (`ON DELETE CASCADE`).
- Paging is optional: with `?page` and `?size` (page from 0, size 1 to 200) the answer is `{ items, total, page, size }`, newest first with the id breaking ties; without them it is the full list. The bell uses 20 at a time.

## 5. The preference switch

`users.task_notifications_enabled` (default `true`; Settings page → Notifications; `PUT /api/users/me/preferences`). **Every producer checks it** (the scheduled ones also skip accounts that are not `ACTIVE`), so a user who turns it off stops receiving task, approval, reminder, overdue *and* invitation notifications.

This has a side effect on invitations: the notification is the only place the UI shows Accept/Decline, so an invitee with the switch off is never shown the invitation (see [users-and-projects.md](users-and-projects.md#43-accepting-or-declining)).

## 6. UI behaviour

- The bell (top bar) shows a dot when there are unread notifications and a dropdown list of the newest 20, with a *Show more (N older)* button that loads 20 more at a time (up to 200 shown).
- Clicking an unread notification marks it read; a **Mark all read** control and a per-item dismiss (✕) are available.
- A `TEAM_INVITATION` notification renders **Accept** and **Decline** buttons that call `POST /api/project-members/project/{projectId}/accept|decline`.
- The list is loaded when the app loads / after login and re-fetched after the user marks, dismisses or responds. There is **no polling or live push**, so a notification created while the page is open appears after a reload. The unread dot comes from `GET /api/notifications/unread-count`, so it counts the unread ones that are not loaded as well.

## 7. Seed data

`02-seed.sql` inserts notifications so the bell has content on first run, written with the application's own wording: the invitation notifications, `TASK_ASSIGNED` for recently created tasks, `TASK_STATUS_CHANGED`, `COMMENT_ADDED`, `APPROVAL_REQUESTED` and `APPROVAL_DECIDED` for the last two weeks, `DEADLINE_REMINDER` for work due tomorrow or in three days, and — by calling `fn_generate_overdue_notifications()` once — `OVERDUE_TASK` rows. Nothing is random: anything older than four days is read, newer is unread.

## 8. Deadline reminders and overdue notices (since 2026-10-10)

Created by `service/DeadlineNotificationService.java` and run by `config/DeadlineScheduler.java` (Spring `@Scheduled`): every day at **08:00 server time** and **once when the backend starts**, so a day missed while it was down is caught up. No schema change.

| Rule | Detail |
|---|---|
| Reminders | **3 days and 1 day before** the due date of a task that is not Completed or Cancelled, the due date of a milestone that is not completed, and the end date of a project that is not Completed or Cancelled. A day that was missed is not made up afterwards (a "due in 3 days" notice two days late would be wrong) |
| Overdue | A task that is not Completed or Cancelled and whose due date has passed (due on the 10th, overdue from the 11th). **Once** per person and due date, not every morning: the text carries no "days overdue", so it is the same every day and the duplicate check holds. If the due date is moved and passes again, a new notice follows |
| Recipients | Task: every assignee and the project's active **Owner**. Milestone and project: the Owner. Each person once. Skipped: people who switched task notifications off, accounts that are not `ACTIVE`, a project with no active Owner (the assignees are still told) |
| Never twice | A notification with the same type, text, person and item is not created again, so a restart, a second run or a manual run adds nothing. A reminder for a milestone or a project is stored with the project and no task |
| Settings | `app.deadlines.enabled` (`DEADLINES_ENABLED`, default `true`), `app.deadlines.cron` (`DEADLINES_CRON`, default `0 0 8 * * *`, Spring's second-minute-hour-day-month-weekday), `app.deadlines.run-on-startup` (`DEADLINES_RUN_ON_STARTUP`, default `true`). The context test turns the scheduler off so it never writes to the test database |
| Failure | An exception is logged (`Deadline notifications (…) failed`) and the next run tries again; it never stops the application. Each run logs `Deadline notifications (scheduled|startup): N created` |

The first run on a database that already holds overdue work creates a notice for every open overdue task, for each assignee and the Owner (53 on the development data on 2026-10-10). A database loaded from `02-seed.sql` already has older `OVERDUE_TASK` rows, written by the SQL function with slightly different text (no project name), so the scheduler adds its own on top the first time.


## 9. Comments, project updates and milestone updates (since 2026-10-12)

Created by `service/UpdateNotificationService.java`, called by `CommentService`, `ProjectService` and `MilestoneService` right after the change is saved (the same pattern as [ADR-0007](adr/0007-application-created-notifications.md)). The recipients follow the proposal D-10 of the brief ("assignees and the Owner / Team Leaders of the project; the actor excluded"):

| Event | Recipients |
|---|---|
| A comment or reply on a task | the task's assignees; the project's active Owner and Team Leaders; for a reply, also the author of the comment it answers |
| A person is @mentioned in a comment (since 2026-10-13) | that person, if they are an active member of the project with an active account; **instead of** the line above for them. See below |
| A project is edited or completed | the assignees of any task in the project; the project's active Owner and Team Leaders |
| A milestone is edited or completed | the assignees of the tasks linked to the milestone; the project's active Owner and Team Leaders |

**Mentions (since 2026-10-13, D-21).** A mention is `@` followed by a username (letters, digits, dots, underscores and hyphens), not glued to a word or another `@` (so an e-mail address is not one); punctuation after the name (`@dev.chen,`) is not part of it, and `@dev.chenx` is never read as `dev.chen`. The case is ignored. Only the project's **active members with an active account** count, and only in comments; the author is never notified, and a name that is not a member mentions nobody. A mentioned person gets `MENTION` and not also `COMMENT_ADDED` for that comment. Editing a comment tells only the people it newly mentions. `CommentResponse.mentions` lists who is mentioned (`id`, `username`, `fullName`), so the screen can highlight them. The rules live in `util/Mentions.java` (mirrored by `api/mentions.js` for the autocomplete and the highlighting).

Rules that apply to all of them:

- **Never the person who made the change**, and each person at most once (an assignee who is also the Owner gets one notification).
- People who switched task notifications off, and accounts that are not `ACTIVE`, are skipped (the same preference as every other notification, section 5).
- A Team Member who is not assigned to anything affected is **not** told: only the people with work in it, plus the project's leaders.
- Only real changes notify: a save that changes nothing, creating a project and creating a milestone do not. The message names the fields that changed (`status, end date`) and is cut to 500 characters, a comment preview to 100.
- A completed project or milestone gets its own title ("Project completed", "Milestone completed").
- Not covered: removing a member, deleting a project or milestone, and a time log produce no notification (D-10 leaves "member added / removed" pending).
