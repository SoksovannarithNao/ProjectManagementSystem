import { apiFetch } from './client'

export function getWorkLogsByTask(taskId) {
  return apiFetch(`/work-logs/task/${taskId}`)
}

export function createWorkLog(request) {
  return apiFetch('/work-logs', { method: 'POST', body: request })
}

export function deleteWorkLog(id) {
  return apiFetch(`/work-logs/${id}`, { method: 'DELETE' })
}
