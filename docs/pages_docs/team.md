# Team

**Route** `/team` · **Access** any signed-in user; the actions depend on rights · **Source** [Team.jsx](../../frontend/src/pages/Team.jsx)

## What it does
A directory of the people in the workspace, with each person's projects and workload, and the place to bring people into projects.

## How it works
- **Left:** a search box (name, @username or role) over the member list, which scrolls inside its card.
- **Right:** the selected person's name, e-mail, number of assigned tasks and projects, **Team Information** (position and department) and their projects with progress.
- **Add User** (top bar) creates an account directly. Shown only with `USER:CREATE` (Administrator by default).
- **Add Member** (top bar) puts an existing user into a project. Shown to anyone who manages at least one project, and lists only those projects. The person gets an invitation to accept or decline.
- **Invite to team** (under a person's projects) sends the same invitation for the chosen project and project role (Team Member, Team Leader or Viewer). Hidden for yourself, and replaced by a note for accounts that are not active.
- **Remove (x)** next to a project takes the person out of it; shown only for projects the caller manages.
- **Position and department** are editable only by an Administrator or someone who manages a project the selected person is in (never for yourself). New list entries can be added from there with `LOOKUP:CREATE`. Everyone else sees them read-only ("Not set" when empty).

## Data
`api/projects.js`, `api/projectMembers.js` (invite, remove), `api/taskAssignees.js`, `api/positions.js`, `api/departments.js`, `api/users.js`, and the shared members context.
