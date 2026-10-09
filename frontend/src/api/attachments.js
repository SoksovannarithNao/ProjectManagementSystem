import { apiFetch, apiUpload, apiDownload } from './client'

// Files attached to a task or a project. The server decides what is allowed
// (types, size, how many); these constants only let the UI say so before
// uploading. Keep them in step with util/FileTypeGuard and
// app.attachments.max-size-bytes on the backend.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'txt', 'md', 'csv', 'json',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'zip',
]
export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(',')

export function getTaskAttachments(taskId) {
  return apiFetch(`/attachments/task/${taskId}`)
}

export function getProjectAttachments(projectId) {
  return apiFetch(`/attachments/project/${projectId}`)
}

// Attach to a task (taskId) or to a project (projectId) - exactly one.
export function uploadAttachment(file, { taskId, projectId }) {
  const formData = new FormData()
  formData.append('file', file)
  if (taskId != null) formData.append('taskId', String(taskId))
  if (projectId != null) formData.append('projectId', String(projectId))
  return apiUpload('/attachments', formData, { method: 'POST' })
}

export function deleteAttachment(id) {
  return apiFetch(`/attachments/${id}`, { method: 'DELETE' })
}

// Fetches the file with the user's token and saves it under its own name.
export async function downloadAttachment(attachment) {
  const blob = await apiDownload(`/attachments/${attachment.id}/download`)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function formatFileSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
