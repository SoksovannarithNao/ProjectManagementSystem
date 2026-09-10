import { apiFetch } from './client'

export function getUsers() {
  return apiFetch('/users')
}

export function getUserByUsername(username) {
  return apiFetch(`/users/username/${encodeURIComponent(username)}`)
}
