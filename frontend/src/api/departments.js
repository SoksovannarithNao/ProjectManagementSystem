import { apiFetch } from './client'

export function getDepartments() {
  return apiFetch('/departments')
}

export function createDepartment(request) {
  return apiFetch('/departments', { method: 'POST', body: request })
}
