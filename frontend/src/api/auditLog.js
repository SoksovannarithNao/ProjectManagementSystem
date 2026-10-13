import { apiFetch } from './client'

// Administrator only. params: { action, targetType, q, from, to, page, size }; empty values are left out.
export function getAuditLogs(params = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return apiFetch(`/audit-logs${text ? `?${text}` : ''}`)
}

// The ownership transfers of one project: for its Owner or an Administrator.
export function getProjectAuditLogs(projectId) {
  return apiFetch(`/audit-logs/project/${projectId}`)
}
