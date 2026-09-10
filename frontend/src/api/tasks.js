import { apiFetch } from './client'

export function getTasks() {
  return apiFetch('/tasks')
}

export function createTask(request) {
  return apiFetch('/tasks', { method: 'POST', body: request })
}

export function updateTask(id, request) {
  return apiFetch(`/tasks/${id}`, { method: 'PUT', body: request })
}

export function deleteTask(id) {
  return apiFetch(`/tasks/${id}`, { method: 'DELETE' })
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

// One click = one step forward in the workflow: To Do -> Doing -> Done,
// never jumping straight from To Do to Done. Clicking an already-finished
// task reopens it (back to To Do), same as unchecking a checkbox.
function nextWorkflowStatus(status) {
  if (status === 'TO_DO') return 'IN_PROGRESS'
  if (status === 'IN_PROGRESS' || status === 'IN_REVIEW') return 'COMPLETED'
  return 'TO_DO'
}

export function advanceTaskStatus(task) {
  const next = nextWorkflowStatus(task.status)
  return updateTask(
    task.id,
    taskResponseToRequest(task, {
      status: next,
      completedAt: next === 'COMPLETED' ? new Date().toISOString() : next === 'TO_DO' ? null : task.completedAt,
      progress: next === 'COMPLETED' ? 100 : task.progress,
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
