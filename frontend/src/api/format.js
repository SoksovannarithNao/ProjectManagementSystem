// The seed dataset names tasks "<work item> — <project name>" (see
// database/init/02-seed.sql), which is redundant wherever the task is
// already shown grouped/labeled under that same project (Tasks page project
// groups, Kanban cards). Display-only — never used for editing, so a task's
// actual stored title is untouched.
export function taskDisplayTitle(title, projectName) {
  if (!title || !projectName) return title ?? ''
  const suffix = ` — ${projectName}`
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title
}

// Human-readable reason for a Blocked badge/toast — names what still needs
// finishing (task.blockingTaskTitles, from TaskResponse) rather than just
// flagging that something does. Falls back to a generic phrase if the task
// is blocked but its dependency titles weren't sent (shouldn't happen from
// the real API, but keeps this safe against a stale/partial task object).
export function blockedReason(task) {
  const titles = task?.blockingTaskTitles ?? []
  if (titles.length === 0) return 'Blocked by an incomplete dependency'
  return `Blocked by: ${titles.join(', ')}`
}

export function humanizeEnum(value) {
  if (!value) return ''
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Backend has no per-user color/initials — derive them client-side so
// avatars stay visually consistent without hand-picked mock values.
const PALETTE = ['#AEB9D2', '#B9B0C8', '#DDE3F0', '#78A88A', '#D2A85A', '#7E9FC4', '#C2596B', '#4C6FB9']

function hashStr(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

export function colorForId(id) {
  return PALETTE[hashStr(String(id)) % PALETTE.length]
}

export function initialsFor(fullName) {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(dateStr)
}
