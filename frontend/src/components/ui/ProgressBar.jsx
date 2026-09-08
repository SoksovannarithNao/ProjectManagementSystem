export function ProgressBar({ percent = 0, color, height = 7 }) {
  return (
    <div className="bg-divider w-full overflow-hidden rounded-full" style={{ height }}>
      <div
        className="bg-charcoal ease-[var(--ease-standard)] h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color }}
      />
    </div>
  )
}
