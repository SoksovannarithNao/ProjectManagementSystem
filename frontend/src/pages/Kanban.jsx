import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, SlidersHorizontal, LayoutGrid, AlertTriangle, Lock, ListChecks } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { TimeChip } from '../components/ui/TimeChip'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { TaskFormModal } from '../components/TaskFormModal'
import { KanbanMoveMenu } from '../components/KanbanMoveMenu'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { Dropdown } from '../components/ui/Dropdown'
import { useToast } from '../components/ui/Toast'
import { useMembers } from '../data/UsersContext'
import { useAuth } from '../auth/AuthContext'
import { useApi } from '../api/useApi'
import { getKanbanColumnPage, getTaskById, KANBAN_COLUMNS, moveTaskToStatus, checkTaskMove, KANBAN_STATUS_LABELS } from '../api/tasks'
import { getProjects } from '../api/projects'
import { canApproveTask } from '../api/permissions'
import { formatDate, humanizeEnum, taskDisplayTitle, blockedReason } from '../api/format'
import { ApprovalChip } from '../components/ApprovalChip'
import { DueSoonBadge } from '../components/DueSoonBadge'

const COLUMN_ACCENT = {
  TODO: 'bg-faint',
  IN_PROGRESS: 'bg-info',
  IN_REVIEW: 'bg-warning',
  COMPLETED: 'bg-success',
}

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

// Each column reads its cards from the server 25 at a time ("Show more" reads the next 25), with its own total.
const PAGE_SIZE = 25

// The status a column stands for when a card is dropped on it; the Blocked column is not one.
const columnTarget = (col) => (col.id === 'blocked' ? 'BLOCKED' : col.status)

