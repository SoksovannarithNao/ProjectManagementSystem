import { apiFetch } from './client'

export function getProjectMembers() {
  return apiFetch('/project-members')
}
