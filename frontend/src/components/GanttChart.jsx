import { useMemo, useState } from 'react'
import { formatDate, humanizeEnum } from '../api/format'

// Gantt Chart Prototype (assignment-brief.md Part A, workflow A8; optional): each
// task is a duration bar from its start date to its due date on one
// time axis, with its task dependencies drawn as arrows from the prerequisite's
// end to the dependent task's start. Hovering a bar fades every task that does
// not overlap it, so overlapping work is easy to see; an arrow turns red when a
// task is planned to start before its unfinished prerequisite is due.
// Only data the API already sends is drawn - nothing is stored. Every task has a
// start and a due date (both are required), so every task gets a bar.

const DAY = 24 * 60 * 60 * 1000
const ROW = 36
const LABEL_W = 220
const PAD_DAYS = 3
const ZOOMS = {
  weeks: { label: 'Weeks', dayW: 16 },
  months: { label: 'Months', dayW: 5 },
}

const parse = (iso) => (iso ? new Date(`${iso}T00:00:00`) : null)
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const daysBetween = (a, b) => Math.round((b - a) / DAY)

const STATUS_BAR = {
  TODO: 'bg-faint',
  IN_PROGRESS: 'bg-info',
  IN_REVIEW: 'bg-warning',
  COMPLETED: 'bg-success',
  CANCELLED: 'bg-divider',
}
const FINISHED = new Set(['COMPLETED', 'CANCELLED'])

// Week ticks (every Monday) or month ticks (the 1st), whichever the zoom asks for.
function ticksFor(zoom, min, max) {
  const ticks = []
  if (zoom === 'weeks') {
    const cursor = new Date(min)
    cursor.setDate(cursor.getDate() + ((8 - cursor.getDay()) % 7))
    while (cursor <= max) {
      ticks.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 7)
    }
  } else {
    const cursor = new Date(min.getFullYear(), min.getMonth() + 1, 1)
    while (cursor <= max) {
      ticks.push(new Date(cursor))
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }
  return ticks
}

const tickLabel = (zoom, d) =>
  zoom === 'weeks'
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

