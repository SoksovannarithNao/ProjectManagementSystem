import { apiFetch } from './client'

// Checklist items inside a task (assignment-brief.md B1.6). They count toward
// the task's progress together with its subtasks.
export function getChecklistItems(taskId) {
  return apiFetch(`/checklist-items/task/${taskId}`)
}

export function createChecklistItem(taskId, content) {
  return apiFetch('/checklist-items', { method: 'POST', body: { taskId, content } })
}

export function updateChecklistItem(id, { content, completed }) {
  return apiFetch(`/checklist-items/${id}`, { method: 'PUT', body: { content, completed } })
}

export function deleteChecklistItem(id) {
  return apiFetch(`/checklist-items/${id}`, { method: 'DELETE' })
}
