import { apiFetch } from './client'

export function getTasks() {
  return apiFetch('/tasks')
}

export function updateTask(id, request) {
  return apiFetch(`/tasks/${id}`, { method: 'PUT', body: request })
}

// PUT /api/tasks/{id} is a full replace (see TaskService.applyRequest on the
// backend), so any status-only change has to resend the whole task.
export function taskResponseToRequest(task, overrides = {}) {
  return {
    projectId: task.project?.id,
    milestoneId: task.milestone?.id ?? null,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimatedHours: task.estimatedHours,
    progress: task.progress,
    completedAt: task.completedAt,
    createdById: task.createdBy?.id ?? null,
    ...overrides,
  }
}

export function toggleTaskCompletion(task) {
  const completed = task.status !== 'COMPLETED'
  return updateTask(
    task.id,
    taskResponseToRequest(task, {
      status: completed ? 'COMPLETED' : 'TO_DO',
      completedAt: completed ? new Date().toISOString() : null,
      progress: completed ? 100 : task.progress,
    })
  )
}

export function setTaskStatus(task, status) {
  return updateTask(
    task.id,
    taskResponseToRequest(task, {
      status,
      completedAt: status === 'COMPLETED' ? new Date().toISOString() : task.completedAt,
    })
  )
}