export function Kanban() {
  const { canAny, can, permissions, profile } = useAuth()
  const notify = useToast()
  const { getMember } = useMembers()
  const { data: projects } = useApi(getProjects)
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState(() => new Set())
  const [projectFilter, setProjectFilter] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const [board, setBoard] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [loadingMore, setLoadingMore] = useState(null)
  const [fetchedTask, setFetchedTask] = useState(null)
  // A card being dragged, the column under it, and the card whose move is being saved.
  const [dragTask, setDragTask] = useState(null)
  const [overColumn, setOverColumn] = useState(null)
  const [movingId, setMovingId] = useState(null)
  // Whether there's at least one project the caller can add tasks to —
  // gates the top-level "New Task" affordances; TaskFormModal itself only
  // offers projects the caller can actually create tasks in.
  // A completed project takes no new tasks (D-27) and the form lists only the others, so the buttons
  // are offered only while some project in view (the filtered one, or any) can still take a task.
  const canAddTasks =
    projects == null
      ? canAny('TASK', 'CREATE')
      : projects.some(
          (p) =>
            p.status !== 'COMPLETED' && can('TASK', 'CREATE', p.id) && (!projectFilter || String(p.id) === projectFilter)
        )
  const activeFilterCount = priorityFilter.size + (projectFilter ? 1 : 0)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])
  const filters = useMemo(
    () => ({ search: debouncedSearch, priorities: Array.from(priorityFilter), projectId: projectFilter }),
    [debouncedSearch, priorityFilter, projectFilter]
  )

  // Every column is read from the server on its own (its cards and its total), under the board's filters.
  // How many pages each column has on screen is kept, so reloading after a move reads as many again
  // instead of dropping every column back to its first cards.
  const loaded = useRef({ filters: null, pages: {} })
  useEffect(() => {
    if (loaded.current.filters !== filters) loaded.current = { filters, pages: {} }
    const state = loaded.current
    let cancelled = false
    Promise.all(
      KANBAN_COLUMNS.map((col) =>
        Promise.all(
          Array.from({ length: state.pages[col.id] ?? 1 }, (_, p) => getKanbanColumnPage(filters, col, p, PAGE_SIZE))
        ).then((pages) => [col.id, { items: pages.flatMap((r) => r.items), total: pages[0].total }])
      )
    )
      .then((entries) => {
        if (cancelled) return
        setBoard({ for: filters, tick: reloadTick, cols: Object.fromEntries(entries) })
        setLoadError(null)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err)
      })
    return () => {
      cancelled = true
    }
  }, [filters, reloadTick])

  const loadMore = async (col) => {
    const state = loaded.current
    const next = state.pages[col.id] ?? 1
    setLoadingMore(col.id)
    try {
      const page = await getKanbanColumnPage(filters, col, next, PAGE_SIZE)
      if (loaded.current !== state) return // the search or a filter changed meanwhile
      state.pages[col.id] = next + 1
      setBoard((prev) => ({
        ...prev,
        cols: { ...prev.cols, [col.id]: { items: [...prev.cols[col.id].items, ...page.items], total: page.total } },
      }))
    } catch (err) {
      notify(err.message || 'Failed to load more tasks', { tone: 'error' })
    } finally {
      setLoadingMore(null)
    }
  }

  const columns = useMemo(
    () => KANBAN_COLUMNS.map((def) => ({ ...def, tasks: board?.cols[def.id]?.items ?? [], total: board?.cols[def.id]?.total ?? 0 })),
    [board]
  )
  const loading = board == null && !loadError
  // Whether the board shows the data for the search, filters and reload asked for (the search waits a moment before it is
  // sent, and every read is a request): announced as aria-busy so that a screen reader, and a test, can tell.
  const settled = board != null && board.for === filters && board.tick === reloadTick && debouncedSearch === search
  const tasksError = loadError
  const refetchAll = () => setReloadTick((n) => n + 1)
  const refetch = refetchAll

  // The open task is read on its own as well, so the panel still shows a card the board does not hold:
  // one a move has just taken into a column whose first cards are on screen, or out of the filters.
  useEffect(() => {
    if (activeTaskId == null) return
    let cancelled = false
    getTaskById(activeTaskId)
      .then((t) => {
        if (!cancelled) setFetchedTask(t)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [activeTaskId, reloadTick])

  // Derived (never copied into its own state) so the open detail panel
  // always reflects the live list — see the identical pattern (and its
  // comment) in Tasks.jsx.
  const activeTask = useMemo(() => {
    if (activeTaskId == null) return null
    const t =
      columns.flatMap((c) => c.tasks).find((task) => task.id === activeTaskId) ??
      (fetchedTask?.id === activeTaskId ? fetchedTask : null)
    return t ? { ...t, assigneeIds: t.assigneeIds ?? [] } : null
  }, [activeTaskId, columns, fetchedTask])

  // What this person may do to one task's status: an editor, or an assignee (TASK_STATUS:EDIT);
  // completing it is an approval. The server checks again.
  const abilitiesFor = (task) => {
    const projectId = task.project?.id
    const isAssignee = (task.assigneeIds ?? []).includes(profile?.id)
    return {
      canChange: can('TASK', 'EDIT', projectId) || (can('TASK_STATUS', 'EDIT', projectId) && isAssignee),
      canApprove: canApproveTask(permissions, profile?.id, task, isAssignee),
    }
  }

  // Moves a card to a status, from a drop or the "Move to" menu. A move the rules refuse
  // says why; one that changes nothing is silent.
  const moveTask = async (task, target) => {
    // One move at a time per card: a second drop while the first is saving would resend a stale task.
    if (movingId === task.id || task.status === target) return
    setMovingId(task.id)
    try {
      // Reads the task again and checks the rules against what it finds, never against the
      // board's copy, which may be out of date (see moveTaskToStatus).
      const result = await moveTaskToStatus(task, target, abilitiesFor)
      if (result.moved) {
        notify(`Moved "${taskDisplayTitle(task.title, task.project?.name)}" to ${KANBAN_STATUS_LABELS[target]}`, { tone: 'success' })
      } else if (result.message) {
        notify(result.message, { tone: result.stale ? 'info' : 'error' })
      }
      // Whatever happened, show the server's version of the board.
      refetchAll()
    } catch (err) {
      notify(err.message || 'Failed to move the task', { tone: 'error' })
      refetchAll()
    } finally {
      setMovingId(null)
    }
  }

  const endDrag = () => {
    setDragTask(null)
    setOverColumn(null)
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
                    <span className="text-faint mb-1.5 block text-[12px] font-[650] tracking-[0.04em] uppercase">
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
                    <span className="text-faint mb-1.5 block text-[12px] font-[650] tracking-[0.04em] uppercase">
                      Project
                    </span>
                    <select
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value)}
                      className="field field-sm w-full"
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
      <div data-testid="kanban-board" aria-busy={!settled} className="scroll-x flex items-start gap-[18px] pb-2">
        {columns.map((col) => {
          // While a card is dragged, the column under it shows whether the drop would be accepted.
          const dropState =
            dragTask && overColumn === col.id
              ? checkTaskMove(dragTask, columnTarget(col), abilitiesFor(dragTask)).ok
                ? 'ok'
                : 'refused'
              : null
          return (
          <div
            key={col.id}
            data-testid={`kanban-column-${col.id}`}
            onDragOver={(e) => {
              if (!dragTask) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (overColumn !== col.id) setOverColumn(col.id)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget) && overColumn === col.id) setOverColumn(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              const task = dragTask
              endDrag()
              if (task) moveTask(task, columnTarget(col))
            }}
            className={`bg-container flex w-[268px] shrink-0 flex-col gap-2.5 rounded-md border p-3.5 transition-colors ${
              dropState === 'ok'
                ? 'border-focus bg-info-soft'
                : dropState === 'refused'
                  ? 'border-danger border-dashed'
                  : 'border-divider'
            }`}
          >
            <div className="flex items-center justify-between px-1 pt-0.5 pb-1.5">
              <span className="inline-flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${COLUMN_ACCENT[col.status] ?? 'bg-faint'}`} />
                <span className="text-ink text-[13px] font-[650]">{col.title}</span>
              </span>
              <span className="text-faint bg-card border-border rounded-full border px-2 text-[12px]">
                {col.total}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="scroll-y flex max-h-[650px] flex-col gap-2.5 pr-0.5">
                {loading &&
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="bg-card border-border rounded-md border p-[13px]">
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
                  const assigneeIds = task.assigneeIds ?? []
                  const member = getMember(assigneeIds[0])
                  // A card can be dragged, and has a "Move to" menu, only for someone who may change its status.
                  const abilities = abilitiesFor(task)
                  const movable = abilities.canChange
                  const saving = movingId === task.id
                  return (
                    <div
                      key={task.id}
                      data-testid="kanban-card"
                      data-task-id={task.id}
                      draggable={movable && !saving}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', String(task.id))
                        setDragTask(task)
                      }}
                      onDragEnd={endDrag}
                      aria-busy={saving}
                      className={`bg-card border-border hover:shadow-card-hover duration-[var(--duration-med)] ease-[var(--ease-standard)] animate-fade-in relative shrink-0 rounded-md border text-left transition hover:-translate-y-px ${
                        movable ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${dragTask?.id === task.id || saving ? 'opacity-50' : ''}`}
                      style={{ animationDelay: `${Math.min(i, 8) * 30}ms`, animationFillMode: 'backwards' }}
                    >
                    <div
                      role="button"
                      tabIndex={0}
                      className="block w-full p-[13px] text-left"
                      onClick={() => setActiveTaskId(task.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setActiveTaskId(task.id)
                        }
                      }}
                    >
                      <span className="text-muted block pr-8 text-[12px] font-medium">
                        {task.project?.name}
                      </span>
                      <p className="text-ink mt-2 mb-1.5 text-[13px] leading-normal font-semibold">
                        {taskDisplayTitle(task.title, task.project?.name)}
                      </p>
                      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge tone={task.priority}>{humanizeEnum(task.priority)}</Badge>
                        <DueSoonBadge task={task} />
                        <TimeChip task={task} />
                        <ApprovalChip task={task} />
                        {task.totalSubtasks > 0 && (
                          <span className="text-muted inline-flex items-center gap-1 text-[12px]">
                            <ListChecks size={11} />
                            {task.completedSubtasks}/{task.totalSubtasks}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 text-[12px] ${task.overdue ? 'text-danger-ink font-semibold' : 'text-muted'}`}
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
                    </div>
                    {movable && (
                      <div className="absolute top-2 right-2">
                        <KanbanMoveMenu
                          task={task}
                          label={taskDisplayTitle(task.title, task.project?.name)}
                          abilities={abilities}
                          disabled={saving}
                          onMove={(target) => moveTask(task, target)}
                        />
                      </div>
                    )}
                    </div>
                  )
                })}
                {col.tasks.length < col.total && (
                  <button
                    type="button"
                    data-testid={`kanban-more-${col.id}`}
                    className="btn btn-secondary shrink-0 justify-center text-[12px]"
                    disabled={loadingMore === col.id}
                    onClick={() => loadMore(col)}
                  >
                    {loadingMore === col.id ? 'Loading…' : `Show more (${col.total - col.tasks.length} more)`}
                  </button>
                )}
              </div>
              {col.id === 'todo' && canAddTasks && (
                <button
                  className="text-faint hover:bg-card hover:text-ink duration-[var(--duration-fast)] ease-[var(--ease-standard)] flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-none p-2.5 text-[12px] transition-colors"
                  onClick={() => setShowNewTask(true)}
                >
                  <Plus size={14} /> Add task
                </button>
              )}
            </div>
          </div>
          )
        })}
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
