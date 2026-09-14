import { formatDate } from './format'

// TaskAssigneeResponse/ProjectMemberResponse embed full nested objects; these
// build simple id -> [userId] maps so pages can do cheap lookups per row.
export function buildTaskAssigneeMap(taskAssignees) {
  const map = new Map()
  for (const ta of taskAssignees ?? []) {
    const taskId = ta.task?.id
    const userId = ta.user?.id
    if (taskId == null || userId == null) continue
    const list = map.get(taskId) ?? []
    list.push(userId)
    map.set(taskId, list)
  }
  return map
}

export function buildProjectMemberMap(projectMembers) {
  const map = new Map()
  for (const pm of projectMembers ?? []) {
    const projectId = pm.project?.id
    const userId = pm.user?.id
    if (projectId == null || userId == null) continue
    const list = map.get(projectId) ?? []
    list.push(userId)
    map.set(projectId, list)
  }
  return map
}

// projectId -> the current user's own ACTIVE project_role there (OWNER/
// ADMIN/MEMBER/VIEWER), for deriving what actions to show per project —
// mirrors the backend's ProjectAccessGuard.activeRole. A PENDING invitation
// doesn't count (same as the backend), and a project the user isn't a
// member of at all has no entry.
export function buildMyProjectRoleMap(projectMembers, currentUserId) {
  const map = new Map()
  for (const pm of projectMembers ?? []) {
    const projectId = pm.project?.id
    if (projectId == null || pm.user?.id !== currentUserId || pm.status !== 'ACTIVE') continue
    map.set(projectId, pm.projectRole)
  }
  return map
}

export function countByValue(idLists) {
  const counts = new Map()
  for (const ids of idLists) {
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

export function filterTasksByProject(tasks, projectId) {
  if (!projectId) return tasks ?? []
  return (tasks ?? []).filter((t) => String(t.project?.id) === String(projectId))
}

export function toProjectCard(project, memberIds = []) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    progress: Math.round(Number(project.progress ?? 0)),
    due: formatDate(project.endDate),
    status: project.status,
    members: memberIds,
  }
}
