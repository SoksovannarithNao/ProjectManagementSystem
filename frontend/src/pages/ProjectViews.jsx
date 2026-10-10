import { useCallback, useMemo, useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import { ArrowLeft, Users, Gauge, ChartGantt, ChartNoAxesGantt } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorPage } from './ErrorPage'
import { DelayedBadge } from '../components/DelayedBadge'
import { TeamTasksView } from '../components/TeamTasksView'
import { WorkloadTable } from '../components/WorkloadTable'
import { TimelineView } from '../components/TimelineView'
import { GanttChart } from '../components/GanttChart'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { useApi } from '../api/useApi'
import { useAuth } from '../auth/AuthContext'
import { getProjectById } from '../api/projects'
import { getTasksByProjectId } from '../api/tasks'
import { getTaskAssignees } from '../api/taskAssignees'
import { getMilestonesByProjectId } from '../api/milestones'
import { getAllTaskDependencies } from '../api/taskDependencies'
import { getProjectWorkload } from '../api/teamViews'
import { buildTaskAssigneeMap } from '../api/relations'

const TABS = [
  { view: 'team', label: 'Team Tasks', icon: Users, managersOnly: true },
  { view: 'workload', label: 'Workload', icon: Gauge, managersOnly: true },
  { view: 'timeline', label: 'Timeline', icon: ChartGantt, managersOnly: false },
  { view: 'gantt', label: 'Gantt', icon: ChartNoAxesGantt, managersOnly: false },
]

// The views of one project - Team Tasks, Workload, Timeline and Gantt - behind
// one tab bar (/projects/:id/team, /workload, /timeline, /gantt). Team Tasks and
// Workload are for people who may assign tasks in the project (Owner, Team
// Leader, Administrator); the Timeline and the Gantt chart are for every member.
export function ProjectViews() {
  const { id, view } = useParams()
  const projectId = Number(id)
  const { can } = useAuth()
  const canManage = can('TASK', 'ASSIGN', projectId)
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const projectFetcher = useCallback(() => getProjectById(projectId), [projectId])
  const { data: project, loading: projectLoading, error: projectError } = useApi(projectFetcher)
  const tasksFetcher = useCallback(() => getTasksByProjectId(projectId), [projectId])
  const { data: tasksData, refetch: refetchTasks } = useApi(tasksFetcher)
  const milestonesFetcher = useCallback(() => getMilestonesByProjectId(projectId), [projectId])
  const { data: milestonesData } = useApi(milestonesFetcher)
  const { data: assignees, refetch: refetchAssignees } = useApi(getTaskAssignees)
  const workloadFetcher = useCallback(() => (canManage ? getProjectWorkload(projectId) : Promise.resolve(null)), [projectId, canManage])
  const { data: workload, loading: workloadLoading, error: workloadError } = useApi(workloadFetcher)
  const dependenciesFetcher = useCallback(() => (view === 'gantt' ? getAllTaskDependencies() : Promise.resolve(null)), [view])
  const { data: dependencies, refetch: refetchDependencies } = useApi(dependenciesFetcher)

  const tasks = useMemo(() => tasksData ?? [], [tasksData])
  const milestones = useMemo(() => milestonesData ?? [], [milestonesData])
  const assigneeMap = useMemo(() => buildTaskAssigneeMap(assignees), [assignees])
  const activeTask = useMemo(() => {
    if (activeTaskId == null) return null
    const t = tasks.find((x) => x.id === activeTaskId)
    return t ? { ...t, assigneeIds: assigneeMap.get(t.id) ?? [] } : null
  }, [activeTaskId, tasks, assigneeMap])

  const current = TABS.find((t) => t.view === view) ?? TABS[0]
  const allowed = !current.managersOnly || canManage
  const afterChange = () => {
    refetchTasks()
    refetchAssignees()
    refetchDependencies()
    setRefreshKey((k) => k + 1)
  }

  if (projectLoading) {
    return (
      <div>
        <TopBar title="Project" />
        <Skeleton className="h-[240px] rounded-card" />
      </div>
    )
  }
  if (projectError || !project) {
    return (
      <div>
        <TopBar title="Project" />
        <ErrorPage status={projectError?.status ?? 404} />
      </div>
    )
  }

  return (
    <div>
      <TopBar
        title={project.name}
        subtitle={`${project.projectCode ?? ''} · ${current.label}`}
        actions={
          <Link to={`/projects/${projectId}`} className="btn btn-secondary">
            <ArrowLeft size={15} /> Back to project
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2" role="tablist" aria-label="Project views">
        {TABS.filter((t) => !t.managersOnly || canManage).map(({ view: v, label, icon: Icon }) => (
          <NavLink
            key={v}
            to={`/projects/${projectId}/${v}`}
            role="tab"
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                isActive || (!view && v === TABS[0].view) ? 'bg-charcoal text-on-charcoal' : 'bg-subtle text-muted hover:text-ink'
              }`
            }
          >
            <Icon size={14} /> {label}
          </NavLink>
        ))}
        <DelayedBadge project={project} className="ml-auto" />
      </div>

      {!allowed && (
        <EmptyState
          icon={Users}
          title="Only the Owner, a Team Leader or an Administrator can see this"
          subtitle="The timeline is open to every member of the project."
        />
      )}

      {allowed && current.view === 'team' && (
        <TeamTasksView
          projectId={projectId}
          canAssign={canManage}
          onOpenTask={setActiveTaskId}
          refreshKey={refreshKey}
          onChanged={afterChange}
        />
      )}

      {allowed && current.view === 'workload' && (
        <div className="card px-6 py-5">
          <h3 className="section-title mb-4">Team workload</h3>
          {workloadLoading && <Skeleton className="h-[160px] rounded-card" />}
          {workloadError && <p className="text-danger-ink text-[12px] font-semibold">Failed to load the workload.</p>}
          {!workloadLoading && !workloadError && <WorkloadTable workload={workload} />}
        </div>
      )}

      {allowed && current.view === 'timeline' && (
        <TimelineView project={project} tasks={tasks} milestones={milestones} onOpenTask={setActiveTaskId} />
      )}

      {allowed && current.view === 'gantt' && (
        <GanttChart project={project} tasks={tasks} dependencies={dependencies} onOpenTask={setActiveTaskId} />
      )}

      {activeTask && (
        <TaskDetailPanel task={activeTask} onClose={() => setActiveTaskId(null)} onChange={afterChange} />
      )}
    </div>
  )
}
