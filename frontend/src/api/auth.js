import { apiFetch } from './client'

export function login(username, password) {
  return apiFetch('/auth/login', { method: 'POST', body: { username, password }, skipAuth: true })
}
