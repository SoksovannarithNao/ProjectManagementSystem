import { useMemo, useState } from 'react'
import { Plus, SlidersHorizontal, LayoutGrid } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { Avatar } from '../components/ui/Avatar'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { TaskFormModal } from '../components/TaskFormModal'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { Dropdown } from '../components/ui/Dropdown'
import { useMembers } from '../data/UsersContext'
import { useAuth } from '../auth/AuthContext'
import { canCreateTask } from '../api/permissions'
import { useApi } from '../api/useApi'
import { getTasks } from '../api/tasks'
import { getTaskAssignees } from '../api/taskAssignees'
import { getProjects } from '../api/projects'
import { buildTaskAssigneeMap } from '../api/relations'
import { groupTasksByStatus } from '../api/stats'
import { formatDate, humanizeEnum } from '../api/format'

const COLUMN_ACCENT = {
  TO_DO: 'bg-faint',
  IN_PROGRESS: 'bg-info',
  IN_REVIEW: 'bg-warning',
  COMPLETED: 'bg-success',
}

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

export function Kanban() {
  const { role } = useAuth()
  const { getMember } = useMembers()
  const { data: tasks, loading, refetch } = useApi(getTasks)
  const { data: taskAssignees } = useApi(getTaskAssignees)
  const { data: projects } = useApi(getProjects)
  const [activeTask, setActiveTask] = useState(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState(() => new Set())
  const [projectFilter, setProjectFilter] = useState('')
  const canAddTasks = canCreateTask(role)
  const activeFilterCount = priorityFilter.size + (projectFilter ? 1 : 0)

  const assigneeMap = useMemo(() => buildTaskAssigneeMap(taskAssignees), [taskAssignees])

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

  const columns = useMemo(() => groupTasksByStatus(filteredTasks), [filteredTasks])

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
                <button className="btn btn-secondary" onClick={toggle}>
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

      <div className="scroll-x flex items-start gap-[18px] pb-2">
        {columns.map((col) => (
          <div
            key={col.id}
            className="bg-subtle border-divider flex w-[268px] shrink-0 flex-col gap-2.5 rounded-md border p-3.5"
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
              {loading &&
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="bg-card border-border rounded-[13px] border p-[13px]">
                    <Skeleton className="mb-2.5 h-2.5 w-16" />
                    <Skeleton className="mb-2.5 h-3.5 w-full" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                ))}
              {!loading && col.tasks.length === 0 && (
                <EmptyState icon={LayoutGrid} title="No tasks" />
              )}
              {col.tasks.map((task, i) => {
                const assigneeIds = assigneeMap.get(task.id) ?? []
                const member = getMember(assigneeIds[0])
                return (
                  <button
                    key={task.id}
                    className="bg-card border-border shadow-card hover:shadow-card-hover duration-[var(--duration-med)] ease-[var(--ease-standard)] animate-fade-in rounded-[13px] border p-[13px] text-left transition hover:-translate-y-px"
                    style={{ animationDelay: `${Math.min(i, 8) * 30}ms`, animationFillMode: 'backwards' }}
                    onClick={() => setActiveTask({ ...task, assigneeIds })}
                  >
                    <span className="text-faint text-[10.5px] font-[650] tracking-[0.04em] uppercase">
                      {task.project?.name}
                    </span>
                    <p className="text-ink my-2 text-[13px] leading-normal font-semibold">{task.title}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-muted text-[11px]">{formatDate(task.dueDate)}</span>
                      {member && (
                        <Avatar initials={member.initials} color={member.color} size={24} title={member.name} />
                      )}
                    </div>
                  </button>
                )
              })}
              {col.status === 'TO_DO' && canAddTasks && (
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

      {activeTask && (
        <TaskDetailPanel
          key={activeTask.id}
          task={activeTask}
          onClose={() => setActiveTask(null)}
          onChange={refetch}
        />
      )}

      {showNewTask && <TaskFormModal onClose={() => setShowNewTask(false)} onSaved={refetch} />}
    </div>
  )
}
