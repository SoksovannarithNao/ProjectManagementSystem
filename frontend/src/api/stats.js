const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const OPEN_STATUSES = new Set(['TO_DO', 'IN_PROGRESS', 'IN_REVIEW'])

function startOfDay(value) {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d
}

// Derives completed/created/overdue counts per day, over the last N days,
// straight from real task timestamps — replaces the fully-fake `weeklyReport`
// mock array. Weekday names only stay legible for a 7-day window; anything
// longer switches to M/D labels so points don't collide.
export function computePeriodTaskStats(tasks, days = 7) {
  const today = startOfDay(new Date())
  const useWeekdayLabel = days <= 7
  const points = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * DAY_MS)
    const label = useWeekdayLabel ? WEEKDAY_LABELS[date.getDay()] : `${date.getMonth() + 1}/${date.getDate()}`
    points.push({ date, day: label, completed: 0, created: 0, overdue: 0 })
  }

  for (const t of tasks ?? []) {
    if (t.createdAt) {
      const created = startOfDay(t.createdAt)
      const match = points.find((p) => p.date.getTime() === created.getTime())
      if (match) match.created += 1
    }
    if (t.completedAt) {
      const completed = startOfDay(t.completedAt)
      const match = points.find((p) => p.date.getTime() === completed.getTime())
      if (match) match.completed += 1
    }
  }

  for (const point of points) {
    point.overdue = (tasks ?? []).filter((t) => {
      if (!t.dueDate || !OPEN_STATUSES.has(t.status)) return false
      return startOfDay(t.dueDate).getTime() < point.date.getTime()
    }).length
  }

  return points
}

export function computeWeeklyTaskStats(tasks) {
  return computePeriodTaskStats(tasks, 7)
}

export const PERIOD_OPTIONS = [
  { id: 'week', label: 'This Week', days: 7 },
  { id: 'month', label: 'This Month', days: 30 },
  { id: 'quarter', label: 'This Quarter', days: 90 },
]

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
