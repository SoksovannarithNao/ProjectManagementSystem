import { apiFetch } from './client'

export function getProjects() {
  return apiFetch('/projects')
}
