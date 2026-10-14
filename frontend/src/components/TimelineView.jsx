import { useMemo, useState } from 'react'
import { Flag } from 'lucide-react'
import { Badge } from './ui/Badge'
import { ProgressBar } from './ui/ProgressBar'
import { formatDate, humanizeEnum } from '../api/format'

// Project Timeline (assignment-brief.md Part A, workflow A5): the project's
// start and end, its milestones' dates and every task's start and due date on
// one time axis. Selecting a task opens it (and, with the Edit permission, it
// can be edited there); selecting a milestone shows its details underneath.
// Only dates and statuses already sent by the API are drawn - nothing is stored.

const DAY = 24 * 60 * 60 * 1000
const parse = (iso) => (iso ? new Date(`${iso}T00:00:00`) : null)
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

const STATUS_BAR = {
  TODO: 'bg-faint',
  IN_PROGRESS: 'bg-info',
  IN_REVIEW: 'bg-warning',
  COMPLETED: 'bg-success',
  CANCELLED: 'bg-divider',
}

function monthTicks(min, max) {
  const ticks = []
  const cursor = new Date(min.getFullYear(), min.getMonth(), 1)
  while (cursor <= max) {
    ticks.push(new Date(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return ticks
}

// One labelled row of the chart: the name on the left, the drawn items on the right.
function Row({ label, sub, children }) {
  return (
    <div className="border-divider flex min-h-[36px] items-center border-b last:border-b-0">
      <div className="w-[190px] shrink-0 pr-3">
        <p className="text-ink truncate text-[12px] font-semibold">{label}</p>
        {sub && <p className="text-faint truncate text-[11px]">{sub}</p>}
      </div>
      <div className="relative h-[36px] min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function TimelineView({ project, tasks, milestones, onOpenTask }) {
  const [selectedMilestone, setSelectedMilestone] = useState(null)

  const model = useMemo(() => {
    const dates = []
    const add = (iso) => {
      const d = parse(iso)
      if (d) dates.push(d)
    }
    add(project.startDate)
    add(project.endDate)
    milestones.forEach((m) => add(m.dueDate))
    tasks.forEach((t) => {
      add(t.startDate)
      add(t.dueDate)
    })
    const today = startOfDay(new Date())
    const min = new Date(Math.min(...dates, today.getTime()) - 2 * DAY)
    const max = new Date(Math.max(...dates, today.getTime()) + 2 * DAY)
    const span = Math.max(max - min, DAY)
    const pos = (d) => `${(((d - min) / span) * 100).toFixed(3)}%`
    const width = (a, b) => `${Math.max(((Math.max(b - a, 0) + DAY) / span) * 100, 0.8).toFixed(3)}%`
    return {
      min,
      max,
      today,
      pos,
      width,
      ticks: monthTicks(min, max),
      todayVisible: today >= min && today <= max,
    }
  }, [project, tasks, milestones])

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => new Date(a.startDate ?? 0) - new Date(b.startDate ?? 0)),
    [tasks]
  )
  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => new Date(a.dueDate ?? 0) - new Date(b.dueDate ?? 0)),
    [milestones]
  )
  const chosen = sortedMilestones.find((m) => m.id === selectedMilestone)

  const projectStart = parse(project.startDate)
  const projectEnd = parse(project.endDate)

  return (
    <div className="card px-6 py-5" data-testid="timeline">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {/* axis */}
          <div className="border-divider flex border-b pb-1.5">
            <div className="w-[190px] shrink-0" />
            <div className="relative h-5 min-w-0 flex-1">
              {model.ticks.map((tick) => (
                <span
                  key={tick.toISOString()}
                  className="text-faint absolute top-0 text-[11px] font-semibold whitespace-nowrap"
                  style={{ left: tick < model.min ? '0%' : model.pos(tick) }}
                >
                  {tick.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            {/* month gridlines and today, behind the rows */}
            <div className="pointer-events-none absolute inset-y-0 right-0 left-[190px]">
              {model.ticks
                .filter((t) => t >= model.min)
                .map((tick) => (
                  <span
                    key={tick.toISOString()}
                    className="bg-divider absolute inset-y-0 w-px"
                    style={{ left: model.pos(tick) }}
                  />
                ))}
              {model.todayVisible && (
                <span
                  data-testid="timeline-today"
                  className="bg-danger absolute inset-y-0 w-0.5"
                  style={{ left: model.pos(model.today) }}
                  title="Today"
                />
              )}
            </div>

            <Row label={project.name} sub={`${formatDate(project.startDate)} → ${formatDate(project.endDate)}`}>
              {projectStart && projectEnd && (
                <span
                  data-testid="timeline-project"
                  className="bg-lavender absolute top-[10px] h-4 rounded-full opacity-80"
                  style={{ left: model.pos(projectStart), width: model.width(projectStart, projectEnd) }}
                  title={`Project: ${formatDate(project.startDate)} to ${formatDate(project.endDate)}`}
                />
              )}
            </Row>

            {sortedMilestones.map((m) => {
              const due = parse(m.dueDate)
              return (
                <Row key={`m${m.id}`} label={m.title} sub={`Milestone · ${formatDate(m.dueDate)}`}>
                  {due && (
                    <button
                      type="button"
                      data-testid="timeline-milestone"
                      aria-label={`Milestone ${m.title}, ${formatDate(m.dueDate)}, ${humanizeEnum(m.status)}`}
                      onClick={() => setSelectedMilestone(m.id === selectedMilestone ? null : m.id)}
                      className={`absolute top-[9px] -ml-2 flex h-[18px] w-[18px] rotate-45 items-center justify-center rounded-[3px] ${
                        m.status === 'COMPLETED' ? 'bg-success' : 'bg-charcoal'
                      }`}
                      style={{ left: model.pos(due) }}
                    />
                  )}
                </Row>
              )
            })}

            {sortedTasks.map((t) => {
              const start = parse(t.startDate)
              const due = parse(t.dueDate)
              return (
                <Row key={`t${t.id}`} label={t.title} sub={`${formatDate(t.startDate)} → ${formatDate(t.dueDate)}`}>
                  {start && due && (
                    <button
                      type="button"
                      data-testid="timeline-task"
                      aria-label={`Task ${t.title}, ${formatDate(t.startDate)} to ${formatDate(t.dueDate)}, ${humanizeEnum(t.status)}${t.overdue ? ', overdue' : ''}`}
                      onClick={() => onOpenTask?.(t.id)}
                      className={`absolute top-[11px] h-3.5 overflow-hidden rounded-full ${STATUS_BAR[t.status] ?? 'bg-faint'} ${
                        t.overdue ? 'ring-danger ring-2' : ''
                      } ${t.status === 'CANCELLED' ? 'opacity-50' : ''}`}
                      style={{ left: model.pos(start), width: model.width(start, due) }}
                      title={`${t.title} · ${humanizeEnum(t.status)} · ${Math.round(Number(t.progress ?? 0))}%`}
                    >
                      <span
                        className="absolute inset-y-0 left-0 bg-black/25"
                        style={{ width: `${Math.min(Math.max(Number(t.progress ?? 0), 0), 100)}%` }}
                      />
                    </button>
                  )}
                </Row>
              )
            })}
          </div>
        </div>
      </div>

      <div className="text-muted mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-lavender h-2.5 w-4 rounded-full opacity-80" /> Project
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-charcoal h-2.5 w-2.5 rotate-45 rounded-[2px]" /> Milestone
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-faint h-2.5 w-4 rounded-full" /> To Do
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-info h-2.5 w-4 rounded-full" /> In Progress
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-warning h-2.5 w-4 rounded-full" /> In Review
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-success h-2.5 w-4 rounded-full" /> Completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="ring-danger h-2.5 w-4 rounded-full bg-transparent ring-2" /> Overdue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-danger h-3 w-0.5" /> Today
        </span>
      </div>

      {tasks.length === 0 && milestones.length === 0 && (
        <p className="text-faint mt-3 text-[12px]">No tasks or milestones to draw yet.</p>
      )}

      {chosen && (
        <div className="bg-subtle mt-4 rounded-md px-4 py-3" data-testid="timeline-milestone-detail">
          <div className="mb-1.5 flex items-center gap-2">
            <Flag size={14} className="text-faint" />
            <span className="text-ink text-[13px] font-[650]">{chosen.title}</span>
            <Badge tone={chosen.status}>{humanizeEnum(chosen.status)}</Badge>
          </div>
          {chosen.description && <p className="text-muted mb-2 text-[12px]">{chosen.description}</p>}
          <div className="flex items-center gap-3 text-[12px]">
            <span className="text-muted">Due {formatDate(chosen.dueDate)}</span>
            <span className="max-w-[160px] flex-1">
              <ProgressBar percent={Number(chosen.progress ?? 0)} height={5} />
            </span>
            <span className="text-faint">{Math.round(Number(chosen.progress ?? 0))}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
