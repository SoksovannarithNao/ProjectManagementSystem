import { apiFetch } from './client'

export function getUsers() {
  return apiFetch('/users')
}

export function getUserByUsername(username) {
  return apiFetch(`/users/username/${encodeURIComponent(username)}`)
}

export function createUser(request) {
  return apiFetch('/users', { method: 'POST', body: request })
}

export function updateOwnProfile(request) {
  return apiFetch('/users/me', { method: 'PUT', body: request })
}

export function changeOwnPassword(request) {
  return apiFetch('/users/me/password', { method: 'PUT', body: request })
}

export function updateOwnPreferences(request) {
  return apiFetch('/users/me/preferences', { method: 'PUT', body: request })
}

// Team-Admin-only — see UserController.updateMemberPositionDepartment. Not
// callable on your own account through this UI; the backend also refuses it
// unless the caller actually administers a team the target belongs to.
export function updateMemberPositionDepartment(userId, request) {
  return apiFetch(`/users/${userId}/position-department`, { method: 'PUT', body: request })
}
