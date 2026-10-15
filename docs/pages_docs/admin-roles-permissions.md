# Roles & Permissions (administration)

**Route** `/admin/roles` · **Access** `ROLE:VIEW` (Administrator by default); changing needs `ROLE:EDIT` · **Source** [RolesPermissions.jsx](../../frontend/src/pages/admin/RolesPermissions.jsx)

## What it does
Shows each role and which of the seven permissions (View, Create, Edit, Delete, Assign, Approve, Generate reports) it holds on which resource, and lets an authorised person change them.

## How it works
- **Left:** the list of roles, labelled System role, Extra system role or Project role. A lock marks a locked role and a dot marks unsaved changes.
- **Right:** a header (name, description, the business name for project roles such as Owner = Project Manager of the project) and one or two grids, depending on the role's scope: **Anywhere in the system** and **Inside a project**.
- Each grid has a row per resource (project, milestone, member, task, task status, subtask, comment, work log, attachment, checklist item, report, user, role, lookup) and a column per permission. Cells that mean nothing for a resource show a dot and cannot be ticked. Hints explain the unusual rows.
- **Editing:** tick or untick cells, then **Save changes** (or **Discard**). Drafts are kept per role, so switching roles never loses work. The server applies a saved change to the very next request and the signed-in person's own rights are reloaded.
- **Locked:** the Administrator role always holds everything and cannot be edited. Without `ROLE:EDIT` the page is view-only.
- **Extra roles** (not built in): **New role**, rename (pencil) and delete (trash, with confirmation; a role that accounts still hold cannot be deleted). The built-in roles cannot be renamed or deleted. An extra role cannot hold "create project", because the creator becomes the owner and only a Project Manager or Administrator can own a project.
- Permission changes and role creation, renaming and deletion appear in the [audit log](admin-audit-log.md).

## Data
`getPermissionMatrix`, `updateRolePermissions`, `deleteRole` in `api/roles.js`; `components/RoleFormPanel`.
