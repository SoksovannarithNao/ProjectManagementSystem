import { apiFetch } from './client'

export function getRoles() {
  return apiFetch('/roles')
}

// The 7 permission types, the resources, and every role with its grants.
export function getPermissionMatrix() {
  return apiFetch('/permissions/matrix')
}

// Replaces ALL of a role's grants. grants: [{ scope, resource, permission }]
export function updateRolePermissions(roleId, grants) {
  return apiFetch(`/roles/${roleId}/permissions`, { method: 'PUT', body: { grants } })
}
