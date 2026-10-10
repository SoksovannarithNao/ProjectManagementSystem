import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  CalendarDays,
  Flag,
  Users,
  Milestone as MilestoneIcon,
  ListChecks,
  AlertTriangle,
  Lock,
  Plus,
  X,
  SlidersHorizontal,
  ChevronRight,
  Gauge,
  ChartGantt,
  ChartNoAxesGantt,
} from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { Avatar, AvatarGroup } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorPage } from './ErrorPage'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Dropdown } from '../components/ui/Dropdown'
import { useToast } from '../components/ui/Toast'
import { NewProjectModal } from '../components/NewProjectModal'
import { TaskFormModal } from '../components/TaskFormModal'
import { AddProjectMemberModal } from '../components/AddProjectMemberModal'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { DelayedBadge } from '../components/DelayedBadge'
import { AttachmentsSection } from '../components/AttachmentsSection'
import { ProjectActivity } from '../components/ProjectActivity'
import { useApi } from '../api/useApi'
import { useAuth } from '../auth/AuthContext'
import { getProjectById, updateProject, deleteProject, projectResponseToRequest } from '../api/projects'
import { getMembersByProjectId, getPendingInvitationCount, updateProjectMemberRole } from '../api/projectMembers'
import { getTasksByProjectId } from '../api/tasks'
import { getTaskAssignees } from '../api/taskAssignees'
import { getMilestonesByProjectId, createMilestone, deleteMilestone } from '../api/milestones'
import { buildTaskAssigneeMap } from '../api/relations'
import { humanizeEnum, formatDate, initialsFor, colorForId, taskDisplayTitle, blockedReason } from '../api/format'
import { computeTaskOverview } from '../api/stats'

const PROJECT_STATUS_OPTIONS = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']
const TASK_STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED']

// Shared sizing so every pill in the status/priority/overdue row lines up:
// same height, padding, line-height, font-size, and radius regardless of
// whether the element is a <select>, the Badge component, or a plain <span>.
const STATUS_ROW_BADGE_CLASS =
  'h-7 box-border inline-flex items-center rounded-full px-2.5 text-[12px] leading-none font-semibold'
const TASK_PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
// Business names of the project roles (Owner = Project Manager of the project).
const ROLE_LABELS = { OWNER: 'Owner', ADMIN: 'Team Leader', MEMBER: 'Team Member', VIEWER: 'Viewer' }
// An Owner has to be able to own projects (Project Manager or Administrator).
const CAN_OWN = new Set(['PROJECT_MANAGER', 'ADMINISTRATOR'])

