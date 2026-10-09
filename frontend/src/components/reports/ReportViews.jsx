import { useCallback, useState } from 'react'
import { Badge } from '../ui/Badge'
import { ProgressBar } from '../ui/ProgressBar'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { DelayedBadge } from '../DelayedBadge'
import { WorkloadTable } from '../WorkloadTable'
import { StatCard } from '../StatCard'
import { ReportRunner, ReportTable, SummaryTiles } from './ReportParts'
import { fullDate, pct, hours } from './reportFormat'
import { useReportableProjects } from './useReportableProjects'
import { useApi } from '../../api/useApi'
import {
  getKpis,
  getProjectReport,
  getTaskReport,
  getProjectStatusReport,
  getTaskCompletionReport,
  getOverdueReport,
  getTeamPerformanceReport,
  getWorkloadReport,
} from '../../api/reports'
import { humanizeEnum } from '../../api/format'

const TASK_STATUS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED'].map((s) => ({ value: s, label: humanizeEnum(s) }))
const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((s) => ({ value: s, label: humanizeEnum(s) }))
const PROJECT_STATUS = [
  { value: 'PLANNING', label: 'Planning' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'DELAYED', label: 'Delayed' },
]

const people = (names) => (names?.length ? names.join(', ') : 'Unassigned')
const statusBadge = (row) => <Badge tone={row.status}>{humanizeEnum(row.status)}</Badge>

// The task columns shared by the Task, Overdue and Completion reports.
const taskColumns = {
  title: { key: 'title', label: 'Task' },
  project: { key: 'projectName', label: 'Project' },
  assignees: { key: 'assignees', label: 'Assignee', render: (r) => people(r.assignees) },
  priority: { key: 'priority', label: 'Priority', render: (r) => humanizeEnum(r.priority) },
  status: { key: 'status', label: 'Status', render: statusBadge },
  progress: { key: 'progress', label: 'Progress', align: 'right', render: (r) => `${Math.round(Number(r.progress ?? 0))}%` },
  start: { key: 'startDate', label: 'Start', render: (r) => fullDate(r.startDate) },
  due: { key: 'dueDate', label: 'Due', render: (r) => fullDate(r.dueDate) },
  estimated: { key: 'estimatedHours', label: 'Est. h', align: 'right', render: (r) => (r.estimatedHours == null ? '—' : hours(r.estimatedHours)) },
  daysOverdue: {
    key: 'daysOverdue',
    label: 'Days overdue',
    align: 'right',
    render: (r) => <span className="text-danger-ink font-semibold">{r.daysOverdue}</span>,
  },
  completedAt: { key: 'completedAt', label: 'Completed', render: (r) => fullDate(r.completedAt?.slice(0, 10)) },
}

// ---------------------------------------------------------------- KPIs

const KPI_HELP = {
  project: 'completed projects ÷ (all projects − cancelled)',
  task: 'completed tasks ÷ (all tasks − cancelled)',
  overdue: 'overdue tasks ÷ (all tasks − completed − cancelled)',
  days: 'average of (completion date − start date) over completed tasks',
  onTime: 'tasks completed on or before the due date ÷ completed tasks',
}

