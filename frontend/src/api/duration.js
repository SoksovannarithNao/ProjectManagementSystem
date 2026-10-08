// Time helpers shared by the estimate field and the time-tracking panel.
// Everything is stored and sent as decimal HOURS (the backend's
// estimated_hours / hours_worked columns); these only translate to and from
// what a person types or reads.

export const HOURS_PER_DAY = 8

const round2 = (n) => Math.round(n * 100) / 100

// Accepts what people actually type:
//   "4" / "1.5"       -> hours
//   "90m" / "45 min"  -> minutes
//   "2h 30m" / "1h30" -> hours + minutes
//   "1:30"            -> h:mm
//   "2d" / "1d 4h"    -> working days (8h each)
// Returns decimal hours, or null when the text is not a valid duration
// (the caller decides whether empty text is acceptable).
export function parseDuration(text) {
  const s = String(text ?? '').trim().toLowerCase().replace(',', '.')
  if (!s) return null

  if (/^\d+(\.\d+)?$/.test(s)) return round2(parseFloat(s))

  const clock = /^(\d+):([0-5]\d)$/.exec(s)
  if (clock) return round2(Number(clock[1]) + Number(clock[2]) / 60)

  // "1h30": minutes after an h with no unit of their own.
  const shorthand = /^(\d+)\s*h\s*([0-5]?\d)$/.exec(s)
  if (shorthand) return round2(Number(shorthand[1]) + Number(shorthand[2]) / 60)

  const unit = /(\d+(?:\.\d+)?)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m)\b/g
  let total = 0
  let consumed = ''
  let match
  while ((match = unit.exec(s)) !== null) {
    const value = parseFloat(match[1])
    const u = match[2][0]
    total += u === 'd' ? value * HOURS_PER_DAY : u === 'h' ? value : value / 60
    consumed += match[0]
  }
  // Every character must belong to a number+unit pair (spaces aside), so
  // "2 apples" or "1h banana" is rejected instead of silently read as 1h.
  if (!consumed || s.replace(/\s+/g, '') !== consumed.replace(/\s+/g, '')) return null
  return round2(total)
}

// 0.5 -> "30m", 1.5 -> "1h 30m", 4 -> "4h", null -> "—"
export function formatHours(hours) {
  if (hours == null || Number.isNaN(Number(hours))) return '—'
  const minutes = Math.round(Number(hours) * 60)
  if (minutes === 0) return '0h'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// A running timer's elapsed milliseconds as 0:05:09 / 1:02:03.
export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Local calendar date as YYYY-MM-DD (not UTC), for <input type="date"> and
// the backend's work_date.
export function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
