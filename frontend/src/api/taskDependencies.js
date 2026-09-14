import { apiFetch } from './client'

export function getAllTaskDependencies() {
  return apiFetch('/task-dependencies')
}

export function getDependenciesByTask(taskId) {
  return apiFetch(`/task-dependencies/task/${taskId}`)
}

export function createTaskDependency(taskId, dependsOnTaskId) {
  return apiFetch('/task-dependencies', { method: 'POST', body: { taskId, dependsOnTaskId } })
}

export function deleteTaskDependency(taskId, dependsOnTaskId) {
  return apiFetch(`/task-dependencies?taskId=${taskId}&dependsOnTaskId=${dependsOnTaskId}`, { method: 'DELETE' })
}
