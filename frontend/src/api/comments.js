import { apiFetch } from './client'

export function getCommentsByTask(taskId) {
  return apiFetch(`/comments/task/${taskId}`)
}

export function createComment(request) {
  return apiFetch('/comments', { method: 'POST', body: request })
}

export function updateComment(id, request) {
  return apiFetch(`/comments/${id}`, { method: 'PUT', body: request })
}

export function deleteComment(id) {
  return apiFetch(`/comments/${id}`, { method: 'DELETE' })
}
