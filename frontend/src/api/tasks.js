import { apiFetch } from './client'

export function getTasks() {
  return apiFetch('/tasks')
}

export function getTasksByProjectId(projectId) {
  return apiFetch(`/tasks/project/${projectId}`)
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
      status: completed ? 'COMPLETED' : 'TODO',
      completedAt: completed ? new Date().toISOString() : null,
      progress: completed ? 100 : task.progress,
    })
  )
}

// One click = one step forward in the workflow: To Do -> Doing -> (Review) -> Done,
// never jumping straight from To Do to Done. COMPLETED/CANCELLED are
// terminal for this quick-advance control — a finished task should not be
// silently reopened by an accidental click. Reopening is still possible,
// just not by this control: use the explicit status dropdown in
// TaskDetailPanel, a deliberate action rather than a stray click.
//
// Completing a task is an approval (TASK:APPROVE). Someone who may approve takes
// Doing -> Done; everyone else takes Doing -> In Review ("submit for review")
// and then waits for an approver, so their control stops there.
function nextWorkflowStatus(status, canApprove) {
  if (status === 'TODO') return 'IN_PROGRESS'
  if (status === 'IN_PROGRESS') return canApprove ? 'COMPLETED' : 'IN_REVIEW'
  if (status === 'IN_REVIEW') return canApprove ? 'COMPLETED' : status
  return status
}

// Whether advanceTaskStatus would actually change this task's status —
// false for COMPLETED/CANCELLED, and for In Review when the user cannot approve.
export function canAdvanceStatus(status, canApprove = true) {
  return nextWorkflowStatus(status, canApprove) !== status
}

export function advanceTaskStatus(task, canApprove = true) {
  const next = nextWorkflowStatus(task.status, canApprove)
  return updateTask(
    task.id,
    taskResponseToRequest(task, {
      status: next,
      completedAt: next === 'COMPLETED' ? new Date().toISOString() : next === 'TODO' ? null : task.completedAt,
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
