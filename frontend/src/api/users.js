import { apiFetch, apiUpload } from './client'

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

export function uploadProfilePhoto(file) {
  const formData = new FormData()
  formData.append('file', file)
  return apiUpload('/users/me/photo', formData)
}

export function deleteProfilePhoto() {
  return apiFetch('/users/me/photo', { method: 'DELETE' })
}

export function changeOwnPassword(request) {
  return apiFetch('/users/me/password', { method: 'PUT', body: request })
}

// { enabled, linked, email }: whether "Sign in with Google" exists here and whether this account has a
// Google account connected.
export function getGoogleStatus() {
  return apiFetch('/users/me/google')
}

// Connects the Google account behind the ID token to this account; needs the current password.
export function linkGoogle(credential, currentPassword) {
  return apiFetch('/users/me/google', { method: 'POST', body: { credential, currentPassword } })
}

// The first password of an account that Google created (it has none): the new password, confirmed with a fresh
// Google ID token for the connected Google account instead of a current password.
export function setPasswordWithGoogle(credential, newPassword, confirmNewPassword) {
  return apiFetch('/users/me/google/password', { method: 'POST', body: { credential, newPassword, confirmNewPassword } })
}

export function unlinkGoogle() {
  return apiFetch('/users/me/google', { method: 'DELETE' })
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

// What the signed-in user may do, system-wide and per project. Read by
// AuthContext; see api/permissions.js.
export function getMyPermissions() {
  return apiFetch('/users/me/permissions')
}

// Administrator-only: gives an account its system role.
export function assignUserRole(userId, roleId) {
  return apiFetch(`/users/${userId}/role`, { method: 'PUT', body: { roleId } })
}

export function updateUserAccount(userId, request) {
  return apiFetch(`/users/${userId}`, { method: 'PUT', body: request })
}

// Administrator-only; the server refuses the last Administrator, your own
// account and the sole owner of a project.
export function deleteUser(userId) {
  return apiFetch(`/users/${userId}`, { method: 'DELETE' })
}
