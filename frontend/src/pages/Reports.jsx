import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, SlidersHorizontal, Check, BarChart3 } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { TopBar } from '../layout/TopBar'
import { StatCard } from '../components/StatCard'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { Dropdown } from '../components/ui/Dropdown'
import { useAuth } from '../auth/AuthContext'
import { useMembers } from '../data/UsersContext'
import { useApi } from '../api/useApi'
import { getProjects } from '../api/projects'
import { getTaskSummary } from '../api/tasks'
import { getTaskActivity } from '../api/dashboard'
import { getManagedWorkload, getProjectWorkload } from '../api/teamViews'
import { activityToPeriodPoints, PERIOD_OPTIONS } from '../api/stats'
import { humanizeEnum } from '../api/format'
import {
  KpiView,
  ProjectReportView,
  TaskReportView,
  ProjectStatusReportView,
  TaskCompletionReportView,
  OverdueReportView,
  TeamPerformanceReportView,
  WorkloadReportView,
} from '../components/reports/ReportViews'

function ChartCard({ title, loading, empty, className = '', children }) {
  return (
    <section className={`card min-w-0 px-6 py-[22px] ${className}`}>
      <h3 className="section-title mb-[18px]">{title}</h3>
      {loading ? (
        <Skeleton className="h-[220px] rounded-md" />
      ) : empty ? (
        <div className="flex h-[220px] items-center justify-center">
          <EmptyState icon={BarChart3} title="No data yet" />
        </div>
      ) : (
        children
      )}
    </section>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="chart-tooltip__row">
          <span className="chart-tooltip__dot" style={{ background: p.fill || p.stroke }} />
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// Workload chart tooltip: the three counts plus the hours and the load level the table shows.
function WorkloadTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const m = payload[0].payload
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{m.fullName}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="chart-tooltip__row">
          <span className="chart-tooltip__dot" style={{ background: p.fill }} />
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
      <p className="chart-tooltip__row">
        Estimated: <strong>{m.estimatedHours} h</strong> · Actual: <strong>{m.actualHours} h</strong>
      </p>
      <p className="chart-tooltip__row">Load: <strong>{humanizeEnum(m.level)}</strong></p>
    </div>
  )
}

