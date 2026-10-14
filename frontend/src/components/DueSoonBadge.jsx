import { Clock } from 'lucide-react'
import { dueSoonLabel } from '../api/format'

// "Due soon" is never stored: the server calculates it (an open task due today or
// within the next 3 days, `Derived.isTaskDueSoon`) and sends `dueSoon`. Overdue
// tasks have their own red flag instead. Shows nothing for any other task.
export function DueSoonBadge({ task, className = '' }) {
  if (!task?.dueSoon) return null
  return (
    <span
      data-testid="due-soon-badge"
      title="This task is close to its due date"
      className={`bg-warning-soft text-warning-ink inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] leading-none font-semibold whitespace-nowrap ${className}`}
    >
      <Clock size={12} /> {dueSoonLabel(task.dueDate)}
    </span>
  )
}
