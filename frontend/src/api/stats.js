const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const OPEN_STATUSES = new Set(['TO_DO', 'IN_PROGRESS', 'IN_REVIEW'])

function startOfDay(value) {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d
}

// Derives the last-7-days completed/created/overdue counts straight from
// real task timestamps — replaces the fully-fake `weeklyReport` mock array.
export function computeWeeklyTaskStats(tasks) {
  const today = startOfDay(new Date())
  const days = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today.getTime() - i * DAY_MS)
    days.push({ date, day: WEEKDAY_LABELS[date.getDay()], completed: 0, created: 0, overdue: 0 })
  }

  for (const t of tasks ?? []) {
    if (t.createdAt) {
      const created = startOfDay(t.createdAt)
      const match = days.find((d) => d.date.getTime() === created.getTime())
      if (match) match.created += 1
    }
    if (t.completedAt) {
      const completed = startOfDay(t.completedAt)
      const match = days.find((d) => d.date.getTime() === completed.getTime())
      if (match) match.completed += 1
    }
  }

  for (const day of days) {
    day.overdue = (tasks ?? []).filter((t) => {
      if (!t.dueDate || !OPEN_STATUSES.has(t.status)) return false
      return startOfDay(t.dueDate).getTime() < day.date.getTime()
    }).length
  }

  return days
}

const STATUS_META = [
  { status: 'TO_DO', label: 'To Do', color: 'var(--text-muted)' },
  { status: 'IN_PROGRESS', label: 'In Progress', color: 'var(--status-info)' },
  { status: 'IN_REVIEW', label: 'Review', color: 'var(--status-warning)' },
  { status: 'COMPLETED', label: 'Completed', color: 'var(--status-success)' },
]

export function computeTaskOverview(tasks) {
  const total = tasks?.length || 0
  return STATUS_META.map(({ status, label, color }) => {
    const count = (tasks ?? []).filter((t) => t.status === status).length
    const percent = total ? Math.round((count / total) * 100) : 0
    return { key: status.toLowerCase(), label, count, percent, color }
  })
}

const KANBAN_COLUMNS = [
  { id: 'todo', title: 'To Do', status: 'TO_DO' },
  { id: 'inprogress', title: 'In Progress', status: 'IN_PROGRESS' },
  { id: 'review', title: 'Review', status: 'IN_REVIEW' },
  { id: 'done', title: 'Done', status: 'COMPLETED' },
]

export function groupTasksByStatus(tasks) {
  return KANBAN_COLUMNS.map((col) => ({
    ...col,
    tasks: (tasks ?? []).filter((t) => t.status === col.status),
  }))
}
