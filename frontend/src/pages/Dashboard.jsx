import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, CalendarDays, Circle, CheckCircle2 } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TopBar } from '../layout/TopBar'
import { ProjectCard } from '../components/ProjectCard'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { DonutChart } from '../components/ui/DonutChart'
import { useAuth } from '../auth/AuthContext'
import { useMembers } from '../data/UsersContext'
import { useApi } from '../api/useApi'
import { getProjects } from '../api/projects'
import { getProjectMembers } from '../api/projectMembers'
import { getTasks, toggleTaskCompletion } from '../api/tasks'
import { getTaskAssignees } from '../api/taskAssignees'
import { buildProjectMemberMap, buildTaskAssigneeMap, toProjectCard } from '../api/relations'
import { computeTaskOverview, computeWeeklyTaskStats, groupTasksByStatus } from '../api/stats'
import { formatDate, humanizeEnum } from '../api/format'

const OPEN_STATUSES = new Set(['TO_DO', 'IN_PROGRESS', 'IN_REVIEW'])

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="chart-tooltip__row">
          <span className="chart-tooltip__dot" style={{ background: p.stroke }} />
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export function Dashboard() {
  const { profile, username } = useAuth()
  const { getMember } = useMembers()
  const { data: projects, loading: projectsLoading } = useApi(getProjects)
  const { data: projectMembers } = useApi(getProjectMembers)
  const { data: tasks, loading: tasksLoading, refetch: refetchTasks } = useApi(getTasks)
  const { data: taskAssignees } = useApi(getTaskAssignees)

  const assigneeMap = useMemo(() => buildTaskAssigneeMap(taskAssignees), [taskAssignees])
  const projectMemberMap = useMemo(() => buildProjectMemberMap(projectMembers), [projectMembers])
  const taskOverview = useMemo(() => computeTaskOverview(tasks), [tasks])
  const weeklyReport = useMemo(() => computeWeeklyTaskStats(tasks), [tasks])
  const kanbanColumns = useMemo(() => groupTasksByStatus(tasks), [tasks])
  const todayLabel = weeklyReport[weeklyReport.length - 1]?.day

  const topProjects = useMemo(() => {
    return [...(projects ?? [])]
      .sort((a, b) => new Date(a.endDate ?? 0) - new Date(b.endDate ?? 0))
      .slice(0, 2)
      .map((p) => toProjectCard(p, projectMemberMap.get(p.id) ?? []))
  }, [projects, projectMemberMap])

  const upcomingTasks = useMemo(() => {
    return (tasks ?? [])
      .filter((t) => OPEN_STATUSES.has(t.status) && t.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5)
  }, [tasks])

  const workDistribution = useMemo(() => {
    const total = tasks?.length ?? 0
    const completed = (tasks ?? []).filter((t) => t.status === 'COMPLETED').length
    return {
      completedPercent: total ? Math.round((completed / total) * 100) : 0,
      tasks: total,
      projectsCount: projects?.length ?? 0,
      completed,
    }
  }, [tasks, projects])

  const firstName = (profile?.fullName || username || '').split(' ')[0] || ''

  const handleToggle = async (task) => {
    await toggleTaskCompletion(task)
    refetchTasks()
  }

  return (
    <div>
      <TopBar title={`Hello, ${firstName}`} subtitle="Welcome back!" />

      {/* Hero */}
      <section className="bg-card rounded-hero mb-6 flex min-h-[148px] items-center justify-between gap-6 overflow-hidden px-10 py-[30px] max-sm:flex-col max-sm:items-start max-sm:p-6">
        <div>
          <h2 className="mb-2 max-w-[380px] text-2xl font-bold tracking-[-0.015em]">
            Stay on top of your work
          </h2>
          <p className="mb-[18px] max-w-[360px] text-[13.5px] leading-[1.55] text-[#4a4e5c]">
            Track your tasks, manage projects, and keep your team moving forward.
          </p>
          <Link to="/tasks" className="btn btn-primary px-5 py-[11px]">
            View Tasks <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="flex shrink-0 max-sm:self-center" aria-hidden="true">
          <svg width="180" height="130" viewBox="0 0 180 130" fill="none">
            <rect x="18" y="14" width="96" height="100" rx="16" fill="#ffffffb3" />
            <rect x="34" y="34" width="64" height="8" rx="4" fill="#242426" opacity="0.55" />
            <rect x="34" y="52" width="46" height="8" rx="4" fill="#242426" opacity="0.3" />
            <circle cx="41" cy="80" r="7" fill="#78A88A" />
            <rect x="54" y="76" width="40" height="8" rx="4" fill="#242426" opacity="0.2" />
            <rect x="86" y="0" width="76" height="76" rx="18" fill="#ffffffcc" />
            <path d="M104 40l10 10 20-22" stroke="#242426" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
          </svg>
        </div>
      </section>

      <div className="grid grid-cols-[1fr_380px] items-start gap-6 max-[1200px]:grid-cols-1">
        {/* LEFT COLUMN */}
        <div className="flex min-w-0 flex-col gap-6">
          <section className="card px-6 py-[22px]">
            <div className="mb-[18px] flex items-center justify-between">
              <h3 className="section-title">Task Overview</h3>
              <span className="text-faint text-[12.5px] font-medium">{tasks?.length ?? 0} tasks</span>
            </div>
            <div className="flex flex-col">
              {!tasksLoading &&
                taskOverview.map((t) => (
                  <div
                    key={t.key}
                    className="border-divider flex items-center gap-3.5 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
                        <circle className="stroke-divider fill-none" cx="20" cy="20" r="16" strokeWidth="5" />
                        <circle
                          className="ease-[var(--ease-standard)] fill-none transition-[stroke-dashoffset] duration-700 [stroke-linecap:round]"
                          cx="20"
                          cy="20"
                          r="16"
                          strokeWidth="5"
                          stroke={t.color}
                          strokeDasharray={2 * Math.PI * 16}
                          strokeDashoffset={2 * Math.PI * 16 * (1 - t.percent / 100)}
                        />
                      </svg>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-ink text-[13.5px] font-semibold">{t.label}</span>
                      <span className="text-faint mt-0.5 text-[11.5px]">{t.percent}% of total</span>
                    </div>
                    <span className="text-ink text-[17px] font-bold">{t.count}</span>
                  </div>
                ))}
            </div>
          </section>

          <section className="card px-6 py-[22px]">
            <div className="mb-[18px] flex items-center justify-between">
              <h3 className="section-title">Projects</h3>
              <Link to="/projects" className="text-muted hover:text-ink duration-[var(--duration-fast)] ease-[var(--ease-standard)] text-[12.5px] font-semibold transition-colors">
                View all
              </Link>
            </div>
            <div className="flex flex-col gap-4">
              {!projectsLoading && topProjects.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          </section>

          <section className="card px-6 py-[22px]">
            <div className="mb-[18px] flex items-center justify-between">
              <h3 className="section-title">Upcoming Tasks</h3>
              <Link to="/tasks" className="text-muted hover:text-ink duration-[var(--duration-fast)] ease-[var(--ease-standard)] text-[12.5px] font-semibold transition-colors">
                View all
              </Link>
            </div>
            <div className="flex flex-col">
              {!tasksLoading && upcomingTasks.length === 0 && (
                <p className="text-faint py-3 text-[12.5px]">Nothing due soon.</p>
              )}
              {upcomingTasks.map((t) => {
                const assigneeId = assigneeMap.get(t.id)?.[0]
                const member = getMember(assigneeId)
                const isChecked = t.status === 'COMPLETED'
                return (
                  <div
                    key={t.id}
                    className={`border-divider duration-[var(--duration-med)] ease-[var(--ease-standard)] flex items-center gap-3.5 border-b py-3 transition-opacity first:pt-0 last:border-b-0 last:pb-0 ${
                      isChecked ? 'opacity-45' : ''
                    }`}
                  >
                    <button
                      className="text-faint duration-[var(--duration-fast)] ease-[var(--ease-standard)] inline-flex border-none bg-none p-0 transition-colors hover:scale-[1.08] hover:text-charcoal"
                      onClick={() => handleToggle(t)}
                      aria-label="toggle task"
                    >
                      {isChecked ? (
                        <CheckCircle2 size={19} className="text-success" />
                      ) : (
                        <Circle size={19} />
                      )}
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={`text-ink truncate text-[13.5px] font-semibold ${isChecked ? 'line-through' : ''}`}
                      >
                        {t.title}
                      </span>
                      <span className="text-faint text-xs">{t.project?.name}</span>
                    </div>
                    <Badge tone={t.priority}>{humanizeEnum(t.priority)}</Badge>
                    <span className="text-muted hidden items-center gap-1.5 text-xs whitespace-nowrap min-[900px]:inline-flex">
                      <CalendarDays size={13} /> {formatDate(t.dueDate)}
                    </span>
                    {member && <Avatar initials={member.initials} color={member.color} size={28} title={member.name} />}
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex min-w-0 flex-col gap-6">
          <section className="card px-6 py-[22px]">
            <div className="mb-[18px] flex items-center justify-between">
              <h3 className="section-title">Reports</h3>
              <button className="dash-dropdown">
                This Week <ChevronDown size={14} />
              </button>
            </div>
            <div className="-mx-1.5">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={weeklyReport} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border-divider)" />
                  <XAxis dataKey="day" hide />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-light)' }} />
                  <Line type="monotone" dataKey="completed" name="Completed" stroke="var(--color-charcoal)" strokeWidth={2} dot={{ r: 3, fill: 'var(--color-charcoal)', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="created" name="Created" stroke="var(--accent-lavender)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent-lavender)', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="overdue" name="Overdue" stroke="var(--status-danger)" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between px-0.5 pt-1">
              {weeklyReport.map((d) => (
                <span
                  key={d.date.toISOString()}
                  className={`rounded-full px-[9px] py-[5px] text-[11px] font-medium ${
                    d.day === todayLabel ? 'bg-charcoal font-[650] text-white' : 'text-faint'
                  }`}
                >
                  {d.day}
                </span>
              ))}
            </div>
            <div className="border-divider mt-4 flex gap-4 border-t pt-3.5">
              <span className="text-muted inline-flex items-center gap-1.5 text-[11.5px]">
                <i className="bg-charcoal h-2 w-2 rounded-full" /> Completed
              </span>
              <span className="text-muted inline-flex items-center gap-1.5 text-[11.5px]">
                <i className="bg-lavender h-2 w-2 rounded-full" /> Created
              </span>
              <span className="text-muted inline-flex items-center gap-1.5 text-[11.5px]">
                <i className="bg-danger h-2 w-2 rounded-full" /> Overdue
              </span>
            </div>
          </section>

          <section className="card px-6 py-[22px]">
            <div className="mb-[18px] flex items-center justify-between">
              <h3 className="section-title">Work Distribution</h3>
            </div>
            <div className="flex justify-center px-0 pt-2 pb-1">
              <DonutChart
                percent={workDistribution.completedPercent}
                size={160}
                thickness={16}
                fillColor="var(--color-charcoal)"
                trackColor="var(--accent-blue-gray)"
                centerLabel={`${workDistribution.completedPercent}%`}
                centerSub="Completed"
              />
            </div>
            <div className="border-divider mt-4 flex flex-col gap-3 border-t pt-4">
              <div className="flex items-center gap-2.5 text-[13px]">
                <span className="bg-charcoal h-2 w-2 shrink-0 rounded-full" />
                <span className="text-muted flex-1">Tasks</span>
                <span className="text-ink font-[650]">{workDistribution.tasks}</span>
              </div>
              <div className="flex items-center gap-2.5 text-[13px]">
                <span className="bg-lavender h-2 w-2 shrink-0 rounded-full" />
                <span className="text-muted flex-1">Projects</span>
                <span className="text-ink font-[650]">
                  {String(workDistribution.projectsCount).padStart(2, '0')}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-[13px]">
                <span className="bg-success h-2 w-2 shrink-0 rounded-full" />
                <span className="text-muted flex-1">Completed</span>
                <span className="text-ink font-[650]">{workDistribution.completed}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* KANBAN PREVIEW */}
      <section className="mt-6 px-6 py-[22px]">
        <div className="mb-[18px] flex items-center justify-between">
          <h3 className="section-title">Kanban Board</h3>
          <Link to="/kanban" className="text-muted hover:text-ink duration-[var(--duration-fast)] ease-[var(--ease-standard)] text-[12.5px] font-semibold transition-colors">
            Open board
          </Link>
        </div>
        <div className="scroll-x flex gap-4 pb-1">
          {kanbanColumns.map((col) => (
            <div
              key={col.id}
              className="bg-subtle flex w-60 shrink-0 flex-col gap-2.5 rounded-md p-3.5"
            >
              <div className="text-ink flex items-center justify-between px-0.5 pb-1 text-[12.5px] font-[650]">
                <span>{col.title}</span>
                <span className="text-faint bg-card rounded-full px-[7px] text-[11px]">
                  {col.tasks.length}
                </span>
              </div>
              {col.tasks.slice(0, 2).map((task) => {
                const assigneeId = assigneeMap.get(task.id)?.[0]
                const member = getMember(assigneeId)
                return (
                  <div
                    key={task.id}
                    className="bg-card border-border shadow-card hover:shadow-card-hover duration-[var(--duration-med)] ease-[var(--ease-standard)] rounded-xl border p-3 transition hover:-translate-y-px"
                  >
                    <span className="text-faint text-[10.5px] font-[650] tracking-[0.04em] uppercase">
                      {task.project?.name}
                    </span>
                    <p className="text-ink my-2 text-[13px] leading-normal font-semibold">{task.title}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-muted text-[11px]">{formatDate(task.dueDate)}</span>
                      {member && <Avatar initials={member.initials} color={member.color} size={22} />}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
