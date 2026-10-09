import { ClipboardCheck } from 'lucide-react'

// A small marker for where a task stands in the approval workflow, shown on
// task rows and Kanban cards. Nothing is shown for a task that is not in
// review and has no open feedback for its doer.
export function ApprovalChip({ task }) {
  const decision = task?.approvalStatus
  let label = null
  if (task?.status === 'IN_REVIEW' && decision === 'PENDING') label = 'Awaiting approval'
  else if (task?.status === 'IN_PROGRESS' && decision === 'CHANGES_REQUESTED') label = 'Changes requested'
  else if (task?.status === 'IN_PROGRESS' && decision === 'REJECTED') label = 'Rejected'
  if (!label) return null
  return (
    <span
      data-testid="approval-chip"
      className="bg-warning-soft text-warning-ink inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap"
    >
      <ClipboardCheck size={12} /> {label}
    </span>
  )
}
