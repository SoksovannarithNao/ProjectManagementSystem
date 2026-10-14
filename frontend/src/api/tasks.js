import { apiFetch } from './client'
import { blockedReason } from './format'

// The tasks due between two dates, both included (YYYY-MM-DD): what the Calendar shows for the days
// on screen. A task with no due date is never in it.
export function getTasksDueBetween(from, to) {
  return apiFetch(`/tasks?${new URLSearchParams({ dueFrom: from, dueTo: to })}`)
}

// The open tasks that have a due date, the earliest due first (so the overdue ones lead): the
// dashboard's "Due & Overdue" card. A task with no due date is left out by asking for tasks due
// from the earliest date on.
export function getTasksDueSoon(limit) {
  const params = taskFilterParams({ statuses: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] })
  params.set('dueFrom', '1970-01-01')
  params.set('sort', 'dueDate')
  params.set('page', 0)
  params.set('size', limit)
  return apiFetch(`/tasks?${params}`).then((page) => page.items)
}

// The columns of the Kanban board, left to right. A column is a status; To Do and Blocked share TODO and
// split it by whether the task waits on a task it depends on ("blocked" is not a status a task holds).
export const KANBAN_COLUMNS = [
  { id: 'todo', title: 'To Do', status: 'TODO', blocked: false },
  { id: 'inprogress', title: 'In Progress', status: 'IN_PROGRESS' },
  { id: 'review', title: 'In Review', status: 'IN_REVIEW' },
  { id: 'blocked', title: 'Blocked', status: 'TODO', blocked: true },
  { id: 'done', title: 'Completed', status: 'COMPLETED' },
]

// One page of one Kanban column: { items, total, page, size }, in creation order. `total` is every task
// the column holds under the board's search (`search`), priorities (`priorities[]`) and `projectId`,
// not only the page, so the column's count is right while it shows its first cards.
export function getKanbanColumnPage(filters, column, page, size) {
  const params = taskFilterParams({ ...filters, statuses: [column.status] })
  if (column.blocked !== undefined) params.set('blocked', column.blocked)
  params.set('page', page)
  params.set('size', size)
  return apiFetch(`/tasks?${params}`)
}

// The tasks linked to one milestone, wherever they are due.
export function getTasksByMilestoneId(milestoneId) {
  return apiFetch(`/tasks/milestone/${milestoneId}`)
}

// How many tasks each project holds, for the project cards: [{ projectId, total, completed, overdue }]
// (cancelled tasks are not counted; overdue means past due and still open).
export function getProjectTaskStats() {
  return apiFetch('/tasks/project-stats')
}

// The search and filters of the Tasks page as query parameters. All optional:
//   search, statuses[], priorities[], assigneeIds[] (the task must be assigned to all of them),
//   unassigned, projectId, due ('overdue' | 'today' | 'week' | 'none').
function taskFilterParams({ search, statuses = [], priorities = [], assigneeIds = [], unassigned = false, projectId, due } = {}) {
  const params = new URLSearchParams()
  if (search && search.trim()) params.set('search', search.trim())
  statuses.forEach((s) => params.append('status', s))
  priorities.forEach((p) => params.append('priority', p))
  assigneeIds.forEach((id) => params.append('assigneeId', id))
  if (unassigned) params.set('unassigned', 'true')
  if (projectId) params.set('projectId', projectId)
  if (due) params.set('due', due)
  return params
}

// One page of the Tasks page's list: { items, total, page, size }. The server applies the filters,
// then the quick `view` (all, today, upcoming, inprogress, completed, overdue), and keeps the
// tasks of a project together (finished projects last) with `sort` ordering each project.
export function getTasksPage(filters, page, size) {
  const params = taskFilterParams(filters)
  if (filters?.view && filters.view !== 'all') params.set('view', filters.view)
  if (filters?.sort) params.set('sort', filters.sort)
  params.set('groupBy', 'project')
  params.set('page', page)
  params.set('size', size)
  return apiFetch(`/tasks?${params}`)
}

