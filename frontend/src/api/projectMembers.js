import { apiFetch } from './client'

export function getProjectMembers() {
  return apiFetch('/project-members')
}

export function getMembersByProjectId(projectId) {
  return apiFetch(`/project-members/project/${projectId}`)
}

export function createProjectMember(request) {
  return apiFetch('/project-members', { method: 'POST', body: request })
}

export function deleteProjectMember(id) {
  return apiFetch(`/project-members/${id}`, { method: 'DELETE' })
}

// Team invitation workflow — see ProjectMemberController/Service on the
// backend. A project IS a "team" in this app's data model.
export function inviteMember(request) {
  return apiFetch('/project-members/invite', { method: 'POST', body: request })
}

export function getPendingInvitations(projectId) {
  return apiFetch(`/project-members/project/${projectId}/invitations`)
}

export function acceptInvitation(projectId) {
  return apiFetch(`/project-members/project/${projectId}/accept`, { method: 'POST' })
}

export function declineInvitation(projectId) {
  return apiFetch(`/project-members/project/${projectId}/decline`, { method: 'POST' })
}
