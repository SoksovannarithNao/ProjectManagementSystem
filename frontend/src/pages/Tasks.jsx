import { useMemo, useState } from 'react'
import {
  Plus,
  SlidersHorizontal,
  ArrowUpDown,
  CheckCircle2,
  CircleDot,
  Circle,
  MoreHorizontal,
  GripVertical,
  ClipboardList,
  Pencil,
  Trash2,
  Check,
} from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { AvatarGroup } from '../components/ui/Avatar'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { TaskFormModal } from '../components/TaskFormModal'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { Dropdown } from '../components/ui/Dropdown'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthContext'
import { canCreateTask, canManageTask } from '../api/permissions'
import { useApi } from '../api/useApi'
import { getTasks, advanceTaskStatus, deleteTask } from '../api/tasks'
import { getTaskAssignees } from '../api/taskAssignees'
import { getProjects } from '../api/projects'
import { buildTaskAssigneeMap } from '../api/relations'
import { humanizeEnum } from '../api/format'

function hashStr(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

const PILL_COLORS = [
  { bg: '#E7F5EA', text: '#4B8B5E' },
  { bg: '#FBEAEC', text: '#C2596B' },
  { bg: '#FDEEE1', text: '#C07A3E' },
  { bg: '#FCF3D9', text: '#B08A2E' },
  { bg: '#E8EFFC', text: '#4C6FB9' },
  { bg: '#F2E9FB', text: '#8B5CB9' },
]

function pillColor(key) {
  return PILL_COLORS[hashStr(key || '') % PILL_COLORS.length]
}

// Only "To do" can add a new task directly — tasks reach Doing/Done by being
// moved forward from there (via the status control), never created into them.
const SECTIONS = [
  { key: 'todo', title: 'To do', match: (status) => status === 'TO_DO', canAdd: true },
  { key: 'doing', title: 'Doing', match: (status) => status === 'IN_PROGRESS' || status === 'IN_REVIEW', canAdd: false },
  { key: 'done', title: 'Done', match: (status) => status === 'COMPLETED' || status === 'CANCELLED', canAdd: false },
]

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const PRIORITY_RANK = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const SORT_OPTIONS = [
  { id: 'dueDate', label: 'Due date' },
  { id: 'priority', label: 'Priority' },
  { id: 'title', label: 'Title (A–Z)' },
]
const SORTERS = {
  dueDate: (a, b) => new Date(a.dueDate ?? '9999-12-31') - new Date(b.dueDate ?? '9999-12-31'),
  priority: (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
  title: (a, b) => (a.title ?? '').localeCompare(b.title ?? ''),
}

export function Tasks() {
  const { role } = useAuth()
  const notify = useToast()
  const { data: tasks, loading, refetch } = useApi(getTasks)
  const { data: taskAssignees } = useApi(getTaskAssignees)
  const { data: projects } = useApi(getProjects)
  const [activeTask, setActiveTask] = useState(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [deletingTask, setDeletingTask] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState(() => new Set())
  const [projectFilter, setProjectFilter] = useState('')
  const [sortBy, setSortBy] = useState('dueDate')
  const canAddTasks = canCreateTask(role)
  const canManage = canManageTask(role)

  const assigneeMap = useMemo(() => buildTaskAssigneeMap(taskAssignees), [taskAssignees])
  const list = useMemo(() => tasks ?? [], [tasks])
  const activeFilterCount = priorityFilter.size + (projectFilter ? 1 : 0)

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list.filter((t) => {
      if (q) {
        const haystack = `${t.title ?? ''} ${t.description ?? ''} ${t.project?.name ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (priorityFilter.size > 0 && !priorityFilter.has(t.priority)) return false
      if (projectFilter && String(t.project?.id) !== projectFilter) return false
      return true
    })
  }, [list, search, priorityFilter, projectFilter])

  const togglePriorityFilter = (p) => {
    setPriorityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const advanceTask = async (task, e) => {
    e.stopPropagation()
    try {
      await advanceTaskStatus(task)
      refetch()
    } catch (err) {
      notify(err.message || 'Failed to update task', { tone: 'error' })
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingTask) return
    setDeleting(true)
    try {
      await deleteTask(deletingTask.id)
      const title = deletingTask.title
      setDeletingTask(null)
      refetch()
      notify(`Task "${title}" deleted`, { tone: 'success' })
    } catch (err) {
      notify(err.message || 'Failed to delete task', { tone: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <TopBar
        title="My Tasks"
        subtitle={`${list.length} tasks across all your projects`}
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

            <Dropdown
              button={({ toggle }) => (
                <button className="btn btn-secondary" onClick={toggle}>
                  <ArrowUpDown size={15} /> Sort
                </button>
              )}
            >
              {({ close }) => (
                <div className="flex flex-col gap-0.5 p-1">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`hover:bg-subtle flex items-center justify-between gap-4 rounded-sm px-2 py-1.5 text-left text-[13px] ${
                        sortBy === opt.id ? 'text-ink font-semibold' : 'text-muted'
                      }`}
                      onClick={() => {
                        setSortBy(opt.id)
                        close()
                      }}
                    >
                      {opt.label}
                      {sortBy === opt.id && <Check size={14} />}
                    </button>
                  ))}
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

      <div className="flex flex-col gap-6">
        {SECTIONS.map((section) => {
          const sectionTasks = filteredList.filter((t) => section.match(t.status)).sort(SORTERS[sortBy])
          return (
            <div
              key={section.key}
              className="rounded-2xl p-4 sm:p-5"
              style={{ background: 'rgba(40, 43, 50, 0.2)' }}
            >
              <div className="mb-3.5 flex items-center justify-between px-1">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-ink text-[15px] font-[650]">{section.title}</h3>
                  <span className="text-[17px] font-bold" style={{ color: 'rgba(40, 24, 27, 0.85)' }}>{sectionTasks.length}</span>
                </div>
                {section.canAdd && canAddTasks && (
                  <button
                    className="hover:text-ink duration-[var(--duration-fast)] ease-[var(--ease-standard)] inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#3a3a3d] transition-colors"
                    onClick={() => setShowNewTask(true)}
                  >
                    <Plus size={14} /> Add task
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                {loading &&
                  Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-card border-border flex items-center gap-3 rounded-[13px] border px-4 py-3"
                    >
                      <Skeleton className="h-[18px] w-[18px] shrink-0 rounded-full" />
                      <Skeleton className="h-3.5 flex-1" />
                      <Skeleton className="h-6 w-[110px] shrink-0 rounded-full" />
                    </div>
                  ))}
                {!loading && sectionTasks.length === 0 && (
                  <EmptyState
                    icon={ClipboardList}
                    title={list.length === 0 ? 'No tasks here yet' : 'No tasks match your search/filters'}
                    subtitle={section.canAdd && canAddTasks && list.length === 0 ? 'Add one to get started.' : undefined}
                  />
                )}
                {sectionTasks.map((t, i) => {
                  const assigneeIds = assigneeMap.get(t.id) ?? []
                  const pill = pillColor(t.project?.name)
                  const done = t.status === 'COMPLETED'
                  const doing = t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW'
                  const advanceLabel = t.status === 'TO_DO'
                    ? 'Move to Doing'
                    : doing
                      ? 'Mark as Done'
                      : 'Reopen as To do'

                  return (
                    <div
                      key={t.id}
                      onClick={() => setActiveTask({ ...t, assigneeIds })}
                      className="group bg-card border-border shadow-card hover:shadow-card-hover duration-[var(--duration-med)] ease-[var(--ease-standard)] animate-fade-in flex cursor-pointer flex-wrap items-center gap-3 rounded-[13px] border px-4 py-3 transition hover:-translate-y-px sm:flex-nowrap"
                      style={{ animationDelay: `${Math.min(i, 8) * 30}ms`, animationFillMode: 'backwards' }}
                    >
                      <GripVertical size={14} className="text-faint hidden shrink-0 sm:block" />

                      <button
                        onClick={(e) => advanceTask(t, e)}
                        className="shrink-0"
                        aria-label={advanceLabel}
                        title={advanceLabel}
                      >
                        {done ? (
                          <CheckCircle2 size={18} color="var(--status-success)" />
                        ) : doing ? (
                          <CircleDot size={18} className="text-info" />
                        ) : (
                          <Circle size={18} className="text-faint" />
                        )}
                      </button>

                      <div className="min-w-[140px] flex-1">
                        <p
                          className={`truncate text-[13.5px] font-semibold ${done ? 'text-faint line-through' : 'text-ink'}`}
                        >
                          {t.title}
                        </p>
                        {t.description && (
                          <p className="text-muted mt-0.5 truncate text-[12px]">{t.description}</p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="flex w-7 shrink-0 items-center justify-center">
                          {assigneeIds.length > 0 && <AvatarGroup memberIds={assigneeIds} size={28} />}
                        </div>
                        <span
                          className="w-[110px] shrink-0 rounded-full px-2.5 py-1 text-center text-[11px] font-semibold whitespace-nowrap"
                          style={{ background: pill.bg, color: pill.text }}
                        >
                          {t.project?.name}
                        </span>
                        {canManage && (
                          <Dropdown
                            align="right"
                            button={({ toggle }) => (
                              <button
                                className="icon-btn h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggle()
                                }}
                                aria-label="More actions"
                              >
                                <MoreHorizontal size={16} />
                              </button>
                            )}
                          >
                            {({ close }) => (
                              <div className="flex flex-col gap-0.5 p-1">
                                <button
                                  type="button"
                                  className="hover:bg-subtle flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px]"
                                  onClick={() => {
                                    setEditingTask(t)
                                    close()
                                  }}
                                >
                                  <Pencil size={14} /> Edit
                                </button>
                                <button
                                  type="button"
                                  className="hover:bg-subtle text-danger flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px]"
                                  onClick={() => {
                                    setDeletingTask(t)
                                    close()
                                  }}
                                >
                                  <Trash2 size={14} /> Delete
                                </button>
                              </div>
                            )}
                          </Dropdown>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
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

      {editingTask && (
        <TaskFormModal task={editingTask} onClose={() => setEditingTask(null)} onSaved={refetch} />
      )}

      {deletingTask && (
        <ConfirmDialog
          title="Delete task"
          message={`Delete "${deletingTask.title}"? This can't be undone.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeletingTask(null)}
        />
      )}
    </div>
  )
}
