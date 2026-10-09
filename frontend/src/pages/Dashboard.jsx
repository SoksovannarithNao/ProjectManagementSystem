import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Check, AlertTriangle, Circle, CheckCircle2, History, Clock } from 'lucide-react'
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
import { StatCard } from '../components/StatCard'
import { WorkloadTable } from '../components/WorkloadTable'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { Dropdown } from '../components/ui/Dropdown'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthContext'
import { useMembers } from '../data/UsersContext'
import { useApi } from '../api/useApi'
import { getProjects } from '../api/projects'
import { getProjectMembers } from '../api/projectMembers'
import { getTasks, toggleTaskCompletion } from '../api/tasks'
import { getTaskAssignees } from '../api/taskAssignees'
import { buildProjectMemberMap, buildTaskAssigneeMap, toProjectCard } from '../api/relations'
import { computeTaskOverview, computePeriodTaskStats, taskOverviewFromStats, PERIOD_OPTIONS } from '../api/stats'
import { getDashboardStats } from '../api/dashboard'
import { getRecentActivity } from '../api/activityLog'
import { getManagedWorkload } from '../api/teamViews'
import { formatDate, humanizeEnum, taskDisplayTitle, timeAgo } from '../api/format'

const OPEN_STATUSES = new Set(['TODO', 'IN_PROGRESS', 'IN_REVIEW'])

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
  const { profile, username, can, canAny } = useAuth()
  const notify = useToast()
  const { getMember } = useMembers()
  const { data: projects, loading: projectsLoading } = useApi(getProjects)
  const { data: projectMembers } = useApi(getProjectMembers)
  const { data: tasks, loading: tasksLoading, refetch: refetchTasks } = useApi(getTasks)
  const { data: taskAssignees } = useApi(getTaskAssignees)
  const [period, setPeriod] = useState(PERIOD_OPTIONS[0])
  // Project and task figures calculated on the server (B1.3, D-06), so every
  // screen shows the same numbers; the lists below still come from the resources.
  const { data: stats } = useApi(getDashboardStats)
  const recentFetcher = useCallback(() => getRecentActivity(8), [])
  const { data: recent } = useApi(recentFetcher)
  // Team workload is a manager's card: only people who may assign tasks somewhere ask for it.
  const showWorkload = canAny('TASK', 'ASSIGN')
  const workloadFetcher = useCallback(() => (showWorkload ? getManagedWorkload() : Promise.resolve(null)), [showWorkload])
  const { data: workload } = useApi(workloadFetcher)

  const assigneeMap = useMemo(() => buildTaskAssigneeMap(taskAssignees), [taskAssignees])
  const projectMemberMap = useMemo(() => buildProjectMemberMap(projectMembers), [projectMembers])
  const taskOverview = useMemo(
    () => (stats ? taskOverviewFromStats(stats.tasks) : computeTaskOverview(tasks)),
    [stats, tasks]
  )
  const periodReport = useMemo(() => computePeriodTaskStats(tasks, period.days), [tasks, period])
  const todayLabel = periodReport[periodReport.length - 1]?.day

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
      .slice(0, 7)
  }, [tasks])

  const overdueCount = stats
    ? stats.tasks.overdue
    : (tasks ?? []).filter((t) => t.overdue && OPEN_STATUSES.has(t.status)).length

  const firstName = (profile?.fullName || username || '').split(' ')[0] || ''

  const handleToggle = async (task) => {
    try {
      await toggleTaskCompletion(task)
      refetchTasks()
    } catch (err) {
      notify(err.message || 'Failed to update task', { tone: 'error' })
    }
  }

  return (
    <div>
      <TopBar title={`Hello, ${firstName}`} subtitle="Welcome back!" />

      <div className="mb-6 grid grid-cols-6 gap-4 max-[1200px]:grid-cols-3 max-[640px]:grid-cols-2" data-testid="dashboard-stats">
        {stats ? (
          <>
            <StatCard label="Total projects" value={stats.projects.total} />
            <StatCard label="Active projects" value={stats.projects.active} />
            <StatCard label="Completed projects" value={stats.projects.completed} />
            <StatCard label="Delayed projects" value={stats.projects.delayed} tone="danger" />
            <StatCard label="Average completion" value={`${Math.round(Number(stats.projects.averageProgress))}%`} />
            <StatCard label="Total tasks" value={stats.tasks.total} />
          </>
        ) : (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-card" />)
        )}
      </div>

      <div className="grid grid-cols-[1fr_380px] items-start gap-6 max-[1200px]:grid-cols-1">
        {/* Sections are direct grid items. Phones: Overview, Due, Projects, Reports (DOM order).
            Desktop: Overview | Reports on row 1, Due | Projects on row 2, so no column runs long. */}
        <div className="contents">
          <section className="card min-w-0 px-6 py-[22px] min-[1201px]:col-start-1 min-[1201px]:row-start-1">
            <div className="mb-[18px] flex items-center justify-between">
              <h3 className="section-title">Task Overview</h3>
              <span className="flex items-center gap-2 text-[12px] font-medium">
                {overdueCount > 0 && (
                  <Link to="/tasks" className="text-danger-ink inline-flex items-center gap-1 font-semibold hover:underline">
                    <AlertTriangle size={13} /> {overdueCount} overdue
                  </Link>
                )}
                <span className="text-faint">{tasks?.length ?? 0} tasks</span>
              </span>
            </div>
            <div className="flex flex-col">
              {tasksLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="border-divider flex items-center gap-3.5 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                    <Skeleton className="h-4 w-6" />
                  </div>
                ))}
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
                      <span className="text-ink text-[13px] font-semibold">{t.label}</span>
                      <span className="text-faint mt-0.5 text-[12px]">{t.percent}% of total</span>
                    </div>
                    <span className="text-ink text-[17px] font-bold">{t.count}</span>
                  </div>
                ))}
            </div>
          </section>

          <section className="card min-w-0 px-6 py-[22px] min-[1201px]:col-start-1 min-[1201px]:row-start-2">
            <div className="mb-[18px] flex items-center justify-between">
              <h3 className="section-title">Due &amp; Overdue</h3>
              <Link to="/tasks" className="text-muted hover:text-ink duration-[var(--duration-fast)] ease-[var(--ease-standard)] -my-2.5 py-2.5 text-[12px] font-semibold transition-colors">
                View all
              </Link>
            </div>
            <div className="flex flex-col">
              {tasksLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="border-divider flex items-center gap-3.5 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <Skeleton className="h-[19px] w-[19px] shrink-0 rounded-full" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              {!tasksLoading && upcomingTasks.length === 0 && (
                <p className="text-faint py-3 text-[12px]">Nothing due soon.</p>
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
                    {can('TASK', 'APPROVE', t.project?.id) ? (
                      <button
                        className="text-faint duration-[var(--duration-fast)] ease-[var(--ease-standard)] -m-2.5 inline-flex rounded-full border-none bg-none p-2.5 transition-colors hover:text-charcoal"
                        onClick={() => handleToggle(t)}
                        aria-label={isChecked ? `Mark "${t.title}" as not completed` : `Mark "${t.title}" as completed`}
                      >
                        {isChecked ? (
                          <CheckCircle2 size={19} className="text-success-ink" />
                        ) : (
                          <Circle size={19} />
                        )}
                      </button>
                    ) : (
                      // Completing a task is an approval (TASK:APPROVE). Without it the
                      // row shows state only; members move work forward from the Tasks page.
                      <span className="text-faint inline-flex" aria-hidden="true">
                        {isChecked ? <CheckCircle2 size={19} className="text-success-ink" /> : <Circle size={19} />}
                      </span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={`text-ink truncate text-[13px] font-semibold ${isChecked ? 'line-through' : ''}`}
                      >
                        {taskDisplayTitle(t.title, t.project?.name)}
                      </span>
                      <span className="text-faint flex min-w-0 items-center gap-1.5 text-xs">
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 ${
                            t.overdue && !isChecked ? 'text-danger-ink font-semibold' : ''
                          }`}
                        >
                          {t.overdue && !isChecked && <AlertTriangle size={12} />}
                          {t.overdue && !isChecked ? 'Overdue · ' : ''}
                          {formatDate(t.dueDate)}
                        </span>
                        <span className="truncate">· {t.project?.name}</span>
                      </span>
                    </div>
                    <Badge tone={t.priority}>{humanizeEnum(t.priority)}</Badge>
                    {member && <Avatar initials={member.initials} color={member.color} size={28} title={member.name} />}
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <div className="contents">
          <section className="card min-w-0 px-6 py-[22px] min-[1201px]:col-start-2 min-[1201px]:row-start-2">
            <div className="mb-[18px] flex items-center justify-between">
              <h3 className="section-title">Projects</h3>
              <Link to="/projects" className="text-muted hover:text-ink duration-[var(--duration-fast)] ease-[var(--ease-standard)] -my-2.5 py-2.5 text-[12px] font-semibold transition-colors">
                View all
              </Link>
            </div>
            <div className="flex flex-col gap-4">
              {projectsLoading &&
                Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[132px] rounded-card" />)}
              {!projectsLoading && topProjects.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          </section>

          <section className="card min-w-0 px-6 py-[22px] min-[1201px]:col-start-2 min-[1201px]:row-start-1">
            <div className="mb-[18px] flex items-center justify-between">
              <h3 className="section-title">Reports</h3>
              <Dropdown
                button={({ toggle }) => (
                  <button className="dash-dropdown" onClick={toggle}>
                    {period.label} <ChevronDown size={14} />
                  </button>
                )}
                align="right"
              >
                {({ close }) => (
                  <div className="flex flex-col gap-0.5 p-1">
                    {PERIOD_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`hover:bg-subtle flex items-center justify-between gap-4 rounded-sm px-2 py-1.5 text-left text-[13px] ${
                          period.id === opt.id ? 'text-ink font-semibold' : 'text-muted'
                        }`}
                        onClick={() => {
                          setPeriod(opt)
                          close()
                        }}
                      >
                        {opt.label}
                        {period.id === opt.id && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </Dropdown>
            </div>
            <div className="-mx-1.5">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={periodReport} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
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
              {period.days <= 7 && periodReport.map((d) => (
                <span
                  key={d.date.toISOString()}
                  className={`rounded-full px-[9px] py-[5px] text-[12px] font-medium ${
                    d.day === todayLabel ? 'bg-charcoal font-[650] text-on-charcoal' : 'text-faint'
                  }`}
                >
                  {d.day}
                </span>
              ))}
            </div>
            <div className="border-divider mt-4 flex gap-4 border-t pt-3.5">
              <span className="text-muted inline-flex items-center gap-1.5 text-[12px]">
                <i className="bg-charcoal h-2 w-2 rounded-full" /> Completed
              </span>
              <span className="text-muted inline-flex items-center gap-1.5 text-[12px]">
                <i className="bg-lavender h-2 w-2 rounded-full" /> Created
              </span>
              <span className="text-muted inline-flex items-center gap-1.5 text-[12px]">
                <i className="bg-danger h-2 w-2 rounded-full" /> Overdue
              </span>
            </div>
          </section>
        </div>

        <div className="contents">
          <section
            className="card min-w-0 px-6 py-[22px] min-[1201px]:col-start-1 min-[1201px]:row-start-3"
            data-testid="recent-activity"
          >
            <div className="mb-[18px] flex items-center justify-between">
              <h3 className="section-title">Recent activity</h3>
            </div>
            {recent && recent.length === 0 && <p className="text-faint text-[12px]">No activity yet.</p>}
            <div className="flex flex-col gap-3">
              {(recent ?? []).map((a) => (
                <div key={a.id} className="flex gap-2.5">
                  <span className="bg-subtle text-faint mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                    <History size={12} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink text-[12px] leading-snug break-words">
                      {a.taskTitle && <span className="text-muted font-semibold">{a.taskTitle} — </span>}
                      {a.description}
                    </p>
                    <span className="text-faint text-[12px]">
                      {a.userName}
                      {a.projectName ? ` · ${a.projectName}` : ''} · {timeAgo(a.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            className="card min-w-0 px-6 py-[22px] min-[1201px]:col-start-2 min-[1201px]:row-start-3"
            data-testid="delayed-projects"
          >
            <div className="mb-[18px] flex items-center justify-between">
              <h3 className="section-title">Delayed projects</h3>
              <span className="text-faint text-[12px]">{stats?.projects.delayed ?? 0}</span>
            </div>
            {stats && stats.delayedProjects.length === 0 && (
              <p className="text-faint text-[12px]">Nothing is behind schedule.</p>
            )}
            <div className="flex flex-col">
              {(stats?.delayedProjects ?? []).map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="border-divider hover:bg-subtle flex items-center gap-3 border-b py-2.5 last:border-b-0"
                >
                  <Clock size={15} className="text-danger-ink shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="text-ink block truncate text-[13px] font-semibold">{p.name}</span>
                    <span className="text-faint text-[12px]">
                      Ended {formatDate(p.endDate)} · {Math.round(Number(p.progress ?? 0))}% done
                    </span>
                  </span>
                  <span className="bg-danger-soft text-danger-ink rounded-full px-2.5 py-1 text-[12px] leading-none font-semibold whitespace-nowrap">
                    {p.daysDelayed}d late
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {showWorkload && (
            <section
              className="card min-w-0 px-6 py-[22px] min-[1201px]:col-span-2 min-[1201px]:col-start-1 min-[1201px]:row-start-4"
              data-testid="dashboard-workload"
            >
              <div className="mb-[18px] flex items-center justify-between">
                <h3 className="section-title">Team workload</h3>
                <span className="text-faint text-[12px]">across the projects you manage</span>
              </div>
              {workload ? <WorkloadTable workload={workload} compact /> : <Skeleton className="h-[120px] rounded-card" />}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
