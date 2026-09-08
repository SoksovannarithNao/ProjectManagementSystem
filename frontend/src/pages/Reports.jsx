import { ChevronDown, SlidersHorizontal } from 'lucide-react'
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
import {
  statCards,
  weeklyReport,
  projects,
  productivityByMember,
  workloadByMember,
} from '../data/mockData'

const barColors = ['#242426', '#66676B', '#AEB9D2', '#B9B0C8', '#7E9FC4', '#D2A85A']

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
  return (
    <div>
      <TopBar
        title="Reports"
        subtitle="Insights across tasks, projects, and team performance"
        actions={
          <>
            <button className="btn btn-secondary">
              <SlidersHorizontal size={15} /> Filter
            </button>
            <button className="dash-dropdown">
              This Month <ChevronDown size={14} />
            </button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-4 gap-[18px] max-[1100px]:grid-cols-2 max-[520px]:grid-cols-1">
        {statCards.map((s) => (
          <StatCard key={s.key} label={s.label} value={s.value} delta={s.delta} tone={s.tone} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        <section className="card px-5 pt-5 pb-3">
          <h3 className="section-title mb-3">Task Completion</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyReport} margin={{ top: 6, right: 8, left: -6, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-divider)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} padding={{ left: 12 }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={26} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-light)' }} />
              <Line type="monotone" dataKey="completed" name="Completed" stroke="var(--color-charcoal)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="created" name="Created" stroke="var(--accent-lavender)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="card px-5 pt-5 pb-3">
          <h3 className="section-title mb-3">Project Progress</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={projects} layout="vertical" margin={{ top: 6, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--border-divider)" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11.5, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-secondary)' }} />
              <Bar dataKey="progress" name="Progress %" radius={[0, 6, 6, 0]} barSize={16}>
                {projects.map((_, i) => (
                  <Cell key={i} fill="var(--color-charcoal)" fillOpacity={1 - i * 0.12} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="card px-5 pt-5 pb-3">
          <h3 className="section-title mb-3">Team Productivity</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={productivityByMember} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-divider)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={26} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-secondary)' }} />
              <Bar dataKey="completed" name="Tasks Completed" radius={[6, 6, 0, 0]} barSize={26} fill="var(--color-dark-gray)" />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="card px-5 pt-5 pb-3">
          <h3 className="section-title mb-3">Workload</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={workloadByMember} layout="vertical" margin={{ top: 6, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--border-divider)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11.5, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-secondary)' }} />
              <Bar dataKey="tasks" name="Assigned Tasks" radius={[0, 6, 6, 0]} barSize={16}>
                {workloadByMember.map((m, i) => (
                  <Cell key={i} fill={barColors[i % barColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>
    </div>
  )
}
