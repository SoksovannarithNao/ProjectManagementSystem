const slug = (s) => (s || '').toLowerCase().replace(/\s+/g, '-')

const toneClasses = {
  high: 'bg-danger-soft text-danger',
  medium: 'bg-warning-soft text-warning',
  low: 'bg-info-soft text-info',
  urgent: 'bg-danger-soft text-danger',
  todo: 'bg-subtle text-muted',
  to_do: 'bg-subtle text-muted',
  'in-progress': 'bg-info-soft text-info',
  in_progress: 'bg-info-soft text-info',
  review: 'bg-warning-soft text-warning',
  in_review: 'bg-warning-soft text-warning',
  done: 'bg-success-soft text-success',
  completed: 'bg-success-soft text-success',
  onrisk: 'bg-danger-soft text-danger',
  'at-risk': 'bg-danger-soft text-danger',
  ontrack: 'bg-success-soft text-success',
  'on-track': 'bg-success-soft text-success',
  planning: 'bg-info-soft text-info',
  on_hold: 'bg-warning-soft text-warning',
}

export function Badge({ children, tone }) {
  const variant = slug(tone || children)
  const toneClass = toneClasses[variant] ?? 'bg-subtle text-muted'
  return (
    <span
      className={`inline-flex items-center gap-[5px] rounded-full px-2.5 py-1 text-[11.5px] leading-none font-semibold whitespace-nowrap before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:content-[''] ${toneClass}`}
    >
      {children}
    </span>
  )
}
