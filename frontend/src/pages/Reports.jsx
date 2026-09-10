import { useMemo, useState } from 'react'
import { ChevronDown, SlidersHorizontal, Check } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { TopBar } from '../layout/TopBar'
import { StatCard } from '../components/StatCard'
import { Skeleton } from '../components/ui/Skeleton'
import { Dropdown } from '../components/ui/Dropdown'
import { useMembers } from '../data/UsersContext'
import { useApi } from '../api/useApi'
import { getProjects } from '../api/projects'
import { getTasks } from '../api/tasks'
import { getTaskAssignees } from '../api/taskAssignees'
import { buildTaskAssigneeMap, countByValue, filterTasksByProject } from '../api/relations'
import { computePeriodTaskStats, PERIOD_OPTIONS } from '../api/stats'

const barColors = ['#242426', '#66676B', '#AEB9D2', '#B9B0C8', '#7E9FC4', '#D2A85A']

function ChartCard({ title, loading, children }) {
  return (
    <section className="card px-5 pt-5 pb-3">
      <h3 className="section-title mb-3">{title}</h3>
      {loading ? <Skeleton className="h-[220px] rounded-md" /> : children}
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

export function Reports() {
  const { members } = useMembers()
  const { data: projects, loading: projectsLoading } = useApi(getProjects)
  const { data: tasks, loading: tasksLoading } = useApi(getTasks)
  const { data: taskAssignees } = useApi(getTaskAssignees)
  const loading = projectsLoading || tasksLoading
  const [period, setPeriod] = useState(PERIOD_OPTIONS[0])
  const [projectFilter, setProjectFilter] = useState('')

  const scopedTasks = useMemo(() => filterTasksByProject(tasks, projectFilter), [tasks, projectFilter])
  const scopedProjects = useMemo(
    () => (projectFilter ? (projects ?? []).filter((p) => String(p.id) === projectFilter) : projects ?? []),
    [projects, projectFilter]
  )
  const scopedTaskAssignees = useMemo(
    () =>
      projectFilter
        ? (taskAssignees ?? []).filter((ta) => String(ta.task?.project?.id) === projectFilter)
        : taskAssignees,
    [taskAssignees, projectFilter]
  )

  const periodReport = useMemo(() => computePeriodTaskStats(scopedTasks, period.days), [scopedTasks, period])
  const assigneeMap = useMemo(() => buildTaskAssigneeMap(scopedTaskAssignees), [scopedTaskAssignees])
  const taskCountByUser = useMemo(() => countByValue(assigneeMap.values()), [assigneeMap])

  const statCards = useMemo(() => {
    const list = scopedTasks
    const total = list.length
    const inProgress = list.filter((t) => t.status === 'IN_PROGRESS').length
    const completed = list.filter((t) => t.status === 'COMPLETED').length
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const overdue = list.filter(
      (t) => t.dueDate && new Date(t.dueDate) < today && t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
    ).length
    return [
      { key: 'total', label: 'Total Tasks', value: total, tone: 'neutral' },
      { key: 'progress', label: 'In Progress', value: inProgress, tone: 'info' },
      { key: 'completed', label: 'Completed', value: completed, tone: 'success' },
      { key: 'overdue', label: 'Overdue', value: overdue, tone: 'danger' },
    ]
  }, [scopedTasks])

  const projectProgress = useMemo(
    () => scopedProjects.map((p) => ({ name: p.name, progress: Math.round(Number(p.progress ?? 0)) })),
    [scopedProjects]
  )

  const completedCountByUser = useMemo(() => {
    const counts = new Map()
    for (const t of scopedTasks) {
      if (t.status !== 'COMPLETED') continue
      for (const id of assigneeMap.get(t.id) ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, [scopedTasks, assigneeMap])

  const productivityByMember = useMemo(
    () =>
      members
        .map((m) => ({ name: m.name?.split(' ')[0], completed: completedCountByUser.get(m.id) ?? 0 }))
        .filter((m) => m.completed > 0),
    [members, completedCountByUser]
  )

  const workloadByMember = useMemo(
    () =>
      members
        .map((m) => ({ name: m.name?.split(' ')[0], tasks: taskCountByUser.get(m.id) ?? 0 }))
        .filter((m) => m.tasks > 0),
    [members, taskCountByUser]
  )

  return (
    <div>
      <TopBar
        title="Reports"
        subtitle="Insights across tasks, projects, and team performance"
        actions={
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
                  <span className="text-faint mb-1 block px-2 text-[11px] font-[650] tracking-[0.04em] uppercase">
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
                <button className="dash-dropdown" onClick={toggle}>
                  {period.label} <ChevronDown size={14} />
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
        }
      />

      <div className="mb-6 grid grid-cols-4 gap-[18px] max-[1100px]:grid-cols-2 max-[520px]:grid-cols-1">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[86px] rounded-card" />)}
        {!loading && statCards.map((s) => <StatCard key={s.key} label={s.label} value={s.value} tone={s.tone} />)}
      </div>

      <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        <ChartCard title={`Task Completion — ${period.label}`} loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={periodReport} margin={{ top: 6, right: 8, left: -6, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-divider)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} padding={{ left: 12 }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={26} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-light)' }} />
              <Line type="monotone" dataKey="completed" name="Completed" stroke="var(--color-charcoal)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="created" name="Created" stroke="var(--accent-lavender)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Project Progress" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={projectProgress} layout="vertical" margin={{ top: 6, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--border-divider)" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11.5, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-secondary)' }} />
              <Bar dataKey="progress" name="Progress %" radius={[0, 6, 6, 0]} barSize={16}>
                {projectProgress.map((_, i) => (
                  <Cell key={i} fill="var(--color-charcoal)" fillOpacity={1 - i * 0.12} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Team Productivity" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={productivityByMember} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-divider)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={26} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-secondary)' }} />
              <Bar dataKey="completed" name="Tasks Completed" radius={[6, 6, 0, 0]} barSize={26} fill="var(--color-dark-gray)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Workload" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={workloadByMember} layout="vertical" margin={{ top: 6, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--border-divider)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11.5, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-secondary)' }} />
              <Bar dataKey="tasks" name="Assigned Tasks" radius={[0, 6, 6, 0]} barSize={16}>
                {workloadByMember.map((_, i) => (
                  <Cell key={i} fill={barColors[i % barColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
