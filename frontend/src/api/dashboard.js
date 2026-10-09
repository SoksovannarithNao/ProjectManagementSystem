import { apiFetch } from './client'

// Project and task statistics for the dashboard, calculated on the server
// from what the signed-in user may see (assignment-brief.md B1.3, D-06):
// { projects: { total, planning, active, onHold, completed, cancelled, delayed, averageProgress },
//   tasks: { total, todo, inProgress, inReview, completed, cancelled, overdue },
//   delayedProjects: [{ id, projectCode, name, endDate, daysDelayed, progress, status }] }
export function getDashboardStats() {
  return apiFetch('/dashboard/stats')
}
