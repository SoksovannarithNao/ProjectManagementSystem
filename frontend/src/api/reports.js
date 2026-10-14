import { apiFetch } from './client'

// The five KPIs and the seven named reports (assignment-brief.md B8). The server
// calculates everything and checks REPORT:GENERATE_REPORTS (and which projects it
// covers) on every call; people without it get 403. Empty parameters are left out.
function query(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const getKpis = (params) => apiFetch(`/reports/kpis${query(params)}`)
export const getProjectReport = (params) => apiFetch(`/reports/project${query(params)}`)
export const getTaskReport = (params) => apiFetch(`/reports/tasks${query(params)}`)
export const getProjectStatusReport = (params) => apiFetch(`/reports/project-status${query(params)}`)
export const getTaskCompletionReport = (params) => apiFetch(`/reports/task-completion${query(params)}`)
export const getOverdueReport = (params) => apiFetch(`/reports/overdue${query(params)}`)
export const getTeamPerformanceReport = (params) => apiFetch(`/reports/team-performance${query(params)}`)
export const getWorkloadReport = (params) => apiFetch(`/reports/workload${query(params)}`)