// What sits beside the list over the same search and filters: { viewCounts, assignees } - how many
// tasks each quick view holds, and everyone who holds an assignment on a task the caller can see.
export function getTaskSummary(filters) {
  return apiFetch(`/tasks/summary?${taskFilterParams(filters)}`)
}

export function getTasksByProjectId(projectId) {
  return apiFetch(`/tasks/project/${projectId}`)
}

export function getTaskById(id) {
  return apiFetch(`/tasks/${id}`)
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

// The statuses a Kanban card can be moved to (CANCELLED has no column). "Blocked" is not
// one of them: a task sits there while it waits for a task it depends on.
export const KANBAN_MOVE_TARGETS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED']
export const KANBAN_STATUS_LABELS = { TODO: 'To Do', IN_PROGRESS: 'In Progress', IN_REVIEW: 'In Review', COMPLETED: 'Completed' }

// Where a task may go from each status in one move. A task starts in In Progress: it never jumps
// from To Do straight to review or completed (the quick-advance circle works the same way). From
// there it goes on to review, or to Completed for an approver, and any finished or reviewed task
// can be taken back a stage or more on purpose.
const FORWARD_FROM = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['IN_REVIEW', 'COMPLETED'],
  IN_REVIEW: ['COMPLETED'],
  COMPLETED: [],
}
const STAGE = { TODO: 0, IN_PROGRESS: 1, IN_REVIEW: 2, COMPLETED: 3 }

// Whether a task may be moved to `target` (a status, or 'BLOCKED' for the Blocked column),
// from a drag or the "Move to" menu. Mirrors the rules the server applies when the status
// changes, so a doomed request is not sent: it answers { ok: true }, or { ok: false, message }
// (an empty message means "nothing to do": the task is already there). Advisory - the server
// still decides.
//   canChange   an editor, or an assignee (TASK_STATUS:EDIT)
//   canApprove  may complete this task (TASK:APPROVE and the approval rules)
export function checkTaskMove(task, target, { canChange, canApprove }) {
  if (target !== 'BLOCKED' && task.status === target) return { ok: false, message: '' }
  if (target === 'BLOCKED') {
    return { ok: false, message: 'Blocked is not a status: a task shows there while it waits for a task it depends on' }
  }
  if (!canChange) return { ok: false, message: 'You cannot change the status of this task' }
  if (task.blocked && target !== 'TODO') return { ok: false, message: blockedReason(task) }
  const forward = STAGE[target] > STAGE[task.status]
  if (forward && !FORWARD_FROM[task.status]?.includes(target)) {
    return { ok: false, message: 'A task starts in In Progress: move it there first, then on to review or completed' }
  }
  if (target === 'COMPLETED') {
    if (!canApprove) {
      return { ok: false, message: 'Only an approver can complete a task. Move it to In Review so it can be approved' }
    }
    if (task.totalSubtasks > 0 && task.completedSubtasks < task.totalSubtasks) {
      return { ok: false, message: 'Complete all subtasks before marking this task as completed' }
    }
  }
  return { ok: true }
}

// One Kanban move, done safely. The board's copy of a task can be out of date (someone else may
// have edited it, moved it or finished a prerequisite), and a status change resends the whole
// task, so this reads the task again first, checks the rules against what it finds, and only then
// saves. `abilitiesFor(task)` gives { canChange, canApprove } for the fresh task. Resolves to
// { moved: true, task } or { moved: false, stale, message }: stale means someone changed the
// task's status since the board loaded, so the move is not applied and the board should refresh.
export async function moveTaskToStatus(task, target, abilitiesFor) {
  const fresh = await getTaskById(task.id)
  if (fresh.status !== task.status) {
    return { moved: false, stale: true, message: 'This task was changed by someone else. The board has been refreshed' }
  }
  const check = checkTaskMove(fresh, target, abilitiesFor(fresh))
  if (!check.ok) return { moved: false, stale: false, message: check.message }
  return { moved: true, task: await setTaskStatus(fresh, target) }
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
