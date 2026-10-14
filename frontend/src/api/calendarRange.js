// The days the Calendar shows, so it can ask the server for just those (tasks and milestones due
// in the window) instead of every task. Weeks start on Monday, and the month view is always six
// weeks of 7 days starting on the Monday on or before the 1st.

function pad(n) {
  return String(n).padStart(2, '0')
}

// A date as the calendar date it is (YYYY-MM-DD) in local time.
export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function startOfWeek(date) {
  const d = new Date(date)
  const offset = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - offset)
  d.setHours(0, 0, 0, 0)
  return d
}

// The first day of the 42-day month grid.
export function monthGridStart(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7 // Monday = 0
  return new Date(year, month, 1 - startOffset)
}

// { from, to } (both included, YYYY-MM-DD) for the view ('Month', 'Week' or 'Day') around `cursor`.
export function calendarRange(view, cursor) {
  if (view === 'Day') {
    const day = toISODate(cursor)
    return { from: day, to: day }
  }
  if (view === 'Week') {
    const start = startOfWeek(cursor)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { from: toISODate(start), to: toISODate(end) }
  }
  const start = monthGridStart(cursor.getFullYear(), cursor.getMonth())
  const end = new Date(start)
  end.setDate(start.getDate() + 41)
  return { from: toISODate(start), to: toISODate(end) }
}