export function GanttChart({ project, tasks, dependencies, onOpenTask }) {
  const [zoom, setZoom] = useState('weeks')
  const [hoverId, setHoverId] = useState(null)
  const dayW = ZOOMS[zoom].dayW

  // One bar per task, earliest start first.
  const scheduled = useMemo(
    () =>
      tasks
        .map((t) => ({ task: t, start: parse(t.startDate), due: parse(t.dueDate) }))
        .sort((a, b) => a.start - b.start || a.due - b.due),
    [tasks]
  )

  const chart = useMemo(() => {
    const projectStart = parse(project.startDate)
    const projectEnd = parse(project.endDate)
    const edges = [...scheduled.flatMap((s) => [s.start, s.due]), ...(projectStart ? [projectStart] : []), ...(projectEnd ? [projectEnd] : [])]
    const today = startOfDay(new Date())
    const all = [...edges, today]
    const min = new Date(Math.min(...all) - PAD_DAYS * DAY)
    const max = new Date(Math.max(...all) + PAD_DAYS * DAY)
    const x = (d) => daysBetween(min, d) * dayW
    const width = (a, b) => Math.max((daysBetween(a, b) + 1) * dayW, 6)
    return {
      min,
      max,
      today,
      x,
      width,
      projectStart,
      projectEnd,
      totalW: (daysBetween(min, max) + 1) * dayW,
      ticks: ticksFor(zoom, min, max),
    }
  }, [project, scheduled, zoom, dayW])

  // Row i of the chart: row 0 is the project, then one row per scheduled task.
  const rowOf = useMemo(() => new Map(scheduled.map((s, i) => [s.task.id, i + 1])), [scheduled])
  const byId = useMemo(() => new Map(scheduled.map((s) => [s.task.id, s])), [scheduled])

  // Arrows between two scheduled tasks of this project. Conflict: the dependent task
  // starts before its prerequisite is due, and the prerequisite is not finished.
  const arrows = useMemo(
    () =>
      (dependencies ?? [])
        .map((d) => {
          const from = byId.get(d.dependsOnTask?.id)
          const to = byId.get(d.task?.id)
          if (!from || !to) return null
          const conflict = to.start < from.due && !FINISHED.has(from.task.status)
          return { key: `${from.task.id}-${to.task.id}`, from, to, conflict }
        })
        .filter(Boolean),
    [dependencies, byId]
  )
  const conflicts = arrows.filter((a) => a.conflict).length

  const overlaps = (a, b) => a.start <= b.due && b.start <= a.due
  const hovered = hoverId != null ? byId.get(hoverId) : null
  const dimmed = (s) => hovered && s.task.id !== hoverId && !overlaps(hovered, s)

  const rows = scheduled.length + 1
  const height = rows * ROW
  const barY = (row) => row * ROW + ROW / 2

  return (
    <div className="card px-6 py-5" data-testid="gantt">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
          <span data-testid="gantt-count">{scheduled.length} {scheduled.length === 1 ? 'task' : 'tasks'}</span>
          <span>{arrows.length} {arrows.length === 1 ? 'dependency' : 'dependencies'}</span>
          <span data-testid="gantt-conflicts" className={conflicts ? 'text-danger-ink font-semibold' : ''}>
            {conflicts} {conflicts === 1 ? 'task starts' : 'tasks start'} before a prerequisite ends
          </span>
        </div>
        <div className="ml-auto inline-flex gap-1" role="group" aria-label="Zoom">
          {Object.entries(ZOOMS).map(([key, { label }]) => (
            <button
              key={key}
              type="button"
              aria-pressed={zoom === key}
              onClick={() => setZoom(key)}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
                zoom === key ? 'bg-charcoal text-on-charcoal' : 'bg-subtle text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {scheduled.length === 0 ? (
        <p className="text-faint text-[12px]">No tasks to draw yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ width: LABEL_W + chart.totalW, minWidth: '100%' }}>
            {/* axis */}
            <div className="border-divider flex border-b pb-1.5">
              <div className="bg-card sticky left-0 z-10 shrink-0" style={{ width: LABEL_W }} />
              <div className="relative h-5" style={{ width: chart.totalW }}>
                {chart.ticks.map((tick) => (
                  <span
                    key={tick.toISOString()}
                    className="text-faint absolute top-0 text-[11px] font-semibold whitespace-nowrap"
                    style={{ left: chart.x(tick) }}
                  >
                    {tickLabel(zoom, tick)}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex">
              {/* names and durations; stays in view while the chart scrolls sideways */}
              <div className="bg-card sticky left-0 z-10 shrink-0" style={{ width: LABEL_W }}>
                <div className="border-divider flex items-center border-b pr-3" style={{ height: ROW }}>
                  <div className="min-w-0">
                    <p className="text-ink truncate text-[12px] font-semibold">{project.name}</p>
                    <p className="text-faint truncate text-[11px]">
                      {formatDate(project.startDate)} → {formatDate(project.endDate)}
                    </p>
                  </div>
                </div>
                {scheduled.map(({ task, start, due }) => (
                  <div key={task.id} className="border-divider flex items-center border-b pr-3" style={{ height: ROW }}>
                    <div className="min-w-0">
                      <p className="text-ink truncate text-[12px] font-semibold">{task.title}</p>
                      <p className="text-faint truncate text-[11px]">
                        {formatDate(task.startDate)} → {formatDate(task.dueDate)} · {daysBetween(start, due) + 1}{' '}
                        {daysBetween(start, due) === 0 ? 'day' : 'days'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* the drawing area */}
              <div className="relative" style={{ width: chart.totalW, height }}>
                {chart.ticks.map((tick) => (
                  <span key={tick.toISOString()} className="bg-divider absolute inset-y-0 w-px" style={{ left: chart.x(tick) }} />
                ))}
                {Array.from({ length: rows }, (_, i) => (
                  <span key={i} className="border-divider absolute right-0 left-0 border-b" style={{ top: (i + 1) * ROW - 1 }} />
                ))}
                {chart.today >= chart.min && chart.today <= chart.max && (
                  <span
                    data-testid="gantt-today"
                    className="bg-danger absolute inset-y-0 z-[1] w-0.5"
                    style={{ left: chart.x(chart.today) }}
                    title="Today"
                  />
                )}

                {chart.projectStart && chart.projectEnd && (
                  <span
                    className="bg-lavender absolute h-3 rounded-full opacity-80"
                    style={{ left: chart.x(chart.projectStart), width: chart.width(chart.projectStart, chart.projectEnd), top: barY(0) - 6 }}
                    title={`Project: ${formatDate(project.startDate)} to ${formatDate(project.endDate)}`}
                  />
                )}

                {/* dependency arrows, under the bars */}
                <svg className="pointer-events-none absolute inset-0" width={chart.totalW} height={height} aria-hidden="true">
                  <defs>
                    <marker id="gantt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                      <path d="M0,0 L8,4 L0,8 z" fill="var(--color-muted)" />
                    </marker>
                    <marker id="gantt-arrow-conflict" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                      <path d="M0,0 L8,4 L0,8 z" fill="var(--color-danger)" />
                    </marker>
                  </defs>
                  {arrows.map((a) => {
                    const x1 = chart.x(a.from.due) + dayW
                    const y1 = barY(rowOf.get(a.from.task.id))
                    const x2 = chart.x(a.to.start)
                    const y2 = barY(rowOf.get(a.to.task.id))
                    const mid = (y1 + y2) / 2
                    return (
                      <path
                        key={a.key}
                        data-testid="gantt-dependency"
                        data-conflict={a.conflict ? 'true' : 'false'}
                        d={`M${x1},${y1} H${x1 + 6} V${mid} H${x2 - 6} V${y2} H${x2}`}
                        fill="none"
                        stroke={a.conflict ? 'var(--color-danger)' : 'var(--color-muted)'}
                        strokeWidth="1.5"
                        markerEnd={a.conflict ? 'url(#gantt-arrow-conflict)' : 'url(#gantt-arrow)'}
                        opacity={hovered ? 0.35 : 1}
                      />
                    )
                  })}
                </svg>

                {scheduled.map((s) => {
                  const { task, start, due } = s
                  return (
                    <button
                      key={task.id}
                      type="button"
                      data-testid="gantt-task"
                      aria-label={`Task ${task.title}, ${formatDate(task.startDate)} to ${formatDate(task.dueDate)}, ${humanizeEnum(task.status)}${task.overdue ? ', overdue' : ''}`}
                      onClick={() => onOpenTask?.(task.id)}
                      onMouseEnter={() => setHoverId(task.id)}
                      onMouseLeave={() => setHoverId(null)}
                      onFocus={() => setHoverId(task.id)}
                      onBlur={() => setHoverId(null)}
                      className={`absolute z-[2] h-[18px] overflow-hidden rounded-[5px] transition-opacity ${STATUS_BAR[task.status] ?? 'bg-faint'} ${
                        task.overdue ? 'ring-danger ring-2' : ''
                      } ${task.status === 'CANCELLED' ? 'opacity-50' : dimmed(s) ? 'opacity-25' : ''}`}
                      style={{ left: chart.x(start), width: chart.width(start, due), top: barY(rowOf.get(task.id)) - 9 }}
                      title={`${task.title} · ${humanizeEnum(task.status)} · ${Math.round(Number(task.progress ?? 0))}%`}
                    >
                      <span
                        className="absolute inset-y-0 left-0 bg-black/25"
                        style={{ width: `${Math.min(Math.max(Number(task.progress ?? 0), 0), 100)}%` }}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="text-muted mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-lavender h-2.5 w-4 rounded-full opacity-80" /> Project
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-faint h-2.5 w-4 rounded-[3px]" /> To Do
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-info h-2.5 w-4 rounded-[3px]" /> In Progress
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-warning h-2.5 w-4 rounded-[3px]" /> In Review
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-success h-2.5 w-4 rounded-[3px]" /> Completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="ring-danger h-2.5 w-4 rounded-[3px] bg-transparent ring-2" /> Overdue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-muted h-0.5 w-4" /> Dependency
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-danger h-0.5 w-4" /> Starts before its prerequisite ends
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-danger h-3 w-0.5" /> Today
        </span>
        <span className="text-faint">Hover a bar to see the tasks that overlap it.</span>
      </div>
    </div>
  )
}
