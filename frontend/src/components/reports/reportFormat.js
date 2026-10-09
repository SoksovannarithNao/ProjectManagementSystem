// Dates in reports carry the year (the rest of the app shows "Oct 5").
export function fullDate(iso) {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// A rate comes back as 0-100 with one decimal, or null when there is nothing to divide by.
export function pct(value) {
  return value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`
}

export function hours(value) {
  const n = Number(value ?? 0)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
