# User & Project Management

Users, projects, project membership and the invitation workflow. Code: `UserService`, `ProjectService`, `ProjectMemberService`, `ProjectAccessGuard`; UI: `pages/Team.jsx`, `pages/Projects.jsx`, `pages/ProjectDetail.jsx`, `components/NewProjectModal.jsx`, `AddProjectMemberModal.jsx`, `AddMemberModal.jsx`, `EditUserModal.jsx`. Permission rules are summarized in [authentication-authorization.md](authentication-authorization.md#52-project-scope-matrix).

## 1. User lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING_VERIFICATION: self-register
    PENDING_VERIFICATION --> ACTIVE: verify OTP
    [*] --> ACTIVE: created by an administrator
    ACTIVE --> INACTIVE: administrator
    ACTIVE --> SUSPENDED: administrator
    INACTIVE --> ACTIVE: administrator
    SUSPENDED --> ACTIVE: administrator
    ACTIVE --> [*]: administrator deletes
```

| Stage | How | Notes |
|---|---|---|
| Create (self) | `POST /api/auth/register` → `POST /api/auth/verify-otp` | Gets the system role `USER` (cannot create projects until an Administrator makes the account a Project Manager); `fullName` = username until edited. See [authentication-authorization.md](authentication-authorization.md#12-self-registration-with-email-verification) |
| Create (administrator) | `POST /api/users` (UI: Team → *Add User*) | The administrator sets a temporary password that must satisfy the [password policy](authentication-authorization.md#4-password-policy); optional system role (default `USER`; project-only roles are refused), position, department, status (default `ACTIVE`). The success message says to "share their temporary password to sign in" — no email is sent to the new user |
| Profile | `PUT /api/users/me` | Editable by the user: full name, email, gender, date of birth, phone, position and department (chosen from the managed lists; `null` clears). **Not** editable by the user: username, role, status |
| Photo | `PUT /api/users/me/photo` (multipart `file`), `DELETE /api/users/me/photo` | JPEG, PNG, WEBP or GIF only; max 5 MB (`spring.servlet.multipart`); stored as bytes in `users.profile_photo`; served publicly at `/api/photos/{token}` (see [ADR-0009](adr/0009-profile-photos-in-database.md)) |
| Preferences | `PUT /api/users/me/preferences` | `themePreference` (`LIGHT`/`DARK`/`SYSTEM`) and `taskNotificationsEnabled`. Turning notifications off does **not** stop invitation notifications (they are the only place to accept) — see [notifications.md](notifications.md#5-the-preference-switch) |
| Position / department | `PUT /api/users/{id}/position-department` | A user sets their own on the **Profile** page (`PUT /api/users/me`, chosen from the lists); a "team admin" can set them for someone else here, never for themselves. Lists are org-wide (`positions`, `departments`; names unique case-insensitively) |
| Change status / edit | `PUT /api/users/{id}` (administrator) | Full replace of the fields in `UserUpdateRequest` including `username`. Setting a non-`ACTIVE` status is refused while the user is the **sole active owner** of any project |
| Give a system role | `PUT /api/users/{id}/role` `{ "roleId" }` (`USER:ASSIGN`, administrator) | UI: Administration → Users. `VIEWER` (project-only) is refused; the last Administrator cannot be demoted |
| Delete | `DELETE /api/users/{id}` (administrator) | Refused while the user is a sole active owner. Database cascades remove their memberships, comments, assignments, notifications and OTP rows; `tasks.created_by`, `subtasks.assignee_id` and `activity_logs.user_id` become NULL. `projects.manager_id` is `ON DELETE RESTRICT`, so deleting a user who is still a project's manager fails at the database |

The UI for administrators covers creating an account (Team → *Add User*, which opens `AddMemberModal` in the right-hand side panel) and, in Administration → Users (`pages/admin/UsersAdmin.jsx`, with a search box and the account status shown as a badge), giving an account its system role, editing it (`components/EditUserModal.jsx`: name, username, e-mail, gender, date of birth, phone, position, department, account status and an optional new password; `PUT /api/users/{id}`) and deleting it (`DELETE /api/users/{id}`, after a confirmation). Setting the status to Inactive or Suspended is how an account is deactivated. The server refuses to deactivate or delete the last Administrator or the sole owner of a project, and to delete your own account; the screen also hides Delete on your own row and locks your own status. The Team page lists users the caller can see and lets team admins set position/department and manage a member's project membership.

The user directory (`GET /api/users`) is scoped: an administrator sees everyone; everyone else sees themselves plus people who share an *active* project with them. A brand-new account with no projects sees only itself. **Single-user lookups follow the same rule** (`GET /api/users/{id}` and `/api/users/username/{username}`): you can read an account's profile only if you are an administrator, it is you, or you share an active project with them; otherwise the answer is the same `404` as for a user that does not exist, so the lookup neither exposes profiles nor confirms that an account exists.

## 2. Projects

### 2.1 Fields (`projects` table, `ProjectRequest` / `ProjectResponse`)

| Field | Rules |
|---|---|
| `projectCode` | **Generated by the server** on create: the next `PRJ-####` after the highest existing `PRJ-` code (`ProjectService.generateProjectCode`, which takes a database lock until the transaction ends so that simultaneous creates cannot choose the same number; the seed data uses `PRJ-2001`…`PRJ-2010`). The request field is optional; if a code is supplied it is trimmed, must be ≤ 30 characters and unique (`409 "Project code already exists."`). A blank value on create means "generate"; on update it means "keep the current code". The UI never asks for one, and shows it read-only on Edit |
| `name` | required, ≤ 200 |
| `description` | optional text |
| `startDate`, `endDate` | both required; `endDate` ≥ `startDate` (form, plus a database `CHECK`) |
| `managerId` | optional. The caller becomes manager; only a system administrator can name someone else (others' value is ignored) |
| `priority` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` (default `MEDIUM`) |
| `status` | `PLANNING` (default), `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CANCELLED` |
| `progress` | **Derived** — see below; any value sent is overwritten by the database |
| `completedAt` | **Derived** — response only; the database sets it when the status becomes `COMPLETED` and clears it otherwise (see below) |
| `createdAt`, `updatedAt` | maintained by the database; `createdAt` is shown as *Created* on the project page (since 2026-10-14) |

**Progress** = `100 × completed tasks ÷ non-cancelled tasks` (0 when there are no tasks), recomputed by triggers whenever a task is created, changed, moved or deleted, and on every direct update of the project row (`fn_compute_project_progress`, `trg_tasks_progress_sync`, `trg_projects_progress_derived`).

### 2.2 Lifecycle and operations

| Operation | Endpoint | Who | Behaviour |
|---|---|---|---|
| Create | `POST /api/projects` | `PROJECT:CREATE` — Project Manager or Administrator (`403` otherwise) | Creator becomes manager **and** an active `OWNER` member (`ensureManagerIsMember`). UI sends `status: PLANNING`, `progress: 0` |
| List | `GET /api/projects` | any authenticated user | Administrator: all. Others: projects where they are an **active** member |
| Read | `GET /api/projects/{id}` | active member / administrator | `404` for non-members |
| Update | `PUT /api/projects/{id}` | `PROJECT:EDIT` (Project Manager, Team Leader, Administrator) | Full replace. UI: Edit dialog (name, description, dates, priority; manager dropdown for administrators) and an inline status dropdown on the project page |
| Delete | `DELETE /api/projects/{id}` | `PROJECT:DELETE` (Project Manager, Administrator) | Database cascades delete the project's members, milestones, tasks and everything under them |

Observations:

- **No rule links project status to its tasks.** Nothing prevents setting a project to `COMPLETED` while tasks are open. *(Confirmed by reading `ProjectService` and the schema.)*
- **Completion date (since 2026-10-12, `V14`).** `projects.completed_at` is stamped by the trigger `trg_projects_completed_at` when the status becomes `COMPLETED`, kept while a completed project is edited, and cleared when it is reopened. It is returned as `completedAt`, shown as *Completed on <date>* on the project page and listed in the Project and Project Status reports; the application never writes it. Projects that were already completed when `V14` ran got their last update time.
- **Project lead (since 2026-10-13, `V15`).** A project has one responsible person, the Owner (D-09); a Team Leader can be named beside them as the **lead**. `projects.lead_id` holds it, and the Owner or an Administrator (`PROJECT:ASSIGN`) sets or clears it with `PUT /api/projects/{id}/lead` (the project page's *Make lead* / *Remove as lead*). Only an *active Team Leader of that project* can be named (`400` otherwise). The lead is cleared when that person is demoted, removed or made the Owner (`ProjectMemberService` and `ProjectOwnership` clear it; the trigger `trg_project_members_clear_lead` backs them up, and `trg_projects_lead_is_team_leader` refuses any other value). The lead has the rights of a Team Leader and no more. The change is logged as `PROJECT_LEAD_CHANGED`; the project header, the Lead field and the project card show the lead.
- The Projects page search matches the project name, description, code, manager, status and dates.
- **Filter** (since 2026-10-09): status (Planning, Active, On Hold, Completed, Cancelled), priority and project manager; they combine with AND and with the search, and **Clear filters** resets them. **Sort**: Default (fully complete 100% projects last), name, start date, end date, priority, progress. Both work in the browser over the projects the server already limited to the caller, so they never reveal a project the user cannot open. `GET /api/projects` takes the same fields as parameters ([api-reference.md](api-reference.md#6-projects)). `GET /api/projects` takes the same fields as parameters ([api-reference.md](api-reference.md#6-projects)). `GET /api/projects` takes the same fields as parameters ([api-reference.md](api-reference.md#6-projects)). `GET /api/projects` takes the same fields as parameters ([api-reference.md](api-reference.md#6-projects)). `GET /api/projects` takes the same fields as parameters ([api-reference.md](api-reference.md#6-projects)). `GET /api/projects` takes the same fields as parameters ([api-reference.md](api-reference.md#6-projects)).
- The Projects page subtitle reads "N active projects" but counts every project the caller can see.

## 3. Project membership

`project_members` — one row per (project, user) (`UNIQUE (project_id, user_id)`):

| Column | Meaning |
|---|---|
| `project_role` | `OWNER`, `ADMIN`, `MEMBER` (default), `VIEWER` |
| `status` | `PENDING`, `ACTIVE` (default), `DECLINED` |
| `invited_by` | who sent the invitation (NULL for direct adds / deleted users) |
| `responded_at` | when the invitee accepted or declined |
| `joined_at` | row creation time |

Two ways a row appears:

1. **Direct add** — `POST /api/project-members` (`MEMBER:CREATE`). Becomes `ACTIVE` immediately. Used internally when a project is created (the creator → `OWNER`). Adding as `OWNER` is refused; making a member the owner is a transfer (below). Inactive/suspended users are refused.
2. **Invitation** — see below.

**Role names on screen (since 2026-10-14).** A project role has one name on every screen (`projectRoleLabel` in `api/format.js`): *Owner*, *Admin (Team Leader)*, *Member (Team Member)* and *Viewer*. Roles & Permissions uses the same names; the brackets give the assignment's business names. Only the label: the stored values (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`) and the API are unchanged, and the server's own messages (for example "Only a Team Leader can be its lead") keep their wording.

Other operations: `PUT /api/project-members/{id}` (change role; `MEMBER:EDIT`; role `OWNER` = transfer ownership, `PROJECT:ASSIGN`, one step, previous owner becomes `ADMIN`), `DELETE /api/project-members/{id}` (remove; `MEMBER:DELETE`; blocked if it would remove the last active owner). In the UI, **removal** is on the Team page (an ✕ beside a project in a member's list). **Role changes** are on the project page since 2026-10-09: each member (except you and the Owner) has a role picker — *Team Leader*, *Team Member*, *Viewer* for the Owner and an Administrator, only *Team Member* / *Viewer* for a Team Leader (who cannot touch another leader) — and *Owner (transfer ownership)* appears for a member who can own projects, behind a confirmation. The project page also links to **Team tasks**, **Workload** (for people who can assign tasks), **Timeline** and **Gantt** (everyone); see [frontend.md](frontend.md).

Reads: `GET /api/project-members` and `GET /api/project-members/project/{id}` return **active** members only; `GET /api/project-members/{id}` requires access to that row's project; `GET /api/project-members/user/{userId}` is **scoped**: an administrator gets every row, anyone else only the user's *active* memberships in projects the caller also belongs to. `PUT /api/project-members/{id}` can change only the **role** — the row's project and user cannot be re-pointed (`400`).

## 4. Invitations

### 4.1 State machine

```mermaid
stateDiagram-v2
    [*] --> PENDING: invite
    [*] --> ACTIVE: direct add
    PENDING --> ACTIVE: invitee accepts
    PENDING --> DECLINED: invitee declines
    DECLINED --> PENDING: invited again (same row reused)
    ACTIVE --> [*]: removed (row deleted)
    PENDING --> [*]: row deleted
```

There is no separate invitation table: a project is the team, and an invitation is simply a `project_members` row that is not yet `ACTIVE` ([ADR-0003](adr/0003-project-membership-and-invitations.md)).

### 4.2 Sending an invitation — `POST /api/project-members/invite`

Request: `{ "projectId": 1, "username": "newuser", "projectRole": "MEMBER" }` (`projectRole` optional: `ADMIN`, `MEMBER` (default) or `VIEWER`) → `201` with a `ProjectMemberResponse` (`status: PENDING`). The Team page's invite form and the project page's *Add Member* dialog each have a role picker (Team Member, Team Leader, Viewer).

Rules, in order (`ProjectMemberService.inviteMember`):

1. Caller must hold `MEMBER:CREATE` in the project (Project Manager, Team Leader, Administrator) — `403 "You do not have permission to invite or add people to this project"`. Inviting as `OWNER` is refused: ownership is transferred, not invited.
2. The target is looked up by **username, case-insensitive, exact match** — partial names and emails do not match (`404 "No user found with that username"`).
3. You cannot invite yourself (`400 "You cannot invite yourself"`).
4. The target account must be `ACTIVE` (`400 "<username> has an inactive account and can't be added to a project"`) — this covers `INACTIVE`, `SUSPENDED` and `PENDING_VERIFICATION`.
5. If a row already exists: `ACTIVE` → `400 "…is already a member of this team"`; `PENDING` → `400 "An invitation is already pending for …"`; `DECLINED` → the row is reused and set back to `PENDING`.
6. A `TEAM_INVITATION` notification is created for the invitee, whatever their notification switch says (since 2026-10-14, I-12).

The API default is `MEMBER`. The Team page and the project page's *Add Member* dialog (since 2026-10-14) both send the chosen role; the dialog offers Team Member (the default), Team Leader and Viewer, never Owner, and the Owner or a Team Leader can change the role afterwards (section 3).

### 4.3 Accepting or declining

`POST /api/project-members/project/{projectId}/accept` and `…/decline` — callable only for **your own** pending row (resolved from the token; `404 "No invitation found"`, or `400 "This invitation is no longer pending"`). Accepting sets `ACTIVE`; declining sets `DECLINED`. Either stamps `responded_at` and notifies the inviter (`TEAM_INVITATION_RESPONDED`).

**In the UI** the only place to respond is the **notification bell** in the top bar: a `TEAM_INVITATION` notification shows **Accept** and **Decline** buttons (`layout/TopBar.jsx`). The inviter sees the response as a notification.

Consequences:

- The invitation is surfaced to the invitee **only through that notification**, which is created even when the invitee has turned task notifications off (since 2026-10-14, I-12; before that the row stayed `PENDING` with no way to accept). *(`NotificationService.notifyTeamInvitation`.)*
- Notifications are fetched at page load and after the user's own actions; a freshly sent invitation appears after the invitee's next reload.
- A `PENDING` or `DECLINED` row grants no access, no task assignment, and does not appear in member lists.

### 4.4 Pending invitations

| Need | Endpoint | Who |
|---|---|---|
| Count | `GET /api/project-members/project/{id}/invitations/count` → `{ "count": n }` | `MEMBER:CREATE` holders |
| List | `GET /api/project-members/project/{id}/invitations` → `ProjectMemberResponse[]` (status `PENDING`) | same |

The count comes from a database count of `PENDING` rows (`ProjectMemberRepository.countByProjectIdAndStatus`), not from the (active-only) members list. The project page shows "**N pending invitation(s)**" under the member list **to managers only**. Since 2026-10-14 the project page also **lists** the pending invitations to managers (the person, the role offered, who invited them) with a **Cancel** button, which calls `DELETE /api/project-members/{id}` on that row and removes the invitee's *Team invitation* notification with it (I-13). The seed data contains pending invitations (for example `dev.tomas` on `PRJ-2001`).

## 5. Entry points in the UI

| Where | What it does |
|---|---|
| Project page → Members → **Add member** (managers only) | Opens `AddProjectMemberModal` in the right-hand side panel: pick the person from a combo box (searched by name or username as you type; only an existing, active user who is not already in the project can be chosen), choose the *Role in this project* (Member (Team Member) by default, Admin (Team Leader) or Viewer), **Send Invitation** → `POST /api/project-members/invite` with that `projectRole` |
| Team page → select a member → **Invite to team** | Picks a project the caller administers and calls the same endpoint for the selected member. Hidden, with an explanatory note, when the member is not `ACTIVE` |
| Top bar bell | Accept / Decline an invitation you received |
| Team page → ✕ beside a project | Remove that member from the project |

## 6. Member search and eligibility

`GET /api/project-members/project/{projectId}/invitable-users?q=<text>&limit=<n>` (managers only) powers the picker.

**Eligible = all of:** the account is `ACTIVE`; it is not the caller; it has no `ACTIVE` or `PENDING` membership on this project (a `DECLINED` user *is* eligible again).

**Matching:** case-insensitive substring on `username` **or** `fullName`; `%` and `_` typed by the user are matched literally (escaped). Results are ordered by full name, **filtered and limited in the database** (`UserRepository.findInvitableUsers`), default 10, clamped to 1–20. Users are found **even if they share no project** with the caller. The response is a narrow DTO — `id`, `fullName`, `username`, `positionName`, `profilePhotoUrl` (no email, phone or date of birth).

**Enforcement is separate from the suggestions:** the backend rejects ineligible targets in `inviteMember` and `createProjectMember` regardless of what the UI offered, so typing a username that was not suggested still goes through the same checks.

UI behaviour (`AddProjectMemberModal`, built on the shared `Combobox`): the list is the server's answer to `GET .../invitable-users?q=` and refreshes 250 ms after typing stops (the first ten people when nothing is typed); each row shows an avatar, the full name and *username · position*; arrow keys and Enter choose, Escape closes the list only; a failed lookup silently keeps the previous list; only a listed person can be chosen (there is no free text, so an inactive or suspended account, an existing member or a pending invitee cannot be sent from the screen, while the API still refuses them with its own messages). **Team → Add Member** opens the same panel with a *Project* combo box first (the projects the caller manages; the person box stays disabled until one is chosen) and is shown to anyone who manages at least one project. **Team → Add User** is a different thing: an administrator creating an account.
