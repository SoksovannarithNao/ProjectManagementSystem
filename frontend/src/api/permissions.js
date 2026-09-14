// Mirrors the backend's project-scoped authorization (see
// ProjectAccessGuard) — kept here so the UI can hide actions a caller can't
// actually perform instead of letting them hit a 403 after filling out a
// form. Project/task permissions come from the CALLER'S ROLE IN THAT
// SPECIFIC PROJECT (project_members.project_role: OWNER/ADMIN/MEMBER/
// VIEWER), not from any global role on the account — the same user can be
// OWNER of one project and VIEWER of another. `isSystemAdmin` is the one
// exception: a system-level ADMINISTRATOR (unrelated to any one project)
// always has full access everywhere, same as the backend's bypass.
const MANAGE_ROLES = new Set(['OWNER', 'ADMIN'])
const CONTENT_ROLES = new Set(['OWNER', 'ADMIN', 'MEMBER'])
const USER_MANAGE_ROLES = new Set(['ADMINISTRATOR'])

// Create/edit tasks, milestones, and other content within a project.
// Excludes VIEWER (read-only).
export function canEditProjectContent(projectRole, isSystemAdmin) {
  return isSystemAdmin || CONTENT_ROLES.has(projectRole)
}

// Manage a project itself (edit details, milestones, members, task
// assignment/dependencies/deletion) — OWNER or ADMIN of that project.
export function canManageProject(projectRole, isSystemAdmin) {
  return isSystemAdmin || MANAGE_ROLES.has(projectRole)
}

// Delete/transfer ownership of a project, or promote a member to OWNER —
// OWNER only (ADMIN can manage content/members but not this).
export function isProjectOwner(projectRole, isSystemAdmin) {
  return isSystemAdmin || projectRole === 'OWNER'
}

// System-level account management (creating other user accounts, granting
// ADMINISTRATOR) — a global role, genuinely unrelated to any one project.
export function canManageUsers(role) {
  return USER_MANAGE_ROLES.has(role)
}
