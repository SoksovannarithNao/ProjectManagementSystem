import { apiFetch } from './client'

export function getTaskAssignees() {
  return apiFetch('/task-assignees')
}
