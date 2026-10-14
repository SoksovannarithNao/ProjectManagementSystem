import { apiFetch } from './client'

// The approval workflow of a task (assignment-brief.md B3.8). The server
// enforces who may do what; the UI only hides what would be refused.

// Every request and decision on a task, newest first.
export function getApprovals(taskId) {
  return apiFetch(`/tasks/${taskId}/approvals`)
}

// The open requests the signed-in user may decide.
export function getPendingApprovals() {
  return apiFetch('/approvals/pending')
}

// In Progress -> In Review + an approval request.
export function submitForReview(taskId) {
  return apiFetch(`/tasks/${taskId}/approval/submit`, { method: 'POST' })
}

// decision: APPROVED | CHANGES_REQUESTED | REJECTED. A comment is required for
// the last two; a rejection also names the next status (IN_PROGRESS | CANCELLED).
export function decideApproval(taskId, { decision, comment, nextStatus }) {
  return apiFetch(`/tasks/${taskId}/approval/decision`, {
    method: 'POST',
    body: { decision, comment: comment || null, nextStatus: nextStatus || null },
  })
}

// Names the approver of one task; null clears it.
export function setTaskApprover(taskId, approverId) {
  return apiFetch(`/tasks/${taskId}/approver`, { method: 'PUT', body: { approverId } })
}

export const DECISION_LABELS = {
  PENDING: 'Awaiting decision',
  APPROVED: 'Approved',
  CHANGES_REQUESTED: 'Changes requested',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
}
