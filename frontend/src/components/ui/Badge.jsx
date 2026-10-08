const slug = (s) => (s || '').toLowerCase().replace(/\s+/g, '-')

const toneClasses = {
  high: 'bg-danger-soft text-danger-ink',
  medium: 'bg-warning-soft text-warning-ink',
  low: 'bg-info-soft text-info-ink',
  urgent: 'bg-danger-soft text-danger-ink',
  critical: 'bg-danger-soft text-danger-ink',
  todo: 'bg-subtle text-muted',
  to_do: 'bg-subtle text-muted',
  'in-progress': 'bg-info-soft text-info-ink',
  in_progress: 'bg-info-soft text-info-ink',
  review: 'bg-warning-soft text-warning-ink',
  in_review: 'bg-warning-soft text-warning-ink',
  done: 'bg-success-soft text-success-ink',
  completed: 'bg-success-soft text-success-ink',
  onrisk: 'bg-danger-soft text-danger-ink',
  'at-risk': 'bg-danger-soft text-danger-ink',
  ontrack: 'bg-success-soft text-success-ink',
  'on-track': 'bg-success-soft text-success-ink',
  planning: 'bg-info-soft text-info-ink',
  on_hold: 'bg-warning-soft text-warning-ink',
}

export function Badge({ children, tone, className }) {
  const variant = slug(tone || children)
  const toneClass = toneClasses[variant] ?? 'bg-subtle text-muted'
  const baseClass =
    className ??
    'inline-flex items-center gap-[5px] rounded-full px-2.5 py-1 text-[12px] leading-none font-semibold whitespace-nowrap'
  return (
    <span
      className={`${baseClass} whitespace-nowrap before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:content-[''] ${toneClass}`}
    >
      {children}
    </span>
  )
}
