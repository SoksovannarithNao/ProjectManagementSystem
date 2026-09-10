// Mirrors the @PreAuthorize role gates in the backend controllers — kept
// here so the UI can hide actions a role can't actually perform instead of
// letting the user hit a 403 after filling out a form.
const TASK_CREATE_ROLES = new Set(['ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER'])
const PROJECT_CREATE_ROLES = new Set(['ADMINISTRATOR', 'PROJECT_MANAGER'])
const USER_MANAGE_ROLES = new Set(['ADMINISTRATOR'])

export function canCreateTask(role) {
  return TASK_CREATE_ROLES.has(role)
}

// Same role set as create — DELETE /api/tasks/{id} and PUT (via the edit
// form) are gated identically to POST on the backend.
export function canManageTask(role) {
  return TASK_CREATE_ROLES.has(role)
}

export function canCreateProject(role) {
  return PROJECT_CREATE_ROLES.has(role)
}

export function canManageUsers(role) {
  return USER_MANAGE_ROLES.has(role)
}
