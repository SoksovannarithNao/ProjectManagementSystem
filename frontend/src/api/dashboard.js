import { apiFetch } from './client'

// Project and task statistics for the dashboard, calculated on the server
// from what the signed-in user may see (assignment-brief.md B1.3, D-06):
// { projects: { total, planning, active, onHold, completed, cancelled, delayed, averageProgress },
//   tasks: { total, todo, inProgress, inReview, completed, cancelled, overdue },
//   delayedProjects: [{ id, projectCode, name, endDate, daysDelayed, progress, status }] }
export function getDashboardStats() {
  return apiFetch('/dashboard/stats')
}

// The activity chart: one row per day over the last `days` days, oldest first,
// [{ date: 'YYYY-MM-DD', created, completed, overdue }] - how many tasks were created and completed
// that day and how many tasks open now were due before it. The days are the caller's (their time
// zone is sent), and `projectId` limits it to one project.
export function getTaskActivity(days, { projectId } = {}) {
  const params = new URLSearchParams({ days, zone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  if (projectId) params.set('projectId', projectId)
  return apiFetch(`/dashboard/task-activity?${params}`)
}
