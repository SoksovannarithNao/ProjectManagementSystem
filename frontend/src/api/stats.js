const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// "Mon" for a week, "10/12" for anything longer, so the points do not collide.
function periodDayLabel(date, days) {
  return days <= 7 ? WEEKDAY_LABELS[date.getDay()] : `${date.getMonth() + 1}/${date.getDate()}`
}

// The chart's points from the server's daily rows (GET /api/dashboard/task-activity):
// [{ date: Date, day: label, completed, created, overdue }], oldest first.
export function activityToPeriodPoints(rows, days = 7) {
  return (rows ?? []).map((r) => {
    const date = new Date(`${r.date}T00:00:00`) // a calendar date, read in local time
    return { date, day: periodDayLabel(date, days), completed: r.completed, created: r.created, overdue: r.overdue }
  })
}

export const PERIOD_OPTIONS = [
  { id: 'week', label: 'This Week', days: 7 },
  { id: 'month', label: 'This Month', days: 30 },
  { id: 'quarter', label: 'This Quarter', days: 90 },
]

const STATUS_META = [
  { status: 'TODO', label: 'To Do', color: 'var(--text-muted)' },
  { status: 'IN_PROGRESS', label: 'In Progress', color: 'var(--status-info)' },
  { status: 'IN_REVIEW', label: 'In Review', color: 'var(--status-warning)' },
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

// The same rows as computeTaskOverview, but from the counts the server
// calculated (GET /api/dashboard/stats), so the dashboard and every other
// client show the same numbers. `taskStats` = { total, todo, inProgress, inReview, completed, cancelled, overdue }.
const OVERVIEW_FIELDS = { TODO: 'todo', IN_PROGRESS: 'inProgress', IN_REVIEW: 'inReview', COMPLETED: 'completed' }

export function taskOverviewFromStats(taskStats) {
  const total = taskStats?.total || 0
  return STATUS_META.map(({ status, label, color }) => {
    const count = taskStats?.[OVERVIEW_FIELDS[status]] ?? 0
    const percent = total ? Math.round((count / total) * 100) : 0
    return { key: status.toLowerCase(), label, count, percent, color }
  })
}
