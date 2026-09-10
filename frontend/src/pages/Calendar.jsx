import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, CalendarX2 } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { EmptyState } from '../components/ui/EmptyState'
import { TaskFormModal } from '../components/TaskFormModal'
import { useAuth } from '../auth/AuthContext'
import { canCreateTask } from '../api/permissions'
import { useApi } from '../api/useApi'
import { getTasks } from '../api/tasks'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const VIEWS = ['Month', 'Week', 'Day']

const eventTones = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
}

const PRIORITY_TONE = { LOW: 'info', MEDIUM: 'warning', HIGH: 'danger', URGENT: 'danger' }

const eventClass = (tone) =>
  `truncate rounded-[5px] px-1.5 py-[3px] text-[10.5px] font-semibold max-[900px]:text-[9.5px] ${eventTones[tone] ?? eventTones.info}`

function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7 // Monday = 0
  const start = new Date(year, month, 1 - startOffset)
  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}

function startOfWeek(date) {
  const d = new Date(date)
  const offset = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - offset)
  d.setHours(0, 0, 0, 0)
  return d
}

function dateKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function Calendar() {
  const { role } = useAuth()
  const canAdd = canCreateTask(role)
  const { data: tasks, refetch } = useApi(getTasks)
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const [view, setView] = useState('Month')
  const [newTaskDate, setNewTaskDate] = useState(null)

  const days = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor])

  const eventsByDay = useMemo(() => {
    const map = new Map()
    for (const t of tasks ?? []) {
      if (!t.dueDate) continue
      const due = new Date(t.dueDate)
      const key = dateKey(due)
      const list = map.get(key) ?? []
      list.push({ title: t.title, tone: PRIORITY_TONE[t.priority] ?? 'info' })
      map.set(key, list)
    }
    return map
  }, [tasks])

  const shiftPeriod = (delta) => {
    setCursor((prev) => {
      if (view === 'Month') return new Date(prev.getFullYear(), prev.getMonth() + delta, 1)
      if (view === 'Week') return new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + delta * 7)
      return new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + delta)
    })
  }

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  const periodLabel = useMemo(() => {
    if (view === 'Month') return cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (view === 'Day') {
      return cursor.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    }
    const start = startOfWeek(cursor)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${startStr} – ${endStr}`
  }, [cursor, view])

  const rangeEntries = useMemo(() => {
    if (view === 'Day') return [{ date: cursor, events: eventsByDay.get(dateKey(cursor)) ?? [] }]
    if (view === 'Week') {
      const start = startOfWeek(cursor)
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        return { date: d, events: eventsByDay.get(dateKey(d)) ?? [] }
      })
    }
    return []
  }, [view, cursor, eventsByDay])

  const openNewTask = (date) => {
    if (!canAdd) return
    setNewTaskDate(toISODate(date))
  }

  return (
    <div>
      <TopBar
        title="Calendar"
        subtitle="Plan and track deadlines across your projects"
        actions={
          canAdd && (
            <button className="btn btn-primary" onClick={() => openNewTask(cursor)}>
              <Plus size={16} /> New Event
            </button>
          )
        }
      />

      <div className="card px-[22px] pt-5 pb-6">
        <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex items-center gap-2.5">
            <button className="icon-btn" onClick={() => shiftPeriod(-1)} aria-label={`Previous ${view.toLowerCase()}`}>
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[190px] text-center text-[15px] font-[650]">{periodLabel}</span>
            <button className="icon-btn" onClick={() => shiftPeriod(1)} aria-label={`Next ${view.toLowerCase()}`}>
              <ChevronRight size={16} />
            </button>
            <button
              className="btn btn-secondary ml-1 px-3.5 py-2"
              onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), today.getDate()))}
            >
              Today
            </button>
          </div>
          <div className="bg-subtle border-border flex gap-0.5 rounded-md border p-[3px]">
            {VIEWS.map((v) => (
              <button
                key={v}
                className={`duration-[var(--duration-fast)] ease-[var(--ease-standard)] rounded-sm border-none px-3.5 py-[7px] text-[12.5px] font-semibold transition-colors ${
                  view === v ? 'bg-charcoal text-white' : 'bg-transparent text-muted'
                }`}
                onClick={() => setView(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {view === 'Month' && (
          <>
            <div className="grid grid-cols-7 px-0.5 pb-2">
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className="text-faint text-center text-[11.5px] font-[650] tracking-[0.03em] uppercase max-[900px]:text-[10px]"
                >
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5 max-[640px]:gap-[3px]">
              {days.map((d, i) => {
                const inMonth = d.getMonth() === cursor.getMonth()
                const events = inMonth ? eventsByDay.get(dateKey(d)) : null
                const isToday = isSameDay(d, today)
                return (
                  <div
                    key={i}
                    onClick={() => inMonth && openNewTask(d)}
                    className={`duration-[var(--duration-fast)] ease-[var(--ease-standard)] flex min-h-24 flex-col gap-1.5 rounded-sm border p-2 transition-colors max-[900px]:min-h-[68px] max-[900px]:p-1.5 ${
                      inMonth ? `bg-card hover:bg-subtle${canAdd ? ' cursor-pointer' : ''}` : 'bg-subtle'
                    } ${isToday ? 'border-charcoal' : 'border-divider'}`}
                  >
                    <span
                      className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-xs font-[650] ${
                        isToday ? 'bg-charcoal text-white' : !inMonth ? 'text-faint' : ''
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    <div className={`flex flex-col gap-[3px] ${isToday ? '' : 'max-[640px]:hidden'}`}>
                      {events?.map((ev, idx) => (
                        <span key={idx} className={eventClass(ev.tone)}>
                          {ev.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {view !== 'Month' && (
          <div className="flex flex-col">
            {rangeEntries.every((e) => e.events.length === 0) && (
              <EmptyState icon={CalendarX2} title="No due dates in this range" />
            )}
            {rangeEntries.map(({ date, events }) => (
              <div
                key={date.toISOString()}
                onClick={() => openNewTask(date)}
                className={`border-divider flex items-center gap-5 border-b px-1 py-3.5 last:border-b-0 ${canAdd ? 'hover:bg-subtle cursor-pointer' : ''}`}
              >
                <span
                  className={`w-[92px] shrink-0 text-[13px] font-[650] ${isSameDay(date, today) ? 'text-ink' : 'text-muted'}`}
                >
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                {events.length === 0 ? (
                  <span className="text-faint text-[12px]">No tasks due</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {events.map((ev, idx) => (
                      <span key={idx} className={eventClass(ev.tone)}>
                        {ev.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {newTaskDate && (
        <TaskFormModal
          defaultDueDate={newTaskDate}
          onClose={() => setNewTaskDate(null)}
          onSaved={refetch}
        />
      )}
    </div>
  )
}