// A section's own fetch failing (members/tasks/milestones each load
// independently) must not be displayed the same way as that section
// genuinely having zero rows — silently falling back to `?? []` would make
// "failed to load" indistinguishable from "there's nothing here".
function SectionError({ message, onRetry }) {
  return (
    <div className="bg-danger-soft text-danger-ink mb-4 flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-[12px] font-semibold">
      <span>{message}</span>
      <button type="button" className="shrink-0 underline underline-offset-2" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}

export function ProjectDetail() {
  const { id } = useParams()
  const projectId = Number(id)
  const navigate = useNavigate()
  const notify = useToast()
  const { can, profile, refreshProfile } = useAuth()

  const projectFetcher = useCallback(() => getProjectById(projectId), [projectId])
  const { data: project, loading, error: projectError, refetch } = useApi(projectFetcher)

  const membersFetcher = useCallback(() => getMembersByProjectId(projectId), [projectId])
  const { data: membersData, error: membersError, refetch: refetchMembers } = useApi(membersFetcher)
  const members = useMemo(() => membersData ?? [], [membersData])

  const tasksFetcher = useCallback(() => getTasksByProjectId(projectId), [projectId])
  const { data: tasksData, error: tasksError, refetch: refetchTasks } = useApi(tasksFetcher)
  const tasks = useMemo(() => tasksData ?? [], [tasksData])

  const milestonesFetcher = useCallback(() => getMilestonesByProjectId(projectId), [projectId])
  const { data: milestonesData, error: milestonesError, refetch: refetchMilestones } = useApi(milestonesFetcher)
  const milestones = useMemo(() => milestonesData ?? [], [milestonesData])

  const { data: taskAssignees, error: assigneesError, refetch: refetchAssignees } = useApi(getTaskAssignees)
  const assigneeMap = useMemo(() => buildTaskAssigneeMap(taskAssignees), [taskAssignees])

  // What the caller may do in THIS project (role_permissions, read through
  // /api/users/me/permissions). Controls they cannot use are not rendered.
  const canEditProject = can('PROJECT', 'EDIT', projectId)
  const canDelete = can('PROJECT', 'DELETE', projectId)
  const canAddContent = can('TASK', 'CREATE', projectId)
  const canManageTeam = can('MEMBER', 'CREATE', projectId)
  const canCreateMilestone = can('MILESTONE', 'CREATE', projectId)
  const canDeleteMilestone = can('MILESTONE', 'DELETE', projectId)
  // Team Tasks and Workload are for people who manage the work; the Timeline is for every member.
  const canSeeTeamViews = can('TASK', 'ASSIGN', projectId)
  // Setting a member's project role needs MEMBER:EDIT. Only the Owner and an
  // Administrator (PROJECT:ASSIGN) may pick any role or transfer ownership; a
  // Team Leader can only move a Team Member / Viewer between those two.
  const canChangeRoles = can('MEMBER', 'EDIT', projectId)
  const canTransferOwnership = can('PROJECT', 'ASSIGN', projectId)

  // The members list above only carries ACTIVE rows, so pending invitations
  // are counted server-side by their own PENDING status (Team-Admin-only, so
  // only fetched once the caller is known to manage this project).
  const pendingFetcher = useCallback(
    () => (canManageTeam ? getPendingInvitationCount(projectId) : Promise.resolve(null)),
    [projectId, canManageTeam]
  )
  const { data: pendingData, refetch: refetchPending } = useApi(pendingFetcher)
  const pendingCount = canManageTeam ? (pendingData?.count ?? 0) : 0

  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [taskStatusFilter, setTaskStatusFilter] = useState(() => new Set())
  const [taskPriorityFilter, setTaskPriorityFilter] = useState(() => new Set())
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDue, setMilestoneDue] = useState('')
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [roleBusyId, setRoleBusyId] = useState(null)
  const [transferTarget, setTransferTarget] = useState(null)

  // One role change. OWNER is the ownership transfer: the current Owner becomes
  // a Team Leader in the same step, so this person's own permissions change too.
  const changeRole = async (member, role) => {
    setRoleBusyId(member.id)
    try {
      await updateProjectMemberRole(member, role)
      notify(
        role === 'OWNER'
          ? `${member.user.fullName} is now the Owner of ${project?.name ?? 'the project'}`
          : `${member.user.fullName} is now a ${ROLE_LABELS[role]}`,
        { tone: 'success' }
      )
      refetchMembers()
      if (role === 'OWNER') {
        refetch()
        await refreshProfile()
      }
    } catch (err) {
      notify(err.message || 'Failed to change the role', { tone: 'error' })
      refetchMembers()
    } finally {
      setRoleBusyId(null)
      setTransferTarget(null)
    }
  }

  const activeTask = useMemo(() => {
    if (activeTaskId == null) return null
    const t = tasks.find((x) => x.id === activeTaskId)
    return t ? { ...t, assigneeIds: assigneeMap.get(t.id) ?? [] } : null
  }, [activeTaskId, tasks, assigneeMap])

  const taskOverview = useMemo(() => computeTaskOverview(tasks), [tasks])
  const overdueCount = useMemo(() => tasks.filter((t) => t.overdue).length, [tasks])
  const activeMembers = useMemo(() => members.filter((m) => m.status === 'ACTIVE'), [members])
  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => new Date(a.dueDate ?? 0) - new Date(b.dueDate ?? 0)),
    [tasks]
  )
  // The "Tasks (N)" count and the To Do/In Progress/Review/Completed
  // breakdown above the list both stay derived from the FULL `tasks` list,
  // not this filtered view — same reasoning as Tasks.jsx's own project
  // group headers: an at-a-glance summary that doesn't shift depending on
  // which rows the filter happens to be showing underneath it.
  const filteredTasks = useMemo(
    () =>
      sortedTasks.filter(
        (t) =>
          (taskStatusFilter.size === 0 || taskStatusFilter.has(t.status)) &&
          (taskPriorityFilter.size === 0 || taskPriorityFilter.has(t.priority))
      ),
    [sortedTasks, taskStatusFilter, taskPriorityFilter]
  )
  const activeTaskFilterCount = taskStatusFilter.size + taskPriorityFilter.size

  const toggleTaskStatusFilter = (status) => {
    setTaskStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }
  const toggleTaskPriorityFilter = (priority) => {
    setTaskPriorityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(priority)) next.delete(priority)
      else next.add(priority)
      return next
    })
  }

  const handleStatusChange = async (status) => {
    setSavingStatus(true)
    try {
      await updateProject(projectId, projectResponseToRequest(project, { status }))
      refetch()
    } catch (err) {
      notify(err.message || 'Failed to update project status', { tone: 'error' })
    } finally {
      setSavingStatus(false)
    }
  }

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    try {
      await deleteProject(projectId)
      notify(`Project "${project.name}" deleted`, { tone: 'success' })
      navigate('/projects')
    } catch (err) {
      notify(err.message || 'Failed to delete project', { tone: 'error' })
      setDeleting(false)
    }
  }

  const handleAddMilestone = async (e) => {
    e.preventDefault()
    if (!milestoneTitle.trim() || !milestoneDue) return
    setAddingMilestone(true)
    try {
      await createMilestone({ projectId, title: milestoneTitle.trim(), dueDate: milestoneDue })
      setMilestoneTitle('')
      setMilestoneDue('')
      refetchMilestones()
    } catch (err) {
      notify(err.message || 'Failed to add milestone', { tone: 'error' })
    } finally {
      setAddingMilestone(false)
    }
  }

  // A task's own status/completion changing here (via the panel or the new
  // task modal) can move project.progress (task-completion-derived — see the
  // Overview section's comment) out from under the "Progress" card above,
  // so both need refetching together, not just the task list.
  const refetchAfterTaskChange = () => {
    refetchTasks()
    refetch()
  }

  const handleDeleteMilestone = async (milestoneId) => {
    try {
      await deleteMilestone(milestoneId)
      refetchMilestones()
    } catch (err) {
      notify(err.message || 'Failed to delete milestone', { tone: 'error' })
    }
  }

  if (loading) {
    return (
      <div>
        <TopBar title="Loading…" />
        <div className="flex flex-col gap-5">
          <Skeleton className="h-[220px] rounded-card" />
          <Skeleton className="h-[180px] rounded-card" />
        </div>
      </div>
    )
  }

  if (!project) {
    // The backend deliberately returns 404 for both "doesn't exist" and "you
    // don't have access" (see ProjectAccessGuard.assertAccess) so a caller
    // can't use this page to probe which projects exist — that case, and the
    // no-error-yet case, are shown as a 404. Anything else (a real 5xx/network
    // failure) shows its own status with a retry action instead of being
    // misreported as "not found".
    return (
      <div>
        <TopBar title="Project" />
        <ErrorPage status={projectError?.status ?? 404} onRetry={refetch} />
      </div>
    )
  }

  return (
    <div>
      <TopBar
        title={
          <span className="inline-flex min-w-0 items-center gap-2">
            <Link
              to="/projects"
              className="icon-btn shrink-0"
              aria-label="Back to projects"
              title="Back to projects"
            >
              <ArrowLeft size={20} />
            </Link>
            <span className="truncate">{project.name}</span>
          </span>
        }
        subtitle={`${project.projectCode} · Managed by ${project.manager?.fullName ?? '—'}`}
        actions={
          <>
            {canSeeTeamViews && (
              <>
                <Link to={`/projects/${projectId}/team`} className="btn btn-secondary">
                  <Users size={15} /> Team tasks
                </Link>
                <Link to={`/projects/${projectId}/workload`} className="btn btn-secondary">
                  <Gauge size={15} /> Workload
                </Link>
              </>
            )}
            <Link to={`/projects/${projectId}/timeline`} className="btn btn-secondary">
              <ChartGantt size={15} /> Timeline
            </Link>
            <Link to={`/projects/${projectId}/gantt`} className="btn btn-secondary">
              <ChartNoAxesGantt size={15} /> Gantt
            </Link>
            {canEditProject && (
              <>
                <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                  <Pencil size={15} /> Edit
                </button>
                {canDelete && (
                  <button
                    className="btn bg-danger text-on-danger hover:opacity-90"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                )}
              </>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-5">
        {/* Overview */}
        <div className="card px-6 py-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {canEditProject ? (
              <select
                value={project.status}
                aria-label="Project status"
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={savingStatus}
                className={`bg-subtle border-border border outline-none disabled:opacity-70 max-sm:h-10 ${STATUS_ROW_BADGE_CLASS}`}
              >
                {PROJECT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {humanizeEnum(s)}
                  </option>
                ))}
              </select>
            ) : (
              <Badge tone={project.status} className={STATUS_ROW_BADGE_CLASS}>
                {humanizeEnum(project.status)}
              </Badge>
            )}
            {project.priority && (
              <Badge tone={project.priority} className={`${STATUS_ROW_BADGE_CLASS} gap-1.25`}>
                {humanizeEnum(project.priority)}
              </Badge>
            )}
            <DelayedBadge project={project} />
            {overdueCount > 0 && (
              <span className={`bg-danger-soft text-danger-ink gap-1 ${STATUS_ROW_BADGE_CLASS}`}>
                <AlertTriangle size={12} /> {overdueCount} overdue task{overdueCount === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {project.description && <p className="text-muted mb-5 text-[13px] leading-relaxed">{project.description}</p>}

          <div className="bg-subtle border-border mb-5 grid grid-cols-3 gap-4 rounded-md border p-4 max-sm:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[12px] font-semibold">
                <CalendarDays size={14} /> Start date
              </span>
              <span className="text-ink text-[13px] font-semibold">{formatDate(project.startDate)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[12px] font-semibold">
                <CalendarDays size={14} /> End date
              </span>
              <span className="text-ink text-[13px] font-semibold">{formatDate(project.endDate)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[12px] font-semibold">
                <Flag size={14} /> Manager
              </span>
              {project.manager ? (
                <span className="text-ink inline-flex items-center gap-1.5 text-[13px] font-semibold">
                  <Avatar
                    initials={initialsFor(project.manager.fullName)}
                    color={colorForId(project.manager.id)}
                    photoUrl={project.manager.profilePhotoUrl}
                    size={20}
                  />
                  {project.manager.fullName}
                </span>
              ) : (
                <span className="text-ink text-[13px] font-semibold">—</span>
              )}
            </div>
          </div>

          {/* project.progress is computed server-side from this project's
              own top-level tasks only (completed/total task count —
              database/init/01-init.sql's fn_compute_project_progress) —
              subtask completion never factors in, same as the task
              row/overview counts below this card. */}
          <div className="flex flex-col gap-2">
            <div className="text-muted flex items-center justify-between text-xs">
              <span>Progress</span>
              <span className="text-ink font-[650]">{Math.round(Number(project.progress ?? 0))}%</span>
            </div>
            <ProgressBar percent={Number(project.progress ?? 0)} />
          </div>
        </div>

        {/* Task overview */}
        <div className="card px-6 py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListChecks size={15} className="text-faint" />
              <h4 className="text-[13px] font-[650]">Tasks</h4>
              <span className="text-faint text-[12px]">({tasksError ? '—' : tasks.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <Dropdown
                button={({ toggle }) => (
                  <button className="btn btn-secondary px-3 py-2 text-[12px]" onClick={toggle}>
                    <SlidersHorizontal size={14} />
                    Filter{activeTaskFilterCount > 0 ? ` (${activeTaskFilterCount})` : ''}
                  </button>
                )}
              >
                {({ close }) => (
                  <div className="flex w-[200px] flex-col gap-3 p-1">
                    <div>
                      <span className="text-faint mb-1.5 block text-[12px] font-[650] tracking-[0.04em] uppercase">
                        Status
                      </span>
                      <div className="flex flex-col gap-0.5">
                        {TASK_STATUS_OPTIONS.map((s) => (
                          <label
                            key={s}
                            className="hover:bg-subtle flex items-center gap-2 rounded-sm px-1.5 py-1 text-[13px]"
                          >
                            <input
                              type="checkbox"
                              checked={taskStatusFilter.has(s)}
                              onChange={() => toggleTaskStatusFilter(s)}
                            />
                            {humanizeEnum(s)}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-faint mb-1.5 block text-[12px] font-[650] tracking-[0.04em] uppercase">
                        Priority
                      </span>
                      <div className="flex flex-col gap-0.5">
                        {TASK_PRIORITY_OPTIONS.map((p) => (
                          <label
                            key={p}
                            className="hover:bg-subtle flex items-center gap-2 rounded-sm px-1.5 py-1 text-[13px]"
                          >
                            <input
                              type="checkbox"
                              checked={taskPriorityFilter.has(p)}
                              onChange={() => toggleTaskPriorityFilter(p)}
                            />
                            {humanizeEnum(p)}
                          </label>
                        ))}
                      </div>
                    </div>
                    {activeTaskFilterCount > 0 && (
                      <button
                        type="button"
                        className="text-muted hover:text-ink text-left text-[12px] font-semibold"
                        onClick={() => {
                          setTaskStatusFilter(new Set())
                          setTaskPriorityFilter(new Set())
                          close()
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </Dropdown>
              {canAddContent && (
                <button className="btn btn-primary px-3 py-2 text-[12px]" onClick={() => setShowNewTask(true)}>
                  <Plus size={14} /> Add Task
                </button>
              )}
            </div>
          </div>

          {(tasksError || assigneesError) && (
            <SectionError
              message={tasksError ? 'Failed to load tasks.' : 'Task assignees failed to load — assignee avatars may be missing.'}
              onRetry={() => {
                refetchTasks()
                refetchAssignees()
              }}
            />
          )}

          {!tasksError && tasks.length === 0 && <p className="text-faint text-[12px]">No tasks in this project yet.</p>}

          {tasks.length > 0 && (
            <div className="mb-4 grid grid-cols-4 gap-3 max-sm:grid-cols-2">
              {taskOverview.map((t) => (
                <div key={t.key} className="bg-subtle rounded-md px-3 py-2.5">
                  <p className="text-ink text-[17px] font-bold">{t.count}</p>
                  <p className="text-muted text-[12px] font-semibold">{t.label}</p>
                </div>
              ))}
            </div>
          )}

          {tasks.length > 0 && filteredTasks.length === 0 && (
            <p className="text-faint text-[12px]">No tasks match the selected filters.</p>
          )}

          <div className="flex flex-col gap-1.5">
            {filteredTasks.map((t) => {
              const assigneeIds = assigneeMap.get(t.id) ?? []
              return (
                <button
                  key={t.id}
                  type="button"
                  data-testid="task-row"
                  onClick={() => setActiveTaskId(t.id)}
                  className="hover:bg-subtle hover:border-lavender/50 border-border group flex cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2.5 text-left transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[13px] font-semibold ${t.status === 'COMPLETED' ? 'text-faint line-through' : 'text-ink'}`}>
                      {taskDisplayTitle(t.title, project.name)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <Badge tone={t.status}>{humanizeEnum(t.status)}</Badge>
                      <Badge tone={t.priority}>{humanizeEnum(t.priority)}</Badge>
                      {t.blocked && (
                        <span title={blockedReason(t)} className="text-muted inline-flex items-center gap-1 text-[12px]">
                          <Lock size={11} /> Blocked
                        </span>
                      )}
                      {t.totalSubtasks > 0 && (
                        <span className="text-muted text-[12px]">
                          {t.completedSubtasks}/{t.totalSubtasks} subtasks
                        </span>
                      )}
                      {t.dueDate && (
                        <span className={`inline-flex items-center gap-1 text-[12px] ${t.overdue ? 'text-danger-ink font-semibold' : 'text-muted'}`}>
                          <CalendarDays size={11} /> {formatDate(t.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  {assigneeIds.length > 0 && <AvatarGroup memberIds={assigneeIds} size={24} />}
                  <ChevronRight
                    size={16}
                    className="text-faint shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </button>
              )
            })}
          </div>
        </div>

        {/* items-start: grid's default stretch would otherwise force the
            shorter card (usually Milestones, especially empty) to match the
            taller sibling's height, leaving a big blank gap under its own
            content instead of the card just sizing to fit it. */}
        <div className="grid grid-cols-2 items-start gap-5 max-lg:grid-cols-1">
          {/* Members */}
          <div className="card px-6 py-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-faint" />
                <h4 className="text-[13px] font-[650]">Members</h4>
                <span className="text-faint text-[12px]">({membersError ? '—' : activeMembers.length})</span>
              </div>
              <div className="flex items-center gap-3">
                {canManageTeam && (
                  <button
                    type="button"
                    className="hit-area text-muted hover:text-ink inline-flex items-center gap-1 text-[12px] font-semibold"
                    onClick={() => setShowAddMember(true)}
                  >
                    <Plus size={13} /> Add member
                  </button>
                )}
                <Link to="/team" className="hit-area text-muted hover:text-ink text-[12px] font-semibold">
                  Manage team →
                </Link>
              </div>
            </div>

            {membersError && <SectionError message="Failed to load members." onRetry={refetchMembers} />}

            {!membersError && activeMembers.length === 0 && <p className="text-faint text-[12px]">No members yet.</p>}

            <div className="flex flex-col gap-0.5">
              {activeMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 rounded-sm px-1 py-1.5">
                  <Avatar
                    initials={initialsFor(m.user.fullName)}
                    color={colorForId(m.user.id)}
                    photoUrl={m.user.profilePhotoUrl}
                    size={30}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate text-[13px] font-semibold">{m.user.fullName}</p>
                    {m.user.positionName && <p className="text-faint truncate text-[12px]">{m.user.positionName}</p>}
                  </div>
                  {(() => {
                    // A role the viewer may change shows as a picker; everything else as a badge.
                    const mine = m.user.id === profile?.id
                    const movable = ['MEMBER', 'VIEWER'].includes(m.projectRole)
                    const editable = canChangeRoles && !mine && m.projectRole !== 'OWNER' && (canTransferOwnership || movable)
                    if (!editable) return <Badge>{ROLE_LABELS[m.projectRole] ?? humanizeEnum(m.projectRole)}</Badge>
                    const options = canTransferOwnership ? ['ADMIN', 'MEMBER', 'VIEWER'] : ['MEMBER', 'VIEWER']
                    if (canTransferOwnership && CAN_OWN.has(m.user.role)) options.push('OWNER')
                    return (
                      <select
                        aria-label={`Project role of ${m.user.fullName}`}
                        value={m.projectRole}
                        disabled={roleBusyId === m.id}
                        onChange={(e) => (e.target.value === 'OWNER' ? setTransferTarget(m) : changeRole(m, e.target.value))}
                        className="bg-subtle border-border h-8 rounded-full border px-2.5 text-[12px] font-semibold outline-none"
                      >
                        {options.map((r) => (
                          <option key={r} value={r}>
                            {r === 'OWNER' ? 'Owner (transfer ownership)' : ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    )
                  })()}
                </div>
              ))}
            </div>

            {pendingCount > 0 && (
              <p className="text-faint mt-3 text-[12px]">
                {pendingCount} pending invitation{pendingCount === 1 ? '' : 's'}
              </p>
            )}
          </div>

          {/* Milestones */}
          <div className="card px-6 py-5">
            <div className="mb-4 flex items-center gap-2">
              <MilestoneIcon size={15} className="text-faint" />
              <h4 className="text-[13px] font-[650]">Milestones</h4>
              <span className="text-faint text-[12px]">({milestonesError ? '—' : milestones.length})</span>
            </div>

            {milestonesError && <SectionError message="Failed to load milestones." onRetry={refetchMilestones} />}

            {!milestonesError && milestones.length === 0 && (
              <div className="bg-subtle text-faint mb-3 flex items-center gap-2 rounded-md px-3 py-2.5 text-[12px]">
                <MilestoneIcon size={14} />
                No milestones yet.
              </div>
            )}

            <div className="mb-3 flex flex-col gap-2">
              {milestones.map((ms) => (
                <div key={ms.id} className="border-border group flex items-center gap-3 rounded-md border px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-ink truncate text-[13px] font-semibold">{ms.title}</p>
                      <Badge tone={ms.status}>{humanizeEnum(ms.status)}</Badge>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="max-w-[140px] flex-1">
                        <ProgressBar percent={Number(ms.progress ?? 0)} height={5} />
                      </div>
                      <span className="text-faint text-[12px]">{formatDate(ms.dueDate)}</span>
                    </div>
                  </div>
                  {canDeleteMilestone && (
                    <button
                      type="button"
                      className="icon-btn h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 hover:text-danger-ink"
                      aria-label="Delete milestone"
                      onClick={() => handleDeleteMilestone(ms.id)}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {canCreateMilestone && (
              // flex-wrap (not a flex-col/flex-row breakpoint switch) because
              // this form's actual available width depends on the
              // Members/Milestones grid above going 1 or 2 columns, which is
              // a container-relative break, not one a fixed sm:/lg: prefix
              // can track — the date input + button need to be free to wrap
              // under the title input whenever the row is too narrow for all
              // three, not just under one fixed viewport width. min-w-0
              // lets the title input actually shrink to fit instead of
              // forcing the row to overflow the card before that wrap can
              // kick in (the classic flex-item intrinsic-min-width trap).
              <form onSubmit={handleAddMilestone} className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  placeholder="Milestone title…"
                  className="field field-sm min-w-0 flex-1 basis-[140px]"
                />
                <input
                  type="date"
                  aria-label="Milestone due date"
                  value={milestoneDue}
                  onChange={(e) => setMilestoneDue(e.target.value)}
                  min={project.startDate}
                  max={project.endDate}
                  className="field field-sm"
                />
                <button
                  type="submit"
                  className="btn btn-secondary px-3 py-2 text-[12px]"
                  disabled={addingMilestone || !milestoneTitle.trim() || !milestoneDue}
                >
                  <Plus size={14} /> Add
                </button>
              </form>
            )}
          </div>

          {/* Files attached to the project itself (task files live in the task panel) */}
          <div className="card px-6 py-5">
            <AttachmentsSection
              projectId={projectId}
              canUpload={can('ATTACHMENT', 'CREATE', projectId)}
              canDelete={can('ATTACHMENT', 'DELETE', projectId)}
              currentUserId={profile?.id}
            />
          </div>

          <ProjectActivity projectId={projectId} />
        </div>
      </div>

      {transferTarget && (
        <ConfirmDialog
          title="Transfer ownership"
          message={`Make ${transferTarget.user.fullName} the Owner of "${project.name}"? You become a Team Leader of this project, and ${transferTarget.user.fullName} becomes its manager. A project has exactly one Owner.`}
          confirmLabel="Transfer ownership"
          tone="primary"
          loading={roleBusyId === transferTarget.id}
          onConfirm={() => changeRole(transferTarget, 'OWNER')}
          onClose={() => setTransferTarget(null)}
        />
      )}

      {activeTask && (
        <TaskDetailPanel task={activeTask} onClose={() => setActiveTaskId(null)} onChange={refetchAfterTaskChange} />
      )}

      {showNewTask && (
        <TaskFormModal
          defaultProjectId={projectId}
          onClose={() => setShowNewTask(false)}
          onSaved={refetchAfterTaskChange}
        />
      )}

      {showAddMember && (
        <AddProjectMemberModal
          projectId={projectId}
          onClose={() => setShowAddMember(false)}
          onInvited={() => {
            refetchMembers()
            refetchPending()
          }}
        />
      )}

      {editing && (
        <NewProjectModal project={project} onClose={() => setEditing(false)} onSaved={refetch} />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete project"
          message={`Delete "${project.name}"? This permanently removes the project and everything in it — tasks, subtasks, milestones, and comments. This can't be undone.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDeleteConfirm}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
