import { apiFetch } from './client'

export function getProjectMembers() {
  return apiFetch('/project-members')
}

export function createProjectMember(request) {
  return apiFetch('/project-members', { method: 'POST', body: request })
}

export function deleteProjectMember(id) {
  return apiFetch(`/project-members/${id}`, { method: 'DELETE' })
}
