import { apiFetch } from './client'

// Every milestone in the projects the caller can see (the calendar draws them).
export function getMilestones() {
  return apiFetch('/milestones')
}

export function getMilestonesByProjectId(projectId) {
  return apiFetch(`/milestones/project/${projectId}`)
}

export function createMilestone(request) {
  return apiFetch('/milestones', { method: 'POST', body: request })
}

// Full replace like every PUT: title, description, due date and status are sent
// together. Progress is left out on purpose - it is derived from the linked tasks.
export function updateMilestone(id, request) {
  return apiFetch(`/milestones/${id}`, { method: 'PUT', body: request })
}

export function deleteMilestone(id) {
  return apiFetch(`/milestones/${id}`, { method: 'DELETE' })
}
