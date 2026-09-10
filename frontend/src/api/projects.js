import { apiFetch } from './client'

export function getProjects() {
  return apiFetch('/projects')
}

export function createProject(request) {
  return apiFetch('/projects', { method: 'POST', body: request })
}
