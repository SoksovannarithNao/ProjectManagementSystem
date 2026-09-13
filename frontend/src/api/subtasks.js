import { apiFetch } from './client'

export function getSubtasksByTask(taskId) {
  return apiFetch(`/subtasks/task/${taskId}`)
}

export function createSubtask(request) {
  return apiFetch('/subtasks', { method: 'POST', body: request })
}

export function updateSubtask(id, request) {
  return apiFetch(`/subtasks/${id}`, { method: 'PUT', body: request })
}

export function deleteSubtask(id) {
  return apiFetch(`/subtasks/${id}`, { method: 'DELETE' })
}