export function KpiView() {
  const projects = useReportableProjects()
  const [projectId, setProjectId] = useState('')
  const fetcher = useCallback(() => getKpis({ projectId }), [projectId])
  const { data, loading, error } = useApi(fetcher)

  return (
    <section className="card px-6 py-5" data-testid="kpi-view">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="section-title">Key performance indicators</h3>
        <select
          aria-label="Project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="field field-sm min-w-[170px]"
        >
          <option value="">All my projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {error && <EmptyState title="The KPIs could not be calculated" subtitle={error.message} />}
      {loading && !data && <Skeleton className="h-[110px] rounded-md" />}
      {data && (
        <>
          <div className="grid grid-cols-5 gap-4 max-[1100px]:grid-cols-3 max-[640px]:grid-cols-2">
            <div data-testid="kpi-project-completion" title={KPI_HELP.project}>
              <StatCard label="Project completion rate" value={pct(data.projectCompletionRate)} />
            </div>
            <div data-testid="kpi-task-completion" title={KPI_HELP.task}>
              <StatCard label="Task completion rate" value={pct(data.taskCompletionRate)} />
            </div>
            <div data-testid="kpi-overdue" title={KPI_HELP.overdue}>
              <StatCard label="Overdue rate" value={pct(data.overdueRate)} />
            </div>
            <div data-testid="kpi-days" title={KPI_HELP.days}>
              <StatCard
                label="Average task completion time"
                value={data.averageTaskCompletionDays == null ? '—' : `${Number(data.averageTaskCompletionDays).toFixed(1)} days`}
              />
            </div>
            <div data-testid="kpi-on-time" title={KPI_HELP.onTime}>
              <StatCard label="On-time completion rate" value={pct(data.onTimeCompletionRate)} />
            </div>
          </div>
          <p className="text-faint mt-4 text-[12px]">
            Based on {data.basis.projects} project{data.basis.projects === 1 ? '' : 's'} and {data.basis.tasks} task
            {data.basis.tasks === 1 ? '' : 's'} ({data.basis.completedTasks} completed, {data.basis.cancelledTasks} cancelled,{' '}
            {data.basis.overdueTasks} overdue). A rate shows “—” when there is nothing to divide by; cancelled work is left
            out. Hover a tile for its formula.
          </p>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- 1. Project Report

export function ProjectReportView() {
  return (
    <ReportRunner
      testId="report-project"
      title="Project Report"
      hint="One project: its details, owner, dates, progress, milestones, team, task counts and upcoming deadlines."
      fields={[{ name: 'projectId', label: 'Project', type: 'project', required: true }]}
      run={(v) => getProjectReport({ projectId: v.projectId })}
    >
      {(r) => (
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h4 className="text-ink text-[15px] font-[650]">{r.project.name}</h4>
              <span className="text-faint text-[12px]">{r.project.projectCode}</span>
              <Badge tone={r.project.status}>{humanizeEnum(r.project.status)}</Badge>
              {r.project.priority && <Badge tone={r.project.priority}>{humanizeEnum(r.project.priority)}</Badge>}
              <DelayedBadge project={r.project} />
            </div>
            {r.description && <p className="text-muted mb-2 text-[13px]">{r.description}</p>}
            <p className="text-muted mb-2 text-[12px]">
              Owner {r.project.owner?.fullName ?? '—'} · {fullDate(r.project.startDate)} → {fullDate(r.project.endDate)}
            </p>
            <div className="flex max-w-[360px] items-center gap-3">
              <span className="min-w-0 flex-1">
                <ProgressBar percent={Number(r.project.progress ?? 0)} height={7} />
              </span>
              <span className="text-ink text-[13px] font-semibold">{Math.round(Number(r.project.progress ?? 0))}%</span>
            </div>
          </div>

          <SummaryTiles
            items={[
              { label: 'Tasks', value: r.taskCounts.total },
              { label: 'To Do', value: r.taskCounts.todo },
              { label: 'In Progress', value: r.taskCounts.inProgress },
              { label: 'In Review', value: r.taskCounts.inReview },
              { label: 'Completed', value: r.taskCounts.completed },
              { label: 'Cancelled', value: r.taskCounts.cancelled },
              { label: 'Overdue', value: r.taskCounts.overdue, tone: 'danger' },
            ]}
          />

          <div>
            <h4 className="mb-2 text-[13px] font-[650]">Team ({r.team.length})</h4>
            <ReportTable
              columns={[
                { key: 'name', label: 'Member', render: (m) => m.user.fullName },
                { key: 'role', label: 'Project role', render: (m) => humanizeEnum(m.projectRole) },
              ]}
              rows={r.team.map((m) => ({ ...m, key: m.user.id }))}
            />
          </div>

          <div>
            <h4 className="mb-2 text-[13px] font-[650]">Milestones ({r.milestones.length})</h4>
            <ReportTable
              empty="No milestones."
              columns={[
                { key: 'title', label: 'Milestone' },
                { key: 'dueDate', label: 'Due', render: (m) => fullDate(m.dueDate) },
                { key: 'status', label: 'Status', render: statusBadge },
                { key: 'progress', label: 'Progress', align: 'right', render: (m) => `${Math.round(Number(m.progress ?? 0))}%` },
              ]}
              rows={r.milestones}
            />
          </div>

          <div>
            <h4 className="mb-2 text-[13px] font-[650]">Upcoming deadlines (next 14 days, including overdue)</h4>
            <ReportTable
              empty="No open task is due in the next 14 days."
              columns={[taskColumns.title, taskColumns.assignees, taskColumns.due, taskColumns.status]}
              rows={r.upcomingDeadlines}
            />
          </div>
        </div>
      )}
    </ReportRunner>
  )
}

// ---------------------------------------------------------------- 2. Task Report

export function TaskReportView() {
  return (
    <ReportRunner
      testId="report-tasks"
      title="Task Report"
      hint="A list of tasks with their project, assignees, priority, status, progress, dates and estimate."
      fields={[
        { name: 'projectId', label: 'Project', type: 'project', noneLabel: 'All my projects' },
        { name: 'assigneeId', label: 'Assignee', type: 'user', noneLabel: 'Anyone' },
        { name: 'status', label: 'Status', type: 'select', options: TASK_STATUS },
        { name: 'priority', label: 'Priority', type: 'select', options: PRIORITY },
        { name: 'dueFrom', label: 'Due from', type: 'date' },
        { name: 'dueTo', label: 'Due to', type: 'date' },
      ]}
      run={(v) => getTaskReport(v)}
    >
      {(r) => (
        <>
          <SummaryTiles items={[{ label: 'Tasks in this report', value: r.rows.length }]} />
          <ReportTable
            columns={[
              taskColumns.title, taskColumns.project, taskColumns.assignees, taskColumns.priority, taskColumns.status,
              taskColumns.progress, taskColumns.start, taskColumns.due, taskColumns.estimated,
            ]}
            rows={r.rows}
          />
        </>
      )}
    </ReportRunner>
  )
}

// ---------------------------------------------------------------- 3. Project Status Report

export function ProjectStatusReportView() {
  return (
    <ReportRunner
      testId="report-project-status"
      title="Project Status Report"
      hint="Projects grouped by Planning, In Progress, On Hold, Completed, Cancelled and Delayed (calculated: the end date passed and the project is not finished, so a project can be in two groups)."
      fields={[
        { name: 'status', label: 'Show', type: 'select', options: PROJECT_STATUS, noneLabel: 'Every group' },
        { name: 'ownerId', label: 'Owner', type: 'user', noneLabel: 'Anyone' },
        { name: 'from', label: 'Active from', type: 'date' },
        { name: 'to', label: 'Active to', type: 'date' },
      ]}
      run={(v) => getProjectStatusReport(v)}
    >
      {(r) => (
        <div className="flex flex-col gap-5">
          <SummaryTiles items={r.groups.map((g) => ({ label: g.label, value: g.count, tone: g.key === 'DELAYED' ? 'danger' : undefined }))} />
          {r.groups.map((g) => (
            <div key={g.key} data-testid={`status-group-${g.key}`}>
              <h4 className="mb-2 text-[13px] font-[650]">
                {g.label} <span className="text-faint font-semibold">({g.count})</span>
              </h4>
              <ReportTable
                empty={`No ${g.label.toLowerCase()} projects.`}
                columns={[
                  { key: 'name', label: 'Project' },
                  { key: 'projectCode', label: 'Code' },
                  { key: 'owner', label: 'Owner', render: (p) => p.owner?.fullName ?? '—' },
                  { key: 'priority', label: 'Priority', render: (p) => humanizeEnum(p.priority) },
                  { key: 'dates', label: 'Dates', render: (p) => `${fullDate(p.startDate)} → ${fullDate(p.endDate)}` },
                  { key: 'progress', label: 'Progress', align: 'right', render: (p) => `${Math.round(Number(p.progress ?? 0))}%` },
                  {
                    key: 'late',
                    label: 'Days delayed',
                    align: 'right',
                    render: (p) => (p.delayed ? <span className="text-danger-ink font-semibold">{p.daysDelayed}</span> : '—'),
                  },
                ]}
                rows={g.projects}
              />
            </div>
          ))}
        </div>
      )}
    </ReportRunner>
  )
}

// ---------------------------------------------------------------- 4. Task Completion Report

export function TaskCompletionReportView() {
  return (
    <ReportRunner
      testId="report-task-completion"
      title="Task Completion Report"
      hint="Of the tasks due in the date range (cancelled ones left out), how many are completed, by project, team member or month."
      fields={[
        { name: 'from', label: 'Due from', type: 'date', required: true },
        { name: 'to', label: 'Due to', type: 'date', required: true },
        {
          name: 'groupBy',
          label: 'Group by',
          type: 'select',
          required: true,
          options: [
            { value: 'project', label: 'Project' },
            { value: 'member', label: 'Team member' },
            { value: 'month', label: 'Month' },
          ],
        },
        { name: 'projectId', label: 'Project', type: 'project', noneLabel: 'All my projects' },
      ]}
      initial={{ groupBy: 'project' }}
      run={(v) => getTaskCompletionReport(v)}
    >
      {(r) => (
        <div className="flex flex-col gap-5">
          <SummaryTiles
            items={[
              { label: 'Tasks due in the range', value: r.overall.total },
              { label: 'Completed', value: r.overall.completed },
              { label: 'Completion', value: pct(r.overall.percentage) },
            ]}
          />
          <ReportTable
            testId="completion-groups"
            empty="No tasks are due in this range."
            columns={[
              { key: 'label', label: humanizeEnum(r.groupBy === 'member' ? 'team_member' : r.groupBy) },
              { key: 'total', label: 'Tasks', align: 'right' },
              { key: 'completed', label: 'Completed', align: 'right' },
              { key: 'percentage', label: 'Completion', align: 'right', render: (g) => pct(g.percentage) },
            ]}
            rows={r.groups}
          />
          <div>
            <h4 className="mb-2 text-[13px] font-[650]">Completed tasks ({r.completedTasks.length})</h4>
            <ReportTable
              empty="Nothing was completed."
              columns={[taskColumns.title, taskColumns.project, taskColumns.assignees, taskColumns.due, taskColumns.completedAt]}
              rows={r.completedTasks}
            />
          </div>
        </div>
      )}
    </ReportRunner>
  )
}

// ---------------------------------------------------------------- 5. Overdue Task Report

export function OverdueReportView() {
  return (
    <ReportRunner
      testId="report-overdue"
      title="Overdue Task Report"
      hint="Tasks whose due date has passed and that are not completed or cancelled, most overdue first."
      fields={[
        { name: 'projectId', label: 'Project', type: 'project', noneLabel: 'All my projects' },
        { name: 'assigneeId', label: 'Assignee', type: 'user', noneLabel: 'Anyone' },
        { name: 'priority', label: 'Priority', type: 'select', options: PRIORITY },
      ]}
      run={(v) => getOverdueReport(v)}
    >
      {(r) => (
        <>
          <SummaryTiles items={[{ label: 'Overdue tasks', value: r.rows.length, tone: 'danger' }]} />
          <ReportTable
            empty="Nothing is overdue."
            columns={[taskColumns.title, taskColumns.project, taskColumns.assignees, taskColumns.due, taskColumns.daysOverdue, taskColumns.status]}
            rows={r.rows}
          />
        </>
      )}
    </ReportRunner>
  )
}

// ---------------------------------------------------------------- 6. Team Performance Report

export function TeamPerformanceReportView() {
  return (
    <ReportRunner
      testId="report-team-performance"
      title="Team Performance Report"
      hint="Per member: assigned, completed and open tasks, overdue tasks and the completion rate (completed ÷ assigned; cancelled tasks left out). To Do is the “pending” of the definitions."
      fields={[
        { name: 'projectId', label: 'Project', type: 'project', noneLabel: 'All my projects' },
        { name: 'from', label: 'Due from', type: 'date' },
        { name: 'to', label: 'Due to', type: 'date' },
      ]}
      run={(v) => getTeamPerformanceReport(v)}
    >
      {(r) => (
        <ReportTable
          empty="No member has tasks in this scope."
          columns={[
            { key: 'name', label: 'Member', render: (m) => m.user.fullName },
            { key: 'assigned', label: 'Assigned', align: 'right' },
            { key: 'completed', label: 'Completed', align: 'right' },
            { key: 'todo', label: 'To Do (pending)', align: 'right' },
            { key: 'inProgress', label: 'In Progress', align: 'right' },
            { key: 'inReview', label: 'In Review', align: 'right' },
            { key: 'overdue', label: 'Overdue', align: 'right' },
            { key: 'completionRate', label: 'Completion rate', align: 'right', render: (m) => pct(m.completionRate) },
          ]}
          rows={r.members.map((m) => ({ ...m, key: m.user.id }))}
        />
      )}
    </ReportRunner>
  )
}

// ---------------------------------------------------------------- 7. Workload Report

export function WorkloadReportView() {
  return (
    <ReportRunner
      testId="report-workload"
      title="Workload Report"
      hint="Per member: assigned, active and overdue tasks, estimated and actual hours (logged time), judged against the team average."
      fields={[{ name: 'projectId', label: 'Project', type: 'project', noneLabel: 'All my projects' }]}
      run={(v) => getWorkloadReport(v)}
    >
      {(r) => <WorkloadTable workload={r.workload} />}
    </ReportRunner>
  )
}
