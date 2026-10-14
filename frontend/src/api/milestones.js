import { apiFetch } from './client'

// The milestones in the projects the caller can see (the calendar draws them). With { from, to }
// (YYYY-MM-DD, both included) only those due in that window.
export function getMilestones({ from, to } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('dueFrom', from)
  if (to) params.set('dueTo', to)
  const query = params.toString()
  return apiFetch(query ? `/milestones?${query}` : '/milestones')
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
