import { useMemo, useState } from 'react'
import { Plus, SlidersHorizontal, LayoutGrid, AlertTriangle, Lock, ListChecks } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { TaskFormModal } from '../components/TaskFormModal'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { Dropdown } from '../components/ui/Dropdown'
import { useMembers } from '../data/UsersContext'
import { useAuth } from '../auth/AuthContext'
import { canEditProjectContent } from '../api/permissions'
import { useApi } from '../api/useApi'
import { getTasks } from '../api/tasks'
import { getTaskAssignees } from '../api/taskAssignees'
import { getProjects } from '../api/projects'
import { getProjectMembers } from '../api/projectMembers'
import { buildTaskAssigneeMap, buildMyProjectRoleMap } from '../api/relations'
import { groupTasksByStatus } from '../api/stats'
import { formatDate, humanizeEnum, taskDisplayTitle, blockedReason } from '../api/format'

const COLUMN_ACCENT = {
  TO_DO: 'bg-faint',
  IN_PROGRESS: 'bg-info',
  IN_REVIEW: 'bg-warning',
  COMPLETED: 'bg-success',
}

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

export function Kanban() {
  const { role, profile } = useAuth()
  const { getMember } = useMembers()
  const { data: tasks, loading, error: tasksError, refetch } = useApi(getTasks)
  const { data: taskAssignees, refetch: refetchAssignees } = useApi(getTaskAssignees)
  const { data: projects } = useApi(getProjects)
  const { data: projectMembers } = useApi(getProjectMembers)
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState(() => new Set())
  const [projectFilter, setProjectFilter] = useState('')
  const isSystemAdmin = role === 'ADMINISTRATOR'
  const myProjectRoleMap = useMemo(
    () => buildMyProjectRoleMap(projectMembers, profile?.id),
    [projectMembers, profile]
  )
  // Whether there's at least one project the caller can add tasks to —
  // gates the top-level "New Task" affordances; TaskFormModal itself only
  // offers projects the caller can actually create tasks in.
  const canAddTasks =
    isSystemAdmin || Array.from(myProjectRoleMap.values()).some((r) => canEditProjectContent(r, false))
  const activeFilterCount = priorityFilter.size + (projectFilter ? 1 : 0)

  const assigneeMap = useMemo(() => buildTaskAssigneeMap(taskAssignees), [taskAssignees])

  // Derived (never copied into its own state) so the open detail panel
  // always reflects the live list — see the identical pattern (and its
  // comment) in Tasks.jsx.
  const activeTask = useMemo(() => {
    if (activeTaskId == null) return null
    const t = (tasks ?? []).find((task) => task.id === activeTaskId)
    return t ? { ...t, assigneeIds: assigneeMap.get(t.id) ?? [] } : null
  }, [activeTaskId, tasks, assigneeMap])

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (tasks ?? []).filter((t) => {
      if (q) {
        const haystack = `${t.title ?? ''} ${t.project?.name ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (priorityFilter.size > 0 && !priorityFilter.has(t.priority)) return false
      if (projectFilter && String(t.project?.id) !== projectFilter) return false
      return true
    })
  }, [tasks, search, priorityFilter, projectFilter])

  const columns = useMemo(() => groupTasksByStatus(filteredTasks, { includeBlocked: true }), [filteredTasks])

  const refetchAll = () => {
    refetch()
    refetchAssignees()
  }

  const togglePriorityFilter = (p) => {
    setPriorityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  return (
    <div>
      <TopBar
        title="Kanban Board"
        subtitle="Track progress across stages"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search tasks"
        actions={
          <>
            <Dropdown
              button={({ toggle }) => (
                <button className="btn btn-secondary min-w-[112px]" onClick={toggle}>
                  <SlidersHorizontal size={15} /> Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </button>
              )}
            >
              {({ close }) => (
                <div className="flex w-[220px] flex-col gap-3 p-1">
                  <div>
                    <span className="text-faint mb-1.5 block text-[11px] font-[650] tracking-[0.04em] uppercase">
                      Priority
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {PRIORITY_OPTIONS.map((p) => (
                        <label
                          key={p}
                          className="hover:bg-subtle flex items-center gap-2 rounded-sm px-1.5 py-1 text-[13px]"
                        >
                          <input type="checkbox" checked={priorityFilter.has(p)} onChange={() => togglePriorityFilter(p)} />
                          {humanizeEnum(p)}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-faint mb-1.5 block text-[11px] font-[650] tracking-[0.04em] uppercase">
                      Project
                    </span>
                    <select
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value)}
                      className="bg-subtle border-border h-9 w-full rounded-md border px-2 text-[12.5px] outline-none"
                    >
                      <option value="">All projects</option>
                      {projects?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      className="text-muted hover:text-ink text-left text-[12px] font-semibold"
                      onClick={() => {
                        setPriorityFilter(new Set())
                        setProjectFilter('')
                        close()
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </Dropdown>
            {canAddTasks && (
              <button className="btn btn-primary" onClick={() => setShowNewTask(true)}>
                <Plus size={16} /> New Task
              </button>
            )}
          </>
        }
      />

      {!loading && tasksError && (
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          subtitle={tasksError.message || 'Failed to load tasks. Please try again.'}
          action={
            <button type="button" className="btn btn-secondary" onClick={refetch}>
              Try again
            </button>
          }
        />
      )}

      {!tasksError && (
      <div className="scroll-x flex items-start gap-[18px] pb-2">
        {columns.map((col) => (
          <div
            key={col.id}
            className="bg-container border-divider flex w-[268px] shrink-0 flex-col gap-2.5 rounded-md border p-3.5"
          >
            <div className="flex items-center justify-between px-1 pt-0.5 pb-1.5">
              <span className="inline-flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${COLUMN_ACCENT[col.status] ?? 'bg-faint'}`} />
                <span className="text-ink text-[13px] font-[650]">{col.title}</span>
              </span>
              <span className="text-faint bg-card border-border rounded-full border px-2 text-[11px]">
                {col.tasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="scroll-y flex max-h-[650px] flex-col gap-2.5 pr-0.5">
                {loading &&
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="bg-card border-border rounded-[10px] border p-[13px]">
                      <Skeleton className="mb-2.5 h-2.5 w-16" />
                      <Skeleton className="mb-2.5 h-3.5 w-full" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                  ))}
                {!loading && col.tasks.length === 0 && (
                  <EmptyState
                    icon={col.id === 'blocked' ? Lock : LayoutGrid}
                    title={col.id === 'blocked' ? 'No blocked tasks' : 'No tasks'}
                  />
                )}
                {col.tasks.map((task, i) => {
                  const assigneeIds = assigneeMap.get(task.id) ?? []
                  const member = getMember(assigneeIds[0])
                  return (
                    <button
                      key={task.id}
                      className="bg-card border-border shadow-card hover:shadow-card-hover duration-[var(--duration-med)] ease-[var(--ease-standard)] animate-fade-in shrink-0 rounded-[10px] border p-[13px] text-left transition hover:-translate-y-px"
                      style={{ animationDelay: `${Math.min(i, 8) * 30}ms`, animationFillMode: 'backwards' }}
                      onClick={() => setActiveTaskId(task.id)}
                    >
                      <span className="text-faint text-[10.5px] font-[650] tracking-[0.04em] uppercase">
                        {task.project?.name}
                      </span>
                      <p className="text-ink mt-2 mb-1.5 text-[13px] leading-normal font-semibold">
                        {taskDisplayTitle(task.title, task.project?.name)}
                      </p>
                      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge tone={task.priority}>{humanizeEnum(task.priority)}</Badge>
                        {task.totalSubtasks > 0 && (
                          <span className="text-muted inline-flex items-center gap-1 text-[11px]">
                            <ListChecks size={11} />
                            {task.completedSubtasks}/{task.totalSubtasks}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] ${task.overdue ? 'text-danger font-semibold' : 'text-muted'}`}
                        >
                          {task.blocked && (
                            <span title={blockedReason(task)} className="inline-flex shrink-0">
                              <Lock size={11} />
                            </span>
                          )}
                          {task.overdue && <AlertTriangle size={11} className="shrink-0" />}
                          {formatDate(task.dueDate)}
                        </span>
                        {member && (
                          <Avatar
                            initials={member.initials}
                            color={member.color}
                            photoUrl={member.photoUrl}
                            size={24}
                            title={member.name}
                          />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              {col.id === 'todo' && canAddTasks && (
                <button
                  className="text-faint hover:bg-card hover:text-ink duration-[var(--duration-fast)] ease-[var(--ease-standard)] flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-none p-2.5 text-[12.5px] transition-colors"
                  onClick={() => setShowNewTask(true)}
                >
                  <Plus size={14} /> Add task
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {activeTask && (
        <TaskDetailPanel
          key={activeTask.id}
          task={activeTask}
          onClose={() => setActiveTaskId(null)}
          onChange={refetchAll}
        />
      )}

      {showNewTask && <TaskFormModal onClose={() => setShowNewTask(false)} onSaved={refetchAll} />}
    </div>
  )
}
