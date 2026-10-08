// The TaskFlow mark. Fills come from theme tokens (ink flips in dark mode)
// so the dark squares never sink into a dark surface.
export function Logo({ size = 20 }) {
  return (
    <span className="inline-flex" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
        <rect x="1" y="1" width="8" height="8" rx="2.5" className="fill-ink" />
        <rect x="11" y="1" width="8" height="8" rx="2.5" className="fill-lavender" />
        <rect x="1" y="11" width="8" height="8" rx="2.5" className="fill-lavender" />
        <rect x="11" y="11" width="8" height="8" rx="2.5" className="fill-ink" />
      </svg>
    </span>
  )
}
