import { Clock } from 'lucide-react'

// "Delayed" is never a stored status: the server calculates it (the end date has
// passed and the project is neither Completed nor Cancelled, B1.3) and sends
// `delayed` / `daysDelayed`. Shows nothing for a project that is not delayed.
export function DelayedBadge({ project, className = '' }) {
  if (!project?.delayed) return null
  const days = project.daysDelayed
  return (
    <span
      data-testid="delayed-badge"
      title={days ? `The end date passed ${days} day${days === 1 ? '' : 's'} ago` : 'The end date has passed'}
      className={`bg-danger-soft text-danger-ink inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] leading-none font-semibold whitespace-nowrap ${className}`}
    >
      <Clock size={12} /> Delayed{days ? ` · ${days}d` : ''}
    </span>
  )
}
