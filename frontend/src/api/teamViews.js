import { apiFetch } from './client'

// Manager views of a team. Only people who may assign tasks in the project
// (the Owner, a Team Leader, an Administrator) get an answer; others get 403.

// Every active member with the tasks assigned to them, plus the unassigned tasks.
export function getTeamTasks(projectId) {
  return apiFetch(`/projects/${projectId}/team-tasks`)
}

// Per-member workload of one project's team, judged against that team's average.
export function getProjectWorkload(projectId) {
  return apiFetch(`/projects/${projectId}/workload`)
}

// The same across every project the user manages (the dashboard card).
export function getManagedWorkload() {
  return apiFetch('/workload')
}
