# Users (administration)

**Route** `/admin/users` · **Access** `USER:VIEW` (Administrator by default) · **Source** [UsersAdmin.jsx](../../frontend/src/pages/admin/UsersAdmin.jsx)

## What it does
Lists every account and lets an authorised person change its system role, edit it or delete it.

## How it works
- Each row shows the avatar, full name, @username, e-mail, a badge when the account is not active (Inactive, Suspended) and the role.
- **Search** matches name, username, e-mail and role.
- **Role:** with `USER:ASSIGN` the role is a dropdown; picking one saves at once with a toast. Only system roles are offered (project-only roles such as Viewer are not). Changing your own role reloads your rights straight away. Without the right, the role is a plain badge.
- **Edit** (pencil, `USER:EDIT`) opens the edit form for the account, including its status.
- **Delete** (trash, `USER:DELETE`, never on your own row) asks for confirmation. It removes the person's project memberships and task assignments and cannot be undone; the dialog suggests setting the account to Inactive to keep the history.
- The server refuses changes that would break a rule (for example demoting someone who is the only owner of a project) and the message is shown in a toast.
- Role changes, account creation, status changes and deletions are recorded in the [audit log](admin-audit-log.md).

## Data
`api/users.js`, `api/roles.js`; edit form in `components/EditUserModal`.
