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
  FolderKanban,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { Avatar, AvatarGroup } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Dropdown } from '../components/ui/Dropdown'
import { useToast } from '../components/ui/Toast'
import { NewProjectModal } from '../components/NewProjectModal'
import { TaskFormModal } from '../components/TaskFormModal'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { useApi } from '../api/useApi'
import { useAuth } from '../auth/AuthContext'
import { getProjectById, updateProject, deleteProject, projectResponseToRequest } from '../api/projects'
import { getMembersByProjectId } from '../api/projectMembers'
import { getTasksByProjectId } from '../api/tasks'
import { getTaskAssignees } from '../api/taskAssignees'
import { getMilestonesByProjectId, createMilestone, deleteMilestone } from '../api/milestones'
import { buildTaskAssigneeMap } from '../api/relations'
import { canManageProject, canEditProjectContent, isProjectOwner } from '../api/permissions'
import { humanizeEnum, formatDate, initialsFor, colorForId, taskDisplayTitle, blockedReason } from '../api/format'
import { computeTaskOverview } from '../api/stats'

const PROJECT_STATUS_OPTIONS = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']
const TASK_STATUS_OPTIONS = ['TO_DO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED']
const TASK_PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

export function ProjectDetail() {
  const { id } = useParams()
  const projectId = Number(id)
  const navigate = useNavigate()
  const notify = useToast()
  const { profile, role } = useAuth()
  const isSystemAdmin = role === 'ADMINISTRATOR'

  const projectFetcher = useCallback(() => getProjectById(projectId), [projectId])
  const { data: project, loading, refetch } = useApi(projectFetcher)

  const membersFetcher = useCallback(() => getMembersByProjectId(projectId), [projectId])
  const { data: membersData } = useApi(membersFetcher)
  const members = useMemo(() => membersData ?? [], [membersData])

  const tasksFetcher = useCallback(() => getTasksByProjectId(projectId), [projectId])
  const { data: tasksData, refetch: refetchTasks } = useApi(tasksFetcher)
  const tasks = useMemo(() => tasksData ?? [], [tasksData])

  const milestonesFetcher = useCallback(() => getMilestonesByProjectId(projectId), [projectId])
  const { data: milestonesData, refetch: refetchMilestones } = useApi(milestonesFetcher)
  const milestones = useMemo(() => milestonesData ?? [], [milestonesData])

  const { data: taskAssignees } = useApi(getTaskAssignees)
  const assigneeMap = useMemo(() => buildTaskAssigneeMap(taskAssignees), [taskAssignees])

  // The caller's own ACTIVE membership row for THIS project — same source
  // ProjectAccessGuard uses on the backend, just read from the member list
  // already fetched above instead of a separate lookup.
  const myRole = useMemo(
    () => members.find((m) => m.user?.id === profile?.id && m.status === 'ACTIVE')?.projectRole,
    [members, profile]
  )
  const canManage = canManageProject(myRole, isSystemAdmin)
  const canDelete = isProjectOwner(myRole, isSystemAdmin)
  // Content creation (tasks/milestones) only needs OWNER/ADMIN/MEMBER, not
  // canManage's OWNER/ADMIN-only bar — a plain MEMBER can add tasks to a
  // project they don't manage, same as Tasks.jsx's own "+ New Task" gate.
  const canAddContent = canEditProjectContent(myRole, isSystemAdmin)

  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [taskStatusFilter, setTaskStatusFilter] = useState(() => new Set())
  const [taskPriorityFilter, setTaskPriorityFilter] = useState(() => new Set())
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDue, setMilestoneDue] = useState('')
  const [addingMilestone, setAddingMilestone] = useState(false)

  const activeTask = useMemo(() => {
    if (activeTaskId == null) return null
    const t = tasks.find((x) => x.id === activeTaskId)
    return t ? { ...t, assigneeIds: assigneeMap.get(t.id) ?? [] } : null
  }, [activeTaskId, tasks, assigneeMap])

  const taskOverview = useMemo(() => computeTaskOverview(tasks), [tasks])
  const overdueCount = useMemo(() => tasks.filter((t) => t.overdue).length, [tasks])
  const activeMembers = useMemo(() => members.filter((m) => m.status === 'ACTIVE'), [members])
  const pendingCount = useMemo(() => members.filter((m) => m.status === 'PENDING').length, [members])
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
    return (
      <div>
        <TopBar title="Project" />
        <EmptyState
          icon={FolderKanban}
          title="Project not found"
          subtitle="It may have been deleted, or you don't have access to it."
        />
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
          canManage && (
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                <Pencil size={15} /> Edit
              </button>
              {canDelete && (
                <button
                  className="btn bg-[#db7070] text-white hover:bg-danger"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 size={15} /> Delete
                </button>
              )}
            </>
          )
        }
      />

      <div className="flex flex-col gap-5">
        {/* Overview */}
        <div className="card px-6 py-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              value={project.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={!canManage || savingStatus}
              className="bg-subtle border-border h-8 rounded-full border px-2.5 text-[11.5px] font-semibold outline-none disabled:opacity-70"
            >
              {PROJECT_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {humanizeEnum(s)}
                </option>
              ))}
            </select>
            {project.priority && <Badge tone={project.priority}>{humanizeEnum(project.priority)}</Badge>}
            {overdueCount > 0 && (
              <span className="bg-danger-soft text-danger inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold">
                <AlertTriangle size={12} /> {overdueCount} overdue task{overdueCount === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {project.description && <p className="text-muted mb-5 text-[13.5px] leading-relaxed">{project.description}</p>}

          <div className="bg-subtle border-border mb-5 grid grid-cols-3 gap-4 rounded-md border p-4 max-sm:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                <CalendarDays size={14} /> Start date
              </span>
              <span className="text-ink text-[13px] font-semibold">{formatDate(project.startDate)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                <CalendarDays size={14} /> End date
              </span>
              <span className="text-ink text-[13px] font-semibold">{formatDate(project.endDate)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
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
              <h4 className="text-[13.5px] font-[650]">Tasks</h4>
              <span className="text-faint text-[12px]">({tasks.length})</span>
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
                      <span className="text-faint mb-1.5 block text-[11px] font-[650] tracking-[0.04em] uppercase">
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
                      <span className="text-faint mb-1.5 block text-[11px] font-[650] tracking-[0.04em] uppercase">
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

          {tasks.length === 0 && <p className="text-faint text-[12.5px]">No tasks in this project yet.</p>}

          {tasks.length > 0 && (
            <div className="mb-4 grid grid-cols-4 gap-3 max-sm:grid-cols-2">
              {taskOverview.map((t) => (
                <div key={t.key} className="bg-subtle rounded-md px-3 py-2.5">
                  <p className="text-ink text-[17px] font-bold">{t.count}</p>
                  <p className="text-muted text-[11px] font-semibold">{t.label}</p>
                </div>
              ))}
            </div>
          )}

          {tasks.length > 0 && filteredTasks.length === 0 && (
            <p className="text-faint text-[12.5px]">No tasks match the selected filters.</p>
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
                        <span title={blockedReason(t)} className="text-muted inline-flex items-center gap-1 text-[11px]">
                          <Lock size={11} /> Blocked
                        </span>
                      )}
                      {t.totalSubtasks > 0 && (
                        <span className="text-muted text-[11px]">
                          {t.completedSubtasks}/{t.totalSubtasks} subtasks
                        </span>
                      )}
                      {t.dueDate && (
                        <span className={`inline-flex items-center gap-1 text-[11px] ${t.overdue ? 'text-danger font-semibold' : 'text-muted'}`}>
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
                <h4 className="text-[13.5px] font-[650]">Members</h4>
                <span className="text-faint text-[12px]">({activeMembers.length})</span>
              </div>
              <Link to="/team" className="text-muted hover:text-ink text-[12px] font-semibold">
                Manage team →
              </Link>
            </div>

            {activeMembers.length === 0 && <p className="text-faint text-[12.5px]">No members yet.</p>}

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
                    {m.user.positionName && <p className="text-faint truncate text-[11px]">{m.user.positionName}</p>}
                  </div>
                  <Badge>{humanizeEnum(m.projectRole)}</Badge>
                </div>
              ))}
            </div>

            {pendingCount > 0 && (
              <p className="text-faint mt-3 text-[11.5px]">
                {pendingCount} pending invitation{pendingCount === 1 ? '' : 's'}
              </p>
            )}
          </div>

          {/* Milestones */}
          <div className="card px-6 py-5">
            <div className="mb-4 flex items-center gap-2">
              <MilestoneIcon size={15} className="text-faint" />
              <h4 className="text-[13.5px] font-[650]">Milestones</h4>
              <span className="text-faint text-[12px]">({milestones.length})</span>
            </div>

            {milestones.length === 0 && (
              <div className="bg-subtle text-faint mb-3 flex items-center gap-2 rounded-md px-3 py-2.5 text-[12.5px]">
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
                      <span className="text-faint text-[11px]">{formatDate(ms.dueDate)}</span>
                    </div>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      className="icon-btn h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 hover:text-danger"
                      aria-label="Delete milestone"
                      onClick={() => handleDeleteMilestone(ms.id)}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {canManage && (
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
                  className="bg-subtle border-border focus:border-lavender h-9 min-w-0 flex-1 basis-[140px] rounded-md border px-3 text-[12.5px] outline-none"
                />
                <input
                  type="date"
                  value={milestoneDue}
                  onChange={(e) => setMilestoneDue(e.target.value)}
                  min={project.startDate}
                  max={project.endDate}
                  className="bg-subtle border-border h-9 rounded-md border px-3 text-[12.5px] outline-none"
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
        </div>
      </div>

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
