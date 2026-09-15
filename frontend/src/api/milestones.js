import { apiFetch } from './client'

export function getMilestonesByProjectId(projectId) {
  return apiFetch(`/milestones/project/${projectId}`)
}

export function createMilestone(request) {
  return apiFetch('/milestones', { method: 'POST', body: request })
}

export function deleteMilestone(id) {
  return apiFetch(`/milestones/${id}`, { method: 'DELETE' })
}
