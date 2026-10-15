import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, CalendarX2, Flag } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { TaskFormModal } from '../components/TaskFormModal'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { CalendarDayPanel } from '../components/CalendarDayPanel'
import { MilestoneDetailPanel } from '../components/MilestoneDetailPanel'
import { useAuth } from '../auth/AuthContext'
import { useApi } from '../api/useApi'
import { getTasksDueBetween, getTaskById, getTasksByMilestoneId } from '../api/tasks'
import { getMilestones } from '../api/milestones'
import { getProjects } from '../api/projects'
import { calendarRange, monthGridStart, startOfWeek, toISODate } from '../api/calendarRange'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const VIEWS = ['Month', 'Week', 'Day']

const eventTones = {
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  critical: 'bg-critical-soft text-critical-ink',
  info: 'bg-info-soft text-info-ink',
  // Milestones are not coloured by priority: a neutral chip with a flag marks them.
  milestone: 'bg-blue-gray text-ink',
}

const eventDots = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  critical: 'bg-critical',
  info: 'bg-info',
  milestone: 'bg-charcoal',
}

const PRIORITY_TONE = { LOW: 'info', MEDIUM: 'warning', HIGH: 'danger', URGENT: 'critical' }

const eventClass = (tone) =>
  `truncate rounded-[2px] px-1.5 py-[3px] text-[12px] font-semibold ${eventTones[tone] ?? eventTones.info}`

// One task or milestone on a day. Milestones carry a flag and a hidden "Milestone:"
// label so they are told apart by more than colour. Choosing a chip opens the item's detail
// (it does not also open the day behind it).
function EventChip({ ev, onOpen }) {
  const isMilestone = ev.kind === 'milestone'
  return (
    <button
      type="button"
      data-testid={isMilestone ? 'calendar-milestone' : 'calendar-task'}
      title={ev.hint}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(ev)
      }}
      className={`${eventClass(ev.tone)} cursor-pointer text-left hover:opacity-80 ${ev.done ? 'line-through opacity-60' : ''}`}
    >
      {isMilestone && (
        <>
          <Flag size={10} className="mr-1 inline-block align-[-1px]" aria-hidden="true" />
          <span className="sr-only">Milestone: </span>
        </>
      )}
      {ev.title}
    </button>
  )
}

function buildMonthGrid(year, month) {
  const start = monthGridStart(year, month)
  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}


// A due date is a calendar date ("2026-10-12"): read it as that day in local time.
// new Date("2026-10-12") is midnight UTC, which lands on the previous day west of UTC.
function parseDay(isoDate) {
  return new Date(`${isoDate}T00:00:00`)
}

function dateKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function Calendar() {
  const { canAny, can } = useAuth()
  const { data: projects } = useApi(getProjects)
  // Whether there's at least one project the caller can add tasks to —
  // TaskFormModal itself only offers projects the caller can actually
  // create tasks in.
  // A completed project takes no new tasks (D-27), so it does not count.
  const canAdd =
    projects == null
      ? canAny('TASK', 'CREATE')
      : projects.some((p) => p.status !== 'COMPLETED' && can('TASK', 'CREATE', p.id))
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const [view, setView] = useState('Month')
  // Only the days on screen are read from the server (tasks and milestones due in that window),
  // and a new window is read when the month, week or day changes.
  const range = useMemo(() => calendarRange(view, cursor), [view, cursor])
  const tasksFetcher = useCallback(() => getTasksDueBetween(range.from, range.to), [range])
  const { data: tasks, loading, refetch } = useApi(tasksFetcher)
  // Milestones due in the same window; if they fail to load the calendar still shows the tasks.
  const milestonesFetcher = useCallback(() => getMilestones(range), [range])
  const { data: milestones } = useApi(milestonesFetcher)
  const [newTaskDate, setNewTaskDate] = useState(null)
  // The day drawer: the day it shows, and the item chosen in it ({ kind: 'task' | 'milestone', id }) whose detail
  // is the drawer's second part.
  const [dayDate, setDayDate] = useState(null)
  const [selected, setSelected] = useState(null)

  const days = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor])

  const eventsByDay = useMemo(() => {
    const map = new Map()
    for (const t of tasks ?? []) {
      if (!t.dueDate) continue
      const key = dateKey(parseDay(t.dueDate))
      const list = map.get(key) ?? []
      list.push({
        kind: 'task',
        id: t.id,
        dueDate: t.dueDate,
        title: t.title,
        tone: PRIORITY_TONE[t.priority] ?? 'info',
        dot: eventDots[PRIORITY_TONE[t.priority] ?? 'info'],
        status: t.status,
        priority: t.priority,
        projectName: t.project?.name,
        done: t.status === 'COMPLETED',
        hint: t.project?.name ? `${t.title} · ${t.project.name}` : t.title,
      })
      map.set(key, list)
    }
    for (const m of milestones ?? []) {
      if (!m.dueDate) continue
      const key = dateKey(parseDay(m.dueDate))
      const list = map.get(key) ?? []
      list.push({
        kind: 'milestone',
        id: m.id,
        dueDate: m.dueDate,
        title: m.title,
        tone: 'milestone',
        status: m.status,
        projectName: m.project?.name,
        done: m.status === 'COMPLETED',
        hint: `Milestone · ${m.title}${m.project?.name ? ` · ${m.project.name}` : ''}`,
      })
      map.set(key, list)
    }
    return map
  }, [tasks, milestones])

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

  // Looked up in the lists on every render, so a task or milestone that is edited or deleted
  // while its panel is open shows the new values (or closes the panel).
  // A task opened from a milestone's linked tasks, or one an edit has just moved out of the window on
  // screen, is not in the list: it is read by id as well.
  const selectedTaskId = selected?.kind === 'task' ? selected.id : null
  const [fetchedTask, setFetchedTask] = useState(null)
  useEffect(() => {
    if (selectedTaskId == null) return
    let cancelled = false
    getTaskById(selectedTaskId)
      .then((t) => {
        if (!cancelled) setFetchedTask(t)
      })
      .catch(() => {
        if (!cancelled) setFetchedTask(null) // deleted meanwhile
      })
    return () => {
      cancelled = true
    }
  }, [selectedTaskId, tasks])
  const activeTask = useMemo(
    () =>
      selectedTaskId == null
        ? null
        : (tasks ?? []).find((t) => t.id === selectedTaskId) ?? (fetchedTask?.id === selectedTaskId ? fetchedTask : null),
    [tasks, selectedTaskId, fetchedTask]
  )
  const activeMilestone = useMemo(
    () => (selected?.kind === 'milestone' ? (milestones ?? []).find((m) => m.id === selected.id) ?? null : null),
    [milestones, selected]
  )
  // The tasks linked to the open milestone are read for it: they can be due on any day, not only in the window.
  const [milestoneTasks, setMilestoneTasks] = useState({ id: null, tasks: [] })
  const activeMilestoneId = activeMilestone?.id ?? null
  useEffect(() => {
    if (activeMilestoneId == null) return
    let cancelled = false
    getTasksByMilestoneId(activeMilestoneId)
      .then((list) => {
        if (!cancelled) setMilestoneTasks({ id: activeMilestoneId, tasks: list })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [activeMilestoneId, tasks])
  const linkedTasks = milestoneTasks.id === activeMilestoneId ? milestoneTasks.tasks : []

  // A chip opens the drawer on its own day with that item chosen; a row of the list only chooses it.
  const openItem = (ev) => {
    setDayDate(parseDay(ev.dueDate))
    setSelected({ kind: ev.kind, id: ev.id })
  }
  const closeDrawer = () => {
    setDayDate(null)
    setSelected(null)
  }

  return (
    <div>
      <TopBar
        title="Calendar"
        subtitle="Task due dates and milestones across your projects"
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
          <div className="flex items-center gap-2.5 max-[640px]:w-full">
            <button className="icon-btn" onClick={() => shiftPeriod(-1)} aria-label={`Previous ${view.toLowerCase()}`}>
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[190px] text-center text-[15px] font-[650] max-[640px]:min-w-0 max-[640px]:flex-1">{periodLabel}</span>
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
                className={`duration-[var(--duration-fast)] ease-[var(--ease-standard)] rounded-sm border-none px-3.5 py-[7px] text-[12px] font-semibold transition-colors ${
                  view === v ? 'bg-charcoal text-on-charcoal' : 'bg-transparent text-muted'
                }`}
                onClick={() => setView(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="grid grid-cols-7 gap-1.5 max-[640px]:gap-[3px]">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="min-h-24 rounded-sm max-[900px]:min-h-[68px]" />
            ))}
          </div>
        )}

        {!loading && view === 'Month' && (
          <>
            <div className="grid grid-cols-7 px-0.5 pb-2">
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className="text-faint text-center text-[12px] font-[650] tracking-[0.03em] uppercase"
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
                    onClick={() => inMonth && setDayDate(d)}
                    className={`duration-[var(--duration-fast)] ease-[var(--ease-standard)] flex min-h-24 flex-col gap-1.5 rounded-sm border p-2 transition-colors max-[900px]:min-h-[68px] max-[900px]:p-1.5 ${
                      inMonth ? 'bg-card hover:bg-subtle cursor-pointer' : 'bg-subtle'
                    } ${isToday ? 'border-charcoal' : 'border-divider'}`}
                  >
                    {inMonth ? (
                      <button
                        type="button"
                        data-testid="calendar-day-button"
                        aria-label={`${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${
                          events?.length ? `, ${events.length} due` : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDayDate(d)
                        }}
                        className={`hit-area relative inline-flex h-[22px] w-[22px] items-center justify-center self-start rounded-full text-xs font-[650] ${
                          isToday ? 'bg-charcoal text-on-charcoal' : ''
                        }`}
                      >
                        {d.getDate()}
                      </button>
                    ) : (
                      <span className="text-faint inline-flex h-[22px] w-[22px] items-center justify-center text-xs font-[650]">
                        {d.getDate()}
                      </span>
                    )}
                    <div className="flex flex-col gap-[3px] max-[640px]:hidden">
                      {events?.map((ev, idx) => (
                        <EventChip key={idx} ev={ev} onOpen={openItem} />
                      ))}
                    </div>
                    {/* Phones: cells are ~40px wide, so a title cannot fit. One dot per task, in its
                        priority colour; tapping the day opens its list. */}
                    {events?.length > 0 && (
                      <div
                        className="hidden flex-wrap gap-[3px] max-[640px]:flex"
                        aria-label={`${events.length} ${events.length === 1 ? 'item' : 'items'} due`}
                      >
                        {events.slice(0, 4).map((ev, idx) => (
                          <span key={idx} className={`h-1.5 w-1.5 rounded-full ${eventDots[ev.tone] ?? eventDots.info}`} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {!loading && view !== 'Month' && (
          <div className="flex flex-col">
            {rangeEntries.every((e) => e.events.length === 0) && (
              <EmptyState icon={CalendarX2} title="No due dates in this range" />
            )}
            {rangeEntries.map(({ date, events }) => (
              <div
                key={date.toISOString()}
                onClick={() => setDayDate(date)}
                className="border-divider hover:bg-subtle flex cursor-pointer items-center gap-5 border-b px-1 py-3.5 last:border-b-0"
              >
                <span
                  className={`w-[92px] shrink-0 text-[13px] font-[650] ${isSameDay(date, today) ? 'text-ink' : 'text-muted'}`}
                >
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                {events.length === 0 ? (
                  <span className="text-faint text-[12px]">Nothing due</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {events.map((ev, idx) => (
                      <EventChip key={idx} ev={ev} onOpen={openItem} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {dayDate && (
        <CalendarDayPanel
          date={dayDate}
          events={eventsByDay.get(dateKey(dayDate)) ?? []}
          canAdd={canAdd}
          selected={selected}
          onSelect={(ev) => setSelected({ kind: ev.kind, id: ev.id })}
          onAddTask={() => {
            setNewTaskDate(toISODate(dayDate))
            closeDrawer()
          }}
          onClose={closeDrawer}
          detail={
            activeTask ? (
              <TaskDetailPanel
                key={activeTask.id}
                embedded
                task={activeTask}
                onClose={() => setSelected(null)}
                onChange={refetch}
              />
            ) : activeMilestone ? (
              <MilestoneDetailPanel
                key={activeMilestone.id}
                milestone={activeMilestone}
                tasks={linkedTasks}
                onOpenTask={(t) => setSelected({ kind: 'task', id: t.id })}
                onClose={() => setSelected(null)}
              />
            ) : null
          }
        />
      )}

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
