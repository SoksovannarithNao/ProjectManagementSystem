import { apiFetch } from './client'

export function getTaskAssignees() {
  return apiFetch('/task-assignees')
}

export function createTaskAssignee(request) {
  return apiFetch('/task-assignees', { method: 'POST', body: request })
}

export function deleteTaskAssignee(id) {
  return apiFetch(`/task-assignees/${id}`, { method: 'DELETE' })
}