function ReportsOverview({ tabs }) {
  const { can, canAny } = useAuth()
  const { members } = useMembers()
  const { data: projects, loading: projectsLoading } = useApi(getProjects)
  const [period, setPeriod] = useState(PERIOD_OPTIONS[0])
  const [projectFilter, setProjectFilter] = useState('')

  // The task figures come from the server for the chosen project (or for every project the caller may
  // see): the counts and the tasks each person has completed from the task summary, the daily chart
  // from the activity endpoint. The page no longer reads every task or every assignment.
  const summaryFetcher = useCallback(() => getTaskSummary({ projectId: projectFilter }), [projectFilter])
  const { data: summary, loading: summaryLoading } = useApi(summaryFetcher)
  const activityFetcher = useCallback(() => getTaskActivity(period.days, { projectId: projectFilter }), [period, projectFilter])
  const { data: activity, loading: activityLoading } = useApi(activityFetcher)
  const loading = projectsLoading || summaryLoading || activityLoading

  const scopedProjects = useMemo(
    () => (projectFilter ? (projects ?? []).filter((p) => String(p.id) === projectFilter) : projects ?? []),
    [projects, projectFilter]
  )

  const periodReport = useMemo(() => activityToPeriodPoints(activity, period.days), [activity, period])

  // Team workload comes from the server (assigned, active and overdue tasks, estimated and
  // actual hours, D-13), the same figures as the Workload page and the dashboard card. Only
  // people who may assign tasks (in the chosen project, or anywhere) are allowed to ask.
  const showWorkload = projectFilter ? can('TASK', 'ASSIGN', Number(projectFilter)) : canAny('TASK', 'ASSIGN')
  const workloadFetcher = useCallback(() => {
    if (!showWorkload) return Promise.resolve(null)
    return projectFilter ? getProjectWorkload(projectFilter) : getManagedWorkload()
  }, [showWorkload, projectFilter])
  const { data: workload, loading: workloadLoading } = useApi(workloadFetcher)

  const statCards = useMemo(() => {
    const counts = summary?.viewCounts ?? {}
    return [
      { key: 'total', label: 'Total Tasks', value: counts.all ?? 0, tone: 'neutral' },
      { key: 'progress', label: 'In Progress', value: counts.inprogress ?? 0, tone: 'info' },
      { key: 'completed', label: 'Completed', value: counts.completed ?? 0, tone: 'success' },
      { key: 'overdue', label: 'Overdue', value: counts.overdue ?? 0, tone: 'danger' },
    ]
  }, [summary])

  const projectProgress = useMemo(
    () => scopedProjects.map((p) => ({ name: p.name, progress: Math.round(Number(p.progress ?? 0)) })),
    [scopedProjects]
  )

  const productivityByMember = useMemo(
    () =>
      members
        .map((m) => ({ name: m.name?.split(' ')[0], completed: summary?.completedByAssignee?.[m.id] ?? 0 }))
        .filter((m) => m.completed > 0),
    [members, summary]
  )

  const workloadByMember = useMemo(
    () =>
      (workload?.members ?? []).map((m) => ({
        name: m.user.fullName?.split(' ')[0],
        fullName: m.user.fullName,
        assigned: m.assigned,
        active: m.active,
        overdue: m.overdue,
        estimatedHours: Number(m.estimatedHours ?? 0),
        actualHours: Number(m.actualHours ?? 0),
        level: m.level,
      })),
    [workload]
  )

  return (
    <div>
      <TopBar title={REPORTS_TITLE} subtitle={REPORTS_SUBTITLE} actions={
        <>
            <Dropdown
              button={({ toggle }) => (
                <button className="btn btn-secondary" onClick={toggle}>
                  <SlidersHorizontal size={15} /> {projectFilter ? scopedProjects[0]?.name : 'Filter'}
                </button>
              )}
            >
              {({ close }) => (
                <div className="flex w-[200px] flex-col gap-0.5 p-1">
                  <span className="text-faint mb-1 block px-2 text-[12px] font-[650] tracking-[0.04em] uppercase">
                    Project
                  </span>
                  <button
                    type="button"
                    className={`hover:bg-subtle flex items-center justify-between rounded-sm px-2 py-1.5 text-left text-[13px] ${!projectFilter ? 'text-ink font-semibold' : 'text-muted'}`}
                    onClick={() => {
                      setProjectFilter('')
                      close()
                    }}
                  >
                    All projects
                    {!projectFilter && <Check size={14} />}
                  </button>
                  {(projects ?? []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`hover:bg-subtle flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] ${String(p.id) === projectFilter ? 'text-ink font-semibold' : 'text-muted'}`}
                      onClick={() => {
                        setProjectFilter(String(p.id))
                        close()
                      }}
                    >
                      <span className="truncate">{p.name}</span>
                      {String(p.id) === projectFilter && <Check size={14} className="shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </Dropdown>

            <Dropdown
              button={({ toggle }) => (
                <button className="btn btn-secondary" onClick={toggle}>
                  {period.label} <ChevronDown size={15} />
                </button>
              )}
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
          </>
      } />
      {tabs}

      <div className="mb-6 grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-card" />)}
        {!loading && statCards.map((s) => <StatCard key={s.key} label={s.label} value={s.value} tone={s.tone} />)}
      </div>

      {/* Two independent columns, as on the dashboard, so a short chart never sits beside a tall one with a hole
          under it. Below 900px they become one column in reading order (set with `order`). */}
      <div className="grid grid-cols-2 items-start gap-6 max-[900px]:grid-cols-1">
        <div className="contents min-[901px]:flex min-[901px]:min-w-0 min-[901px]:flex-col min-[901px]:gap-6">
          <ChartCard title={`Task Completion — ${period.label}`} loading={loading} className="order-1 min-[901px]:order-none">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={periodReport} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border-divider)" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} padding={{ left: 12 }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-light)' }} />
                <Line type="monotone" dataKey="completed" name="Completed" stroke="var(--color-charcoal)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="created" name="Created" stroke="var(--accent-lavender)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Team Productivity" loading={loading} empty={productivityByMember.length === 0} className="order-3 min-[901px]:order-none">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={productivityByMember} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border-divider)" />
                <XAxis dataKey="name" interval={0} tickFormatter={(n) => (n.length > 6 ? `${n.slice(0, 5)}…` : n)} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-secondary)' }} />
                <Bar dataKey="completed" name="Tasks Completed" radius={[6, 6, 0, 0]} barSize={26} fill="var(--color-charcoal)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <div className="contents min-[901px]:flex min-[901px]:min-w-0 min-[901px]:flex-col min-[901px]:gap-6">
          <ChartCard title="Project Progress" loading={loading} className="order-2 min-[901px]:order-none">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={projectProgress} layout="vertical" margin={{ top: 6, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="var(--border-divider)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-secondary)' }} />
                <Bar dataKey="progress" name="Progress %" radius={[0, 6, 6, 0]} barSize={16}>
                  {projectProgress.map((_, i) => (
                    <Cell key={i} fill="var(--color-charcoal)" fillOpacity={1 - i * 0.12} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {showWorkload && (
            <ChartCard title="Workload" loading={workloadLoading} empty={workloadByMember.length === 0} className="order-4 min-[901px]:order-none">
              <div data-testid="workload-chart">
                <ResponsiveContainer width="100%" height={Math.max(220, workloadByMember.length * 44)}>
                  <BarChart data={workloadByMember} layout="vertical" margin={{ top: 6, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke="var(--border-divider)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<WorkloadTooltip />} cursor={{ fill: 'var(--bg-secondary)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="assigned" name="Assigned" fill="var(--color-charcoal)" radius={[0, 6, 6, 0]} barSize={8} />
                    <Bar dataKey="active" name="Active" fill="var(--color-info-ink)" radius={[0, 6, 6, 0]} barSize={8} />
                    <Bar dataKey="overdue" name="Overdue" fill="var(--color-danger-ink)" radius={[0, 6, 6, 0]} barSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}
        </div>
      </div>
    </div>
  )
}

// Overview = the quick charts; the KPIs and the seven named reports are calculated on
// the server (assignment-brief.md B8) and only the people allowed to generate reports
// can reach this page at all.
const TABS = [
  { key: 'overview', label: 'Overview', view: ReportsOverview },
  { key: 'kpis', label: 'KPIs', view: KpiView },
  { key: 'project', label: 'Project Report', view: ProjectReportView },
  { key: 'tasks', label: 'Task Report', view: TaskReportView },
  { key: 'project-status', label: 'Project Status', view: ProjectStatusReportView },
  { key: 'task-completion', label: 'Task Completion', view: TaskCompletionReportView },
  { key: 'overdue', label: 'Overdue Tasks', view: OverdueReportView },
  { key: 'team-performance', label: 'Team Performance', view: TeamPerformanceReportView },
  { key: 'workload', label: 'Workload', view: WorkloadReportView },
]

const REPORTS_TITLE = 'Reports'
const REPORTS_SUBTITLE = 'Insights across tasks, projects, and team performance'

export function Reports() {
  const [params, setParams] = useSearchParams()
  const active = TABS.find((t) => t.key === params.get('tab')) ?? TABS[0]
  const View = active.view

  // Same pills as the Tasks quick views (card fill and border, the charcoal fill for the selected one),
  // in one row that scrolls sideways on a phone instead of wrapping into four rows.
  const tabs = (
    <div
      className="-mx-1 mb-6 flex gap-1.5 overflow-x-auto px-1 pb-0.5"
      role="tablist"
      aria-label="Reports"
    >
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === active.key}
          onClick={() => setParams(t.key === TABS[0].key ? {} : { tab: t.key })}
          className={`duration-[var(--duration-fast)] ease-[var(--ease-standard)] inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
            t.key === active.key ? 'bg-charcoal text-on-charcoal border-transparent' : 'bg-card border-border text-muted hover:bg-subtle'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )

  // The Overview keeps its Filter and period controls in the top bar (like Tasks, Projects and Kanban), so it
  // draws the bar itself and receives the tab strip; every other tab uses the plain bar.
  if (active.key === 'overview') return <View tabs={tabs} />
  return (
    <div>
      <TopBar title={REPORTS_TITLE} subtitle={REPORTS_SUBTITLE} />
      {tabs}
      <View />
    </div>
  )
}
