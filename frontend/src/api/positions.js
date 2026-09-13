import { apiFetch } from './client'

export function getPositions() {
  return apiFetch('/positions')
}

export function createPosition(request) {
  return apiFetch('/positions', { method: 'POST', body: request })
}
