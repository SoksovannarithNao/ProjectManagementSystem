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
