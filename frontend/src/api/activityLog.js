import { apiFetch } from './client'

export function getActivityByTask(taskId) {
  return apiFetch(`/activity-logs/task/${taskId}`)
}

// The project's feed, newest first: project and milestone events, task events,
// comments and uploaded files.
export function getActivityByProject(projectId, limit = 30) {
  return apiFetch(`/activity-logs/project/${projectId}?limit=${limit}`)
}

// The latest events across everything the user may see (dashboard).
export function getRecentActivity(limit = 8) {
  return apiFetch(`/activity-logs/recent?limit=${limit}`)
}
