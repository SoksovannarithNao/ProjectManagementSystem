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
