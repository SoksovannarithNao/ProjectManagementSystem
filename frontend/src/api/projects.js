import { apiFetch } from './client'

export function getProjects() {
  return apiFetch('/projects')
}

export function getProjectById(id) {
  return apiFetch(`/projects/${id}`)
}

export function createProject(request) {
  return apiFetch('/projects', { method: 'POST', body: request })
}

export function updateProject(id, request) {
  return apiFetch(`/projects/${id}`, { method: 'PUT', body: request })
}

export function deleteProject(id) {
  return apiFetch(`/projects/${id}`, { method: 'DELETE' })
}

// PUT /api/projects/{id} is a full replace (ProjectService.applyRequest only
// keeps a field's current value when its request field is omitted/null, so
// omitting one here works too — this mirrors tasks.js's
// taskResponseToRequest so a status-only or content-only change doesn't have
// to hand-list every other field).
export function projectResponseToRequest(project, overrides = {}) {
  return {
    projectCode: project.projectCode,
    name: project.name,
    description: project.description,
    startDate: project.startDate,
    endDate: project.endDate,
    priority: project.priority,
    status: project.status,
    ...overrides,
  }
}
