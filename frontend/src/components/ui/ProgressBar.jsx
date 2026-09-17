export function ProgressBar({ percent = 0, color, height = 7 }) {
  return (
    <div className="bg-divider w-full overflow-hidden rounded-full" style={{ height }}>
      <div
        // bg-ink (not a fixed dark color) so the fill still contrasts against
        // the track in dark mode, where --color-divider is itself dark —
        // ink flips to near-white there instead of nearly disappearing.
        className="bg-ink ease-[var(--ease-standard)] h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color }}
      />
    </div>
  )
}
