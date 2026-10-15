import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  SlidersHorizontal,
  ArrowUpDown,
  CheckCircle2,
  CircleDot,
  Circle,
  CheckSquare,
  Square,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  GripVertical,
  ClipboardList,
  FolderKanban,
  Pencil,
  Trash2,
  Check,
  CalendarDays,
  ListChecks,
  AlertTriangle,
  Lock,
  ClipboardCheck,
  ListTodo,
} from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { AvatarGroup } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { TimeChip } from '../components/ui/TimeChip'
import { ProgressBar } from '../components/ui/ProgressBar'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { TaskFormModal } from '../components/TaskFormModal'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { Dropdown } from '../components/ui/Dropdown'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthContext'
import { useApi } from '../api/useApi'
import { getTasksPage, getTaskSummary, getTaskById, advanceTaskStatus, canAdvanceStatus, deleteTask } from '../api/tasks'
import { getSubtasksByTask, updateSubtask } from '../api/subtasks'
import { getProjects } from '../api/projects'
import { humanizeEnum, formatDate, taskDisplayTitle, blockedReason, timeAgo } from '../api/format'
import { getPendingApprovals } from '../api/approvals'
import { canApproveTask } from '../api/permissions'
import { ApprovalChip } from '../components/ApprovalChip'
import { DueSoonBadge } from '../components/DueSoonBadge'

// Distinct colors per section, using the same soft-background + colored-
// foreground pairing as Badge.jsx (already proven legible elsewhere in the
// app, e.g. priority badges) — plain colored text/icons directly on the
// page background turned out to be too low-contrast on their own, since
// this app's status hues are deliberately muted/pastel.
const STATUS_GROUPS = [
  { key: 'todo', title: 'To Do', match: (status) => status === 'TODO', color: 'text-muted', soft: 'bg-subtle' },
  { key: 'inprogress', title: 'In Progress', match: (status) => status === 'IN_PROGRESS', color: 'text-info-ink', soft: 'bg-info-soft' },
  { key: 'inreview', title: 'In Review', match: (status) => status === 'IN_REVIEW', color: 'text-warning-ink', soft: 'bg-warning-soft' },
  { key: 'completed', title: 'Completed', match: (status) => status === 'COMPLETED', color: 'text-success-ink', soft: 'bg-success-soft' },
  { key: 'cancelled', title: 'Cancelled', match: (status) => status === 'CANCELLED', color: 'text-danger-ink', soft: 'bg-danger-soft' },
]

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED']
const DUE_OPTIONS = [
  { id: '', label: 'Any date' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Due today' },
  { id: 'week', label: 'Due in the next 7 days' },
  { id: 'none', label: 'No due date' },
]
// Quick views over the tasks the other filters leave (brief Part A "My Tasks": Today,
// Upcoming, In Progress, Completed, Overdue). Today and Upcoming mean open tasks
// (not Completed or Cancelled) due today / after today. The server applies them and counts them.
const QUICK_VIEWS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'overdue', label: 'Overdue' },
]
const UNASSIGNED = 'unassigned'
const SORT_OPTIONS = [
  { id: 'dueDate', label: 'Due date' },
  { id: 'latest', label: 'Latest' },
  { id: 'priority', label: 'Priority' },
  { id: 'progress', label: 'Progress (highest first)' },
  { id: 'status', label: 'Status' },
  { id: 'title', label: 'Title (A–Z)' },
]
// The list is read from the server a page at a time (50 tasks), ordered by project and then by the
// chosen sort; "Show more" reads the next page.
const PAGE_SIZE = 50

