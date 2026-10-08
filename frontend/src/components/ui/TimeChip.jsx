import { Clock } from 'lucide-react'
import { formatHours } from '../../api/duration'

// "2h 30m / 4h" — logged time against the estimate, on task rows and board
// cards. Renders nothing for a task with neither, so untracked tasks stay
// uncluttered. Past the estimate it turns danger-ink (and says so in the
// tooltip), the same "risk is the loudest thing" rule as overdue.
export function TimeChip({ task }) {
  const estimate = Number(task?.estimatedHours) || 0
  const actual = Number(task?.actualHours) || 0
  if (estimate <= 0 && actual <= 0) return null

  const over = estimate > 0 && actual > estimate
  const label =
    estimate > 0 ? `${formatHours(actual)} / ${formatHours(estimate)}` : `${formatHours(actual)} logged`
  const title = over
    ? `${formatHours(actual - estimate)} over the ${formatHours(estimate)} estimate`
    : estimate > 0
      ? `${formatHours(actual)} logged of ${formatHours(estimate)} estimated`
      : `${formatHours(actual)} logged, no estimate set`

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-[12px] whitespace-nowrap ${
        over ? 'text-danger-ink font-semibold' : 'text-muted'
      }`}
    >
      <Clock size={12} />
      {label}
    </span>
  )
}
