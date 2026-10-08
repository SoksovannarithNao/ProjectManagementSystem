// What the signed-in user may do. The server decides (GET /api/users/me/permissions
// reads the role_permissions table); this file only reads that answer so the UI
// can HIDE what the user cannot use. It is advisory: every request is checked
// again on the server, so a stale or tampered copy here can never grant access.
//
// A grant is the string "RESOURCE:ACTION", e.g. "TASK:CREATE". There are 7
// actions (VIEW, CREATE, EDIT, DELETE, ASSIGN, APPROVE, GENERATE_REPORTS) and the
// resources are PROJECT, MILESTONE, MEMBER, TASK, TASK_STATUS, SUBTASK, COMMENT,
// WORK_LOG, REPORT, USER, ROLE and LOOKUP (see docs/adr/0014-...).
//
// Shape of `permissions` (the API response):
//   { role, administrator, system: ['PROJECT:CREATE', ...],
//     projects: [{ projectId, projectRole, roleName, grants: ['TASK:CREATE', ...] }] }

export const EMPTY_PERMISSIONS = { role: null, administrator: false, system: [], projects: [] }

function projectGrants(permissions, projectId) {
  if (projectId == null) return []
  return permissions.projects.find((p) => p.projectId === Number(projectId))?.grants ?? []
}

// Inside one project: the user's grants in that project, plus any system-wide grant.
export function canInProject(permissions, resource, action, projectId) {
  if (!permissions) return false
  if (permissions.administrator) return true
  const key = `${resource}:${action}`
  return permissions.system.includes(key) || projectGrants(permissions, projectId).includes(key)
}

// Not about one project (create a project, reports, users, roles).
export function canSystem(permissions, resource, action) {
  if (!permissions) return false
  if (permissions.administrator) return true
  return permissions.system.includes(`${resource}:${action}`)
}

// "In at least one project the user belongs to": used to decide whether a
// control that needs a project to be chosen first (New Task) is worth showing.
export function canAnywhere(permissions, resource, action) {
  if (!permissions) return false
  if (permissions.administrator) return true
  const key = `${resource}:${action}`
  return permissions.system.includes(key) || permissions.projects.some((p) => p.grants.includes(key))
}

// Projects (from a list of project ids) where the user holds the grant.
export function projectIdsWhere(permissions, resource, action, projectIds) {
  return projectIds.filter((id) => canInProject(permissions, resource, action, id))
}
