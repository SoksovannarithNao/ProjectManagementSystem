import { apiFetch } from './client'

export function getActivityByTask(taskId) {
  return apiFetch(`/activity-logs/task/${taskId}`)
}