export function Tasks() {
  const { profile, can, canAny, permissions } = useAuth()
  const notify = useToast()
  const { data: projects, refetch: refetchProjects } = useApi(getProjects)
  // Requests waiting for a decision from the signed-in user (empty for most people).
  const { data: pendingApprovals, refetch: refetchPending } = useApi(getPendingApprovals)
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [newTaskModal, setNewTaskModal] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [deletingTask, setDeletingTask] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState(() => new Set())
  const [statusFilter, setStatusFilter] = useState(() => new Set())
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [dueFilter, setDueFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [myTasksOnly, setMyTasksOnly] = useState(false)
  const [quickView, setQuickView] = useState('all')
  const [sortBy, setSortBy] = useState('dueDate')
  const [reloadTick, setReloadTick] = useState(0)
  const [page, setPage] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [fetchedTask, setFetchedTask] = useState(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [expandedTaskIds, setExpandedTaskIds] = useState(() => new Set())
  // Empty by default — every project group starts fully expanded, matching
  // the existing design. Collapsing one project is independent of every
  // other (a plain per-id Set, same pattern as expandedTaskIds above).
  const [collapsedProjectIds, setCollapsedProjectIds] = useState(() => new Set())
  const [subtasksByTask, setSubtasksByTask] = useState(() => new Map())
  const [loadingSubtasksFor, setLoadingSubtasksFor] = useState(() => new Set())
  // Whether there's at least one project the caller can add tasks to —
  // gates the top-level "New Task"/"Add task" affordances. Per-row actions
  // instead check that specific task's own project: see the row below.
  // A completed project takes no new tasks (D-27): offered only while some project in view can still take one.
  const canAddTasks =
    projects == null
      ? canAny('TASK', 'CREATE')
      : projects.some(
          (p) =>
            p.status !== 'COMPLETED' && can('TASK', 'CREATE', p.id) && (!projectFilter || String(p.id) === projectFilter)
        )

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  // What the server is asked to search and filter by (My Tasks and the assignee choice both name an
  // assignee, and a task must then be assigned to both), and with the quick view and the sort.
  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      statuses: Array.from(statusFilter),
      priorities: Array.from(priorityFilter),
      assigneeIds: [
        ...(myTasksOnly && profile?.id != null ? [profile.id] : []),
        ...(assigneeFilter && assigneeFilter !== UNASSIGNED ? [Number(assigneeFilter)] : []),
      ],
      unassigned: assigneeFilter === UNASSIGNED,
      projectId: projectFilter,
      due: dueFilter,
    }),
    [debouncedSearch, statusFilter, priorityFilter, myTasksOnly, profile, assigneeFilter, projectFilter, dueFilter]
  )
  const query = useMemo(() => ({ ...filters, view: quickView, sort: sortBy }), [filters, quickView, sortBy])

  // Every page read so far for the current query. How many there are is kept, so that reloading
  // after an edit reads the same number of pages again instead of dropping back to the first.
  const loaded = useRef({ query: null, pages: 1 })
  useEffect(() => {
    if (loaded.current.query !== query) loaded.current = { query, pages: 1 }
    let cancelled = false
    Promise.all(Array.from({ length: loaded.current.pages }, (_, p) => getTasksPage(query, p, PAGE_SIZE)))
      .then((results) => {
        if (!cancelled) setPage({ items: results.flatMap((r) => r.items), total: results[0].total })
      })
      .catch((err) => {
        if (!cancelled) notify(err.message || 'Failed to load tasks', { tone: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [query, reloadTick, notify])

  const loadMore = async () => {
    const snapshot = loaded.current
    setLoadingMore(true)
    try {
      const next = await getTasksPage(query, snapshot.pages, PAGE_SIZE)
      if (loaded.current !== snapshot) return // the search or a filter changed meanwhile
      snapshot.pages += 1
      setPage((prev) => ({ items: [...prev.items, ...next.items], total: next.total }))
    } catch (err) {
      notify(err.message || 'Failed to load more tasks', { tone: 'error' })
    } finally {
      setLoadingMore(false)
    }
  }

  // The quick-view counts and the people to offer in the assignee filter, over the same filters.
  const summaryFetcher = useCallback(() => getTaskSummary(filters), [filters])
  const { data: summary, refetch: refetchSummary } = useApi(summaryFetcher)
  const viewCounts = summary?.viewCounts ?? {}
  const reload = () => {
    setReloadTick((t) => t + 1)
    refetchSummary()
  }

  const list = useMemo(() => page?.items ?? [], [page])
  const total = page?.total ?? 0
  const loading = page == null

  // The open task is read on its own as well, so the panel still shows a task the list does not
  // hold: one opened from "Awaiting your approval", on a page not read yet, or one an edit has
  // just moved out of the current filter.
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
  // always reflects the live list — including a backend-side change to
  // this task, like the auto-promotion to In Progress in
  // SubtaskService.startTaskIfStillToDo, which a frozen snapshot captured
  // at click-time would never pick up after a refetch.
  const activeTask = useMemo(() => {
    if (activeTaskId == null) return null
    const t = list.find((task) => task.id === activeTaskId) ?? (fetchedTask?.id === activeTaskId ? fetchedTask : null)
    return t ? { ...t, assigneeIds: t.assigneeIds ?? [] } : null
  }, [activeTaskId, list, fetchedTask])
  const activeFilterCount =
    priorityFilter.size +
    statusFilter.size +
    (projectFilter ? 1 : 0) +
    (assigneeFilter ? 1 : 0) +
    (dueFilter ? 1 : 0) +
    (myTasksOnly ? 1 : 0)
  const filtersActive = activeFilterCount > 0 || search.trim() !== '' || quickView !== 'all'

  // People who hold at least one assignment on a task the caller can see (from the server's summary).
  const assigneeOptions = useMemo(
    () => (summary?.assignees ?? []).map((u) => ({ id: u.id, name: u.fullName || u.username })),
    [summary]
  )

  // Project name -> one group per status -> its tasks (sorted by the current
  // sort choice) -> each task's subtasks, fetched on demand when expanded
  // (see toggleExpand) — there's no bulk "all subtasks for these tasks"
  // endpoint, only GET /api/subtasks/task/{taskId}, same as TaskDetailPanel.
  const projectGroups = useMemo(() => {
    const groups = new Map()
    for (const t of list) {
      const key = t.project?.id ?? 'none'
      if (!groups.has(key)) {
        groups.set(key, { id: key, name: t.project?.name || 'No project', tasks: [] })
      }
      groups.get(key).tasks.push(t)
    }
    return Array.from(groups.values())
      .map((g) => {
        // The overall %-complete shown in the group header — the project's
        // own progress field (set on the Projects page), not derived from
        // this filtered task list, so it stays the same regardless of the
        // active search/priority filters.
        g.project = g.id === 'none' ? null : projects?.find((p) => p.id === g.id) ?? null
        const sorted = g.tasks // already in the chosen order: the server sorts inside each project
        const statusGroups = STATUS_GROUPS.map((sg) => ({
          ...sg,
          tasks: sorted.filter((t) => sg.match(t.status)),
        })).filter((sg) => sg.tasks.length > 0)
        return { ...g, tasks: sorted, statusGroups }
      })
      .sort((a, b) => {
        // Fully-done projects sink to the bottom regardless of name, so a
        // project that still needs tracking is never below one that's
        // finished — alphabetical only decides order within each bucket.
        const aDone = a.project && Number(a.project.progress ?? 0) >= 100 ? 1 : 0
        const bDone = b.project && Number(b.project.progress ?? 0) >= 100 ? 1 : 0
        if (aDone !== bDone) return aDone - bDone
        return a.name.localeCompare(b.name)
      })
  }, [list, projects])

  const loadSubtasksFor = async (taskId) => {
    setLoadingSubtasksFor((prev) => new Set(prev).add(taskId))
    try {
      const data = await getSubtasksByTask(taskId)
      setSubtasksByTask((prev) => new Map(prev).set(taskId, data))
    } catch (err) {
      notify(err.message || 'Failed to load subtasks', { tone: 'error' })
    } finally {
      setLoadingSubtasksFor((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  const toggleSubtaskInList = async (task, s, e) => {
    e.stopPropagation()
    try {
      await updateSubtask(s.id, {
        taskId: task.id,
        title: s.title,
        assigneeId: s.assigneeId,
        dueDate: s.dueDate,
        status: s.status === 'COMPLETED' ? 'TODO' : 'COMPLETED',
      })
      await loadSubtasksFor(task.id)
      // completedSubtasks/totalSubtasks on the task row (and the quick-advance
      // gating in advanceTask) come from the tasks list itself, not this
      // page's separately-fetched subtask preview.
      reload()
      // Mirrors SubtaskService.startTaskIfStillToDo's own silent skip: a
      // blocked task can never legally become IN_PROGRESS (the DB's
      // dependency gate forbids it), so a subtask touch here can't promote
      // it out of To Do the way it would for an unblocked task. Surfaced
      // here rather than left silent so the still-To-Do status after
      // checking a box doesn't read as this feature being broken.
      if (task.status === 'TODO' && task.blocked) {
        notify(`${blockedReason(task)} — status stays To Do until then.`, { tone: 'info' })
      }
    } catch (err) {
      notify(err.message || 'Failed to update subtask', { tone: 'error' })
    }
  }

  const toggleExpand = (taskId, e) => {
    e.stopPropagation()
    setExpandedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
    if (!subtasksByTask.has(taskId) && !loadingSubtasksFor.has(taskId)) {
      loadSubtasksFor(taskId)
    }
  }

  const toggleProjectCollapse = (projectId) => {
    setCollapsedProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const refetchAll = () => {
    reload()
    // Project progress is derived server-side from its tasks (see
    // database/init/01-init.sql's progress triggers) — a task mutation here
    // can change its own project's %, so the group header would show a
    // stale number until the next full page load without this.
    refetchProjects()
    refetchPending()
    // TaskDetailPanel's own subtask edits (toggle/add/remove) don't touch
    // this page's separately-fetched/cached subtask preview — without this,
    // an already-expanded row kept showing the stale, pre-edit list after
    // completing a subtask in the panel and closing it.
    if (activeTask && subtasksByTask.has(activeTask.id)) {
      loadSubtasksFor(activeTask.id)
    }
  }

  const toggleStatusFilter = (st) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(st)) next.delete(st)
      else next.add(st)
      return next
    })
  }

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
    const canApproveIt = canApproveTask(permissions, profile?.id, task, (task.assigneeIds ?? []).includes(profile?.id))
    if (!canAdvanceStatus(task.status, canApproveIt)) return
    // The one step this quick-advance control can attempt that's actually
    // gated: In Progress -> Completed requires every subtask complete (see
    // TaskDetailPanel's identical check and, ultimately,
    // database/init/01-init.sql's check_task_not_completed_with_open_subtasks
    // trigger, which would reject this the same way if this check weren't
    // here first). Checked here so the button doesn't fire a doomed request.
    const movingToDoing = task.status === 'IN_PROGRESS' || task.status === 'IN_REVIEW'
    if (movingToDoing && task.totalSubtasks > 0 && task.completedSubtasks < task.totalSubtasks) {
      notify('Complete all subtasks before marking this task as completed.', { tone: 'error' })
      return
    }
    try {
      await advanceTaskStatus(task, canApproveIt)
      refetchAll()
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
      refetchAll()
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
        title="Tasks"
        subtitle={filtersActive ? `${total} matching ${total === 1 ? 'task' : 'tasks'}` : `${total} tasks across all your projects`}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search tasks"
        actions={
          <>
            <Dropdown
              panelClassName="max-h-[70vh] overflow-y-auto"
              button={({ toggle }) => (
                <button className="btn btn-secondary" onClick={toggle}>
                  <SlidersHorizontal size={15} /> Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </button>
              )}
            >
              {({ close }) => (
                <div className="flex w-[220px] flex-col gap-3 p-1">
                  <div>
                    <span className="text-faint mb-1.5 block text-[12px] font-[650] tracking-[0.04em] uppercase">
                      Assignment
                    </span>
                    <label className="hover:bg-subtle flex items-center gap-2 rounded-sm px-1.5 py-1 text-[13px]">
                      <input type="checkbox" checked={myTasksOnly} onChange={() => setMyTasksOnly((v) => !v)} />
                      My Tasks
                    </label>
                  </div>
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
                      Status
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {STATUS_OPTIONS.map((st) => (
                        <label
                          key={st}
                          className="hover:bg-subtle flex items-center gap-2 rounded-sm px-1.5 py-1 text-[13px]"
                        >
                          <input type="checkbox" checked={statusFilter.has(st)} onChange={() => toggleStatusFilter(st)} />
                          {humanizeEnum(st)}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-faint mb-1.5 block text-[12px] font-[650] tracking-[0.04em] uppercase">
                      Assignee
                    </span>
                    <select
                      value={assigneeFilter}
                      onChange={(e) => setAssigneeFilter(e.target.value)}
                      className="field field-sm w-full"
                      aria-label="Assignee"
                    >
                      <option value="">Anyone</option>
                      <option value={UNASSIGNED}>Unassigned</option>
                      {assigneeOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="text-faint mb-1.5 block text-[12px] font-[650] tracking-[0.04em] uppercase">
                      Due date
                    </span>
                    <select
                      value={dueFilter}
                      onChange={(e) => setDueFilter(e.target.value)}
                      className="field field-sm w-full"
                      aria-label="Due date"
                    >
                      {DUE_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
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
                        setStatusFilter(new Set())
                        setAssigneeFilter('')
                        setDueFilter('')
                        setProjectFilter('')
                        setMyTasksOnly(false)
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
              <button className="btn btn-primary" onClick={() => setNewTaskModal({})}>
                <Plus size={16} /> New Task
              </button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <div
          role="group"
          aria-label="Quick view"
          data-testid="quick-views"
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5"
        >
          {QUICK_VIEWS.map((v) => {
            const active = quickView === v.id
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={active}
                data-testid={`quick-view-${v.id}`}
                onClick={() => setQuickView(v.id)}
                className={`duration-[var(--duration-fast)] ease-[var(--ease-standard)] inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-charcoal text-on-charcoal border-transparent'
                    : `bg-card border-border hover:bg-subtle ${
                        v.id === 'overdue' && viewCounts.overdue > 0 ? 'text-danger-ink' : 'text-muted'
                      }`
                }`}
              >
                {v.label}
                <span className={`text-[12px] font-medium ${active ? 'opacity-80' : 'text-faint'}`}>
                  {viewCounts[v.id] ?? 0}
                </span>
              </button>
            )
          })}
        </div>

        {!loading && projectGroups.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            title={filtersActive ? 'No tasks match your search/filters' : 'No tasks here yet'}
            subtitle={canAddTasks && !filtersActive ? 'Add one to get started.' : undefined}
          />
        )}

        {loading &&
          projectGroups.length === 0 &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-card border-border flex items-center gap-2.5 rounded-md border px-3.5 py-2.5">
              <Skeleton className="h-[18px] w-[18px] shrink-0 rounded-full" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-6 w-[110px] shrink-0 rounded-full" />
            </div>
          ))}

        {(pendingApprovals ?? []).length > 0 && (
          <div data-testid="pending-approvals" className="bg-warning-soft rounded-2xl p-3 sm:p-4">
            <h3 className="text-warning-ink mb-2.5 flex items-center gap-2 px-1 text-[15px] font-[650]">
              <ClipboardCheck size={17} /> Awaiting your approval · {pendingApprovals.length}
            </h3>
            <div className="flex flex-col gap-1.5">
              {pendingApprovals.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setActiveTaskId(a.taskId)}
                  className="bg-card border-border hover:shadow-card-hover flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border px-3.5 py-2.5 text-left transition"
                >
                  <span className="min-w-0">
                    <span className="text-ink block truncate text-[13px] font-semibold">
                      {taskDisplayTitle(a.taskTitle, a.projectName)}
                    </span>
                    <span className="text-muted block truncate text-[12px]">{a.projectName}</span>
                  </span>
                  <span className="text-muted text-[12px]">
                    Requested by {a.requestedBy?.fullName ?? 'someone'} · {timeAgo(a.requestedAt)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {projectGroups.map((group) => {
          const canAddToProject = group.project != null && group.project.status !== 'COMPLETED' && can('TASK', 'CREATE', group.project.id)
          const projectProgress = group.project ? Math.round(Number(group.project.progress ?? 0)) : null
          const isCollapsed = collapsedProjectIds.has(group.id)

          return (
          <div key={group.id} className="bg-container rounded-2xl p-3 sm:p-4">
            <div className="border-border mb-3 flex flex-wrap items-center justify-between gap-2.5 border-b px-1 pb-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => toggleProjectCollapse(group.id)}
                  className="icon-btn hit-area h-7 w-7 shrink-0"
                  aria-label={isCollapsed ? `Expand ${group.name}` : `Collapse ${group.name}`}
                  title={isCollapsed ? 'Expand project' : 'Collapse project'}
                >
                  {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                </button>
                <div className="flex min-w-0 items-center gap-1.5">
                  <FolderKanban size={20} className="text-faint shrink-0" />
                  <h3 className="text-ink truncate text-[19px] font-[650]">{group.name}</h3>
                </div>
                {projectProgress != null && (
                  <div className="flex min-w-37.5 items-center gap-2">
                    <span className="w-11 shrink-0 text-right text-[14px] text-faint font-semibold">{projectProgress}%</span>
                    <div className="hidden w-28 sm:block">
                      <ProgressBar percent={projectProgress} height={8} />
                    </div>
                  </div>
                )}
              </div>
              {canAddToProject && (
                <button
                  type="button"
                  className="btn btn-secondary h-8 px-3 text-[12px]"
                  onClick={() => setNewTaskModal({ projectId: group.project.id })}
                >
                  <Plus size={14} /> Add Task
                </button>
              )}
            </div>

            {!isCollapsed && (
            <div className="flex flex-col gap-3">
              {group.statusGroups.map((sg) => (
                <div key={sg.key} className="flex flex-col gap-2">
                  <span
                    className={`${sg.soft} ${sg.color} inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[12px] font-[650] tracking-[0.04em] uppercase`}
                  >
                    {sg.title} · {sg.tasks.length}
                  </span>
                  {sg.tasks.map((t, i) => {
                const assigneeIds = t.assigneeIds ?? []
                const canEditThisTask = can('TASK', 'EDIT', t.project?.id)
                const canDeleteThisTask = can('TASK', 'DELETE', t.project?.id)
                const canApproveThisTask = canApproveTask(permissions, profile?.id, t, assigneeIds.includes(profile?.id))
                const canEditSubtasks = can('SUBTASK', 'EDIT', t.project?.id)
                // Quick-advance is only offered to someone who may change this
                // task's status: an editor, or an assignee (TASK_STATUS:EDIT).
                const canChangeStatus =
                  canEditThisTask || (can('TASK_STATUS', 'EDIT', t.project?.id) && assigneeIds.includes(profile?.id))
                const done = t.status === 'COMPLETED'
                const cancelled = t.status === 'CANCELLED'
                const doing = t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW'
                // The button always stays clickable while In Progress/In Review — even
                // with incomplete subtasks — rather than going quietly
                // disabled. Clicking it then is what surfaces the blocked
                // reason (see advanceTask's notify call): an active message
                // beats a silently inert control the user has to guess at.
                // Mirrors TaskDetailPanel's hasIncompleteSubtasks for the
                // same underlying check.
                const blockedBySubtasks = doing && t.totalSubtasks > 0 && t.completedSubtasks < t.totalSubtasks
                const advanceable = canChangeStatus && canAdvanceStatus(t.status, canApproveThisTask)
                // A control the user cannot use is not a button at all: just the status icon.
                const AdvanceTag = advanceable ? 'button' : 'span'
                const advanceLabel = t.status === 'TODO'
                  ? 'Move to In Progress'
                  : blockedBySubtasks
                    ? 'Complete all subtasks before marking this task as completed'
                    : doing
                      ? canApproveThisTask
                        ? 'Mark as Completed'
                        : t.status === 'IN_REVIEW'
                          ? 'Awaiting approval'
                          : 'Submit for review'
                      : cancelled
                        ? 'Task cancelled'
                        : 'Task completed'
                const expanded = expandedTaskIds.has(t.id)
                const subtasks = subtasksByTask.get(t.id) ?? []

                return (
                  <div key={t.id} className="flex flex-col gap-1">
                    <div
                      data-testid="task-row"
                      onClick={() => setActiveTaskId(t.id)}
                      className="group bg-card border-border hover:shadow-card-hover duration-[var(--duration-med)] ease-[var(--ease-standard)] animate-fade-in flex cursor-pointer flex-wrap items-center gap-2.5 rounded-md border px-3.5 py-2.5 transition hover:-translate-y-px sm:flex-nowrap"
                      style={{ animationDelay: `${Math.min(i, 8) * 30}ms`, animationFillMode: 'backwards' }}
                    >
                      <button
                        onClick={(e) => toggleExpand(t.id, e)}
                        className="hit-area text-faint hover:text-ink hover:bg-subtle -m-1.5 shrink-0 rounded-full p-1.5 transition-colors"
                        aria-label={expanded ? 'Hide subtasks' : 'Show subtasks'}
                        title={expanded ? 'Hide subtasks' : 'Show subtasks'}
                      >
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>

                      <GripVertical size={14} className="text-faint hidden shrink-0 sm:block" />

                      <AdvanceTag
                        {...(advanceable ? { type: 'button', onClick: (e) => advanceTask(t, e) } : { role: 'img' })}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${advanceable ? '' : 'cursor-default'} ${
                          done ? 'bg-success-soft' : cancelled ? 'bg-danger-soft' : doing ? 'bg-info-soft' : 'bg-warning-soft'
                        }`}
                        aria-label={advanceLabel}
                        title={advanceLabel}
                      >
                        {done ? (
                          <CheckCircle2 size={16} className="text-success-ink" />
                        ) : cancelled ? (
                          <CheckCircle2 size={16} className="text-danger-ink" />
                        ) : doing ? (
                          <CircleDot size={16} className="text-info-ink" />
                        ) : (
                          <Circle size={16} className="text-warning-ink" />
                        )}
                      </AdvanceTag>

                      <div className="min-w-[140px] flex-1">
                        <p
                          className={`truncate text-[13px] font-semibold ${done ? 'text-faint line-through' : 'text-ink'}`}
                        >
                          {taskDisplayTitle(t.title, t.project?.name)}
                        </p>
                        {t.description && (
                          <p className="text-muted mt-0.5 truncate text-[12px]">{t.description}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <Badge tone={t.priority}>{humanizeEnum(t.priority)}</Badge>
                          {t.overdue && (
                            <span className="bg-danger-soft text-danger-ink inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap">
                              <AlertTriangle size={12} /> Overdue
                            </span>
                          )}
                          <DueSoonBadge task={t} />
                          <ApprovalChip task={t} />
                          {t.blocked && (
                            <span
                              title={blockedReason(t)}
                              className="bg-subtle text-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap"
                            >
                              <Lock size={12} /> Blocked
                            </span>
                          )}
                          {t.dueDate && (
                            <span className="text-muted inline-flex items-center gap-1 text-[12px]">
                              <CalendarDays size={12} /> {formatDate(t.dueDate)}
                            </span>
                          )}
                          <TimeChip task={t} />
                          {t.totalChecklistItems > 0 && (
                            <span className="text-muted inline-flex items-center gap-1 text-[12px]">
                              <ListTodo size={12} />
                              {t.completedChecklistItems}/{t.totalChecklistItems} checklist
                            </span>
                          )}
                          {t.totalSubtasks > 0 && (
                            <span className="text-muted inline-flex items-center gap-1 text-[12px]">
                              <ListChecks size={12} />
                              {t.completedSubtasks}/{t.totalSubtasks} subtasks · {Math.round((t.completedSubtasks / t.totalSubtasks) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2.5">
                        <div className="flex w-7 shrink-0 items-center justify-center">
                          {assigneeIds.length > 0 && <AvatarGroup memberIds={assigneeIds} size={28} />}
                        </div>
                        {(canEditThisTask || canDeleteThisTask) && (
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
                                {canEditThisTask && (
                                  <button
                                    type="button"
                                    className="hover:bg-subtle flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px]"
                                    onClick={() => {
                                      setEditingTask({ ...t, assigneeIds })
                                      close()
                                    }}
                                  >
                                    <Pencil size={14} /> Edit
                                  </button>
                                )}
                                {canDeleteThisTask && (
                                  <button
                                    type="button"
                                    className="hover:bg-subtle text-danger-ink flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px]"
                                    onClick={() => {
                                      setDeletingTask(t)
                                      close()
                                    }}
                                  >
                                    <Trash2 size={14} /> Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </Dropdown>
                        )}
                      </div>
                    </div>

                    {expanded && (
                      <div className="ml-8 flex flex-col gap-1">
                        {loadingSubtasksFor.has(t.id) && <Skeleton className="h-8 w-full" />}
                        {!loadingSubtasksFor.has(t.id) && subtasks.length === 0 && (
                          <p className="text-faint px-1 text-[12px]">No subtasks</p>
                        )}
                        {subtasks.map((s) => {
                          const SubtaskTag = canEditSubtasks ? 'button' : 'div'
                          return (
                          <SubtaskTag
                            key={s.id}
                            type={canEditSubtasks ? 'button' : undefined}
                            onClick={canEditSubtasks ? (e) => toggleSubtaskInList(t, s, e) : undefined}
                            className={`bg-card border-border flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[12px] transition-colors ${canEditSubtasks ? 'hover:bg-subtle' : ''}`}
                          >
                            {s.status === 'COMPLETED' ? (
                              <CheckSquare size={14} className="text-success-ink shrink-0" />
                            ) : (
                              <Square size={14} className="text-faint shrink-0" />
                            )}
                            <span className={s.status === 'COMPLETED' ? 'text-faint line-through' : 'text-ink'}>
                              {s.title}
                            </span>
                          </SubtaskTag>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
                </div>
              ))}
            </div>
            )}
          </div>
          )
        })}

        {list.length < total && (
          <button
            type="button"
            data-testid="tasks-show-more"
            className="btn btn-secondary self-center"
            disabled={loadingMore}
            onClick={loadMore}
          >
            {loadingMore ? 'Loading…' : `Show more (${total - list.length} more)`}
          </button>
        )}
      </div>

      {activeTask && (
        <TaskDetailPanel
          key={activeTask.id}
          task={activeTask}
          onClose={() => setActiveTaskId(null)}
          onChange={refetchAll}
        />
      )}

      {newTaskModal && (
        <TaskFormModal
          defaultProjectId={newTaskModal.projectId}
          onClose={() => setNewTaskModal(null)}
          onSaved={refetchAll}
        />
      )}

      {editingTask && (
        <TaskFormModal task={editingTask} onClose={() => setEditingTask(null)} onSaved={refetchAll} />
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
