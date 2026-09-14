import { useCallback, useMemo, useState } from 'react'
import {
  X,
  CalendarDays,
  Flag,
  FolderKanban,
  CheckSquare,
  Square,
  Send,
  Pencil,
  Trash2,
  AlertTriangle,
  Lock,
  Link2,
  History,
} from 'lucide-react'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'
import { useToast } from './ui/Toast'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { TaskFormModal } from './TaskFormModal'
import { useMembers } from '../data/UsersContext'
import { useAuth } from '../auth/AuthContext'
import { canManageProject } from '../api/permissions'
import { buildMyProjectRoleMap } from '../api/relations'
import { getProjectMembers } from '../api/projectMembers'
import { setTaskStatus, deleteTask, getTasks } from '../api/tasks'
import { useApi } from '../api/useApi'
import { getSubtasksByTask, createSubtask, updateSubtask, deleteSubtask } from '../api/subtasks'
import { getCommentsByTask, createComment, updateComment, deleteComment } from '../api/comments'
import { getActivityByTask } from '../api/activityLog'
import { getDependenciesByTask, createTaskDependency, deleteTaskDependency } from '../api/taskDependencies'
import { formatDate, humanizeEnum, initialsFor, timeAgo } from '../api/format'

const STATUS_OPTIONS = ['TO_DO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED']

export function TaskDetailPanel({ task, onClose, onChange }) {
  const { getMember, members } = useMembers()
  const { profile, role } = useAuth()
  const notify = useToast()
  const { data: projectMembers } = useApi(getProjectMembers)
  const myProjectRoleMap = useMemo(
    () => buildMyProjectRoleMap(projectMembers, profile?.id),
    [projectMembers, profile]
  )
  // OWNER/ADMIN of THIS task's project (or system ADMINISTRATOR) — matches
  // ProjectAccessGuard.canManage on the backend, which is what actually
  // gates PUT/DELETE on this task and comment moderation.
  const canManage = canManageProject(myProjectRoleMap.get(task?.project?.id), role === 'ADMINISTRATOR')
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const subtasksFetcher = useCallback(() => getSubtasksByTask(task.id), [task.id])
  const { data: subtasksData, refetch: refetchSubtasks } = useApi(subtasksFetcher)
  const subtasks = useMemo(() => subtasksData ?? [], [subtasksData])

  const commentsFetcher = useCallback(() => getCommentsByTask(task.id), [task.id])
  const { data: commentsData, refetch: refetchComments } = useApi(commentsFetcher)
  const comments = useMemo(() => commentsData ?? [], [commentsData])

  const activityFetcher = useCallback(() => getActivityByTask(task.id), [task.id])
  const { data: activityData, refetch: refetchActivity } = useApi(activityFetcher)
  const activity = useMemo(() => activityData ?? [], [activityData])

  const dependenciesFetcher = useCallback(() => getDependenciesByTask(task.id), [task.id])
  const { data: dependenciesData, refetch: refetchDependencies } = useApi(dependenciesFetcher)
  const dependencies = useMemo(() => dependenciesData ?? [], [dependenciesData])

  // Used only to populate the "add a dependency" picker with other tasks in
  // the same project — not shared with the caller's own already-fetched
  // task list (Tasks.jsx/Kanban.jsx), so this is its own independent fetch,
  // same as TaskFormModal's own separate getProjects/getProjectMembers calls.
  const { data: allTasksData } = useApi(getTasks)
  const availableToDepend = useMemo(() => {
    const dependsOnIds = new Set(dependencies.map((d) => d.dependsOnTask.id))
    return (allTasksData ?? []).filter(
      (t) => t.project?.id === task.project?.id && t.id !== task.id && !dependsOnIds.has(t.id)
    )
  }, [allTasksData, dependencies, task])
  const [newDependencyId, setNewDependencyId] = useState('')

  const [comment, setComment] = useState('')
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [editingSubtaskId, setEditingSubtaskId] = useState(null)
  const [editSubtaskTitle, setEditSubtaskTitle] = useState('')
  const [editSubtaskAssigneeId, setEditSubtaskAssigneeId] = useState('')
  const [editSubtaskDueDate, setEditSubtaskDueDate] = useState('')
  const [status, setStatus] = useState(task?.status)
  const [savingStatus, setSavingStatus] = useState(false)

  // `task` is derived from the caller's own live task list (see Tasks.jsx/
  // Kanban.jsx), so task.status can change out from under us — e.g.
  // reopening the last completed subtask auto-reverts an already-COMPLETED
  // parent (SubtaskService.reopenParentIfNoLongerFullyComplete). Re-sync
  // the local optimistic-update copy whenever that happens, rather than
  // only reading task.status once at mount. Updating state directly during
  // render (guarded by the comparison) is the pattern React recommends for
  // "adjust state when a prop changes" — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [syncedStatus, setSyncedStatus] = useState(task?.status)
  if (task?.status !== syncedStatus) {
    setSyncedStatus(task?.status)
    setStatus(task?.status)
  }

  const assigneeId = useMemo(() => task?.assigneeIds?.[0], [task])
  const assignee = getMember(assigneeId)
  const doneCount = subtasks.filter((s) => s.status === 'COMPLETED').length
  // Mirrors the backend rule in TaskService.assertNotCompletingWithOpenSubtasks
  // — a task with subtasks can only become COMPLETED once every subtask is.
  // This only ever hides/blocks the option; the backend is still what
  // actually enforces it (see that method's own comment on why).
  const hasIncompleteSubtasks = subtasks.length > 0 && doneCount < subtasks.length

  if (!task) return null

  // Every subtask mutation also calls onChange (not just refetchSubtasks)
  // — a page that shows this same task elsewhere (e.g. My Tasks' expandable
  // subtask preview) has its own separately-fetched/cached copy of this
  // task's subtasks, which refetchSubtasks alone never touches. Without
  // this, completing a subtask here left that other view showing the stale,
  // pre-change list (and, since the parent's own status/progress can change
  // as a side effect on the backend when this was the last open subtask,
  // the task itself may also need refreshing there).
  const toggleSubtask = async (s) => {
    try {
      await updateSubtask(s.id, {
        taskId: task.id,
        title: s.title,
        assigneeId: s.assigneeId,
        dueDate: s.dueDate,
        status: s.status === 'COMPLETED' ? 'TO_DO' : 'COMPLETED',
      })
      refetchSubtasks()
      refetchActivity()
      onChange?.()
    } catch (err) {
      notify(err.message || 'Failed to update subtask', { tone: 'error' })
    }
  }

  const addSubtask = async (label) => {
    if (!label.trim()) return
    try {
      await createSubtask({ taskId: task.id, title: label.trim(), status: 'TO_DO' })
      refetchSubtasks()
      refetchActivity()
      onChange?.()
    } catch (err) {
      notify(err.message || 'Failed to add subtask', { tone: 'error' })
    }
  }

  const removeSubtask = async (id) => {
    try {
      await deleteSubtask(id)
      refetchSubtasks()
      refetchActivity()
      onChange?.()
    } catch (err) {
      notify(err.message || 'Failed to delete subtask', { tone: 'error' })
    }
  }

  const startEditSubtask = (s) => {
    setEditingSubtaskId(s.id)
    setEditSubtaskTitle(s.title)
    setEditSubtaskAssigneeId(s.assigneeId != null ? String(s.assigneeId) : '')
    setEditSubtaskDueDate(s.dueDate ?? '')
  }

  const saveEditSubtask = async (s) => {
    if (!editSubtaskTitle.trim()) return
    try {
      await updateSubtask(s.id, {
        taskId: task.id,
        title: editSubtaskTitle.trim(),
        assigneeId: editSubtaskAssigneeId ? Number(editSubtaskAssigneeId) : null,
        dueDate: editSubtaskDueDate || null,
        status: s.status,
      })
      setEditingSubtaskId(null)
      refetchSubtasks()
      refetchActivity()
      onChange?.()
    } catch (err) {
      notify(err.message || 'Failed to update subtask', { tone: 'error' })
    }
  }

  const addDependency = async () => {
    if (!newDependencyId) return
    try {
      await createTaskDependency(task.id, Number(newDependencyId))
      setNewDependencyId('')
      refetchDependencies()
    } catch (err) {
      notify(err.message || 'Failed to add dependency', { tone: 'error' })
    }
  }

  const removeDependency = async (dependsOnTaskId) => {
    try {
      await deleteTaskDependency(task.id, dependsOnTaskId)
      refetchDependencies()
    } catch (err) {
      notify(err.message || 'Failed to remove dependency', { tone: 'error' })
    }
  }

  const submitComment = async (e) => {
    e.preventDefault()
    if (!comment.trim()) return
    try {
      await createComment({ taskId: task.id, message: comment.trim() })
      setComment('')
      refetchComments()
    } catch (err) {
      notify(err.message || 'Failed to add comment', { tone: 'error' })
    }
  }

  const startEditComment = (c) => {
    setEditingCommentId(c.id)
    setEditingCommentText(c.message)
  }

  const saveEditComment = async (id) => {
    if (!editingCommentText.trim()) return
    try {
      await updateComment(id, { taskId: task.id, message: editingCommentText.trim() })
      setEditingCommentId(null)
      refetchComments()
    } catch (err) {
      notify(err.message || 'Failed to update comment', { tone: 'error' })
    }
  }

  const removeComment = async (id) => {
    try {
      await deleteComment(id)
      refetchComments()
    } catch (err) {
      notify(err.message || 'Failed to delete comment', { tone: 'error' })
    }
  }

  const handleStatusChange = async (nextStatus) => {
    if (nextStatus === 'COMPLETED' && hasIncompleteSubtasks) {
      notify('Complete all subtasks before marking this task as done.', { tone: 'error' })
      return
    }
    const previous = status
    setStatus(nextStatus)
    setSavingStatus(true)
    try {
      await setTaskStatus(task, nextStatus)
      refetchActivity()
      onChange?.()
    } catch (err) {
      setStatus(previous)
      notify(err.message || 'Failed to update status', { tone: 'error' })
    } finally {
      setSavingStatus(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteTask(task.id)
      notify(`Task "${task.title}" deleted`, { tone: 'success' })
      onChange?.()
      onClose()
    } catch (err) {
      notify(err.message || 'Failed to delete task', { tone: 'error' })
      setDeleting(false)
    }
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex justify-end bg-[rgba(20,20,22,.4)] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <aside
        className="animate-slide-in bg-card shadow-pop flex h-full w-[440px] max-w-[100vw] flex-col max-sm:w-[100vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-divider flex items-center justify-between border-b px-[22px] py-[18px]">
          <span className="text-faint text-[11.5px] font-[650] tracking-[0.05em] uppercase">
            Task
          </span>
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit task">
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-btn hover:text-danger"
                  onClick={() => setConfirmingDelete(true)}
                  aria-label="Delete task"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Close panel">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-[22px] pt-5 pb-6">
          <h2 className="mb-3.5 text-xl font-bold tracking-[-0.015em]">{task.title}</h2>

          <div className={`flex flex-wrap items-center gap-2 ${hasIncompleteSubtasks ? 'mb-1.5' : 'mb-5'}`}>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={savingStatus}
              className="bg-subtle border-border h-8 rounded-full border px-2.5 text-[11.5px] font-semibold outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} disabled={s === 'COMPLETED' && hasIncompleteSubtasks}>
                  {humanizeEnum(s)}
                </option>
              ))}
            </select>
            <Badge tone={task.priority}>{humanizeEnum(task.priority)}</Badge>
            {task.overdue && (
              <span className="bg-danger-soft text-danger inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold">
                <AlertTriangle size={12} /> Overdue
              </span>
            )}
            {task.blocked && (
              <span className="bg-subtle text-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold">
                <Lock size={12} /> Blocked
              </span>
            )}
          </div>
          {hasIncompleteSubtasks && (
            <p className="text-warning mb-3.5 text-[11.5px] font-medium">
              Complete all subtasks before marking this task as done.
            </p>
          )}

          <div className="bg-subtle border-border mb-[22px] grid grid-cols-2 gap-4 rounded-md border p-4 max-sm:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                <CalendarDays size={14} /> Due date
              </span>
              <span className="text-ink text-[13px] font-semibold">{formatDate(task.dueDate)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                <FolderKanban size={14} /> Project
              </span>
              <span className="text-ink text-[13px] font-semibold">{task.project?.name}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                <Flag size={14} /> Priority
              </span>
              <span className="text-ink text-[13px] font-semibold">{humanizeEnum(task.priority)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint text-[11.5px] font-semibold">Assignee</span>
              {assignee ? (
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
                  <Avatar initials={assignee.initials} color={assignee.color} photoUrl={assignee.photoUrl} size={22} />
                  {assignee.name}
                </span>
              ) : (
                <span className="text-ink text-[13px] font-semibold">Unassigned</span>
              )}
            </div>
          </div>

          <div className="mb-[22px]">
            <h4 className="mb-2.5 text-[13px] font-[650]">Description</h4>
            <p className="text-muted text-[13px] leading-relaxed">
              {task.description || 'No description provided.'}
            </p>
          </div>

          <div className="mb-[22px]">
            <div className="mb-2.5 flex items-center justify-between">
              <h4 className="text-[13px] font-[650]">Subtasks</h4>
              <span className="text-faint text-[11.5px] font-semibold">
                {doneCount}/{subtasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {subtasks.map((s) => {
                if (editingSubtaskId === s.id) {
                  return (
                    <div key={s.id} className="bg-subtle border-border flex flex-col gap-2 rounded-md border p-2.5">
                      <input
                        type="text"
                        value={editSubtaskTitle}
                        onChange={(e) => setEditSubtaskTitle(e.target.value)}
                        autoFocus
                        className="bg-card border-border focus:border-lavender h-8 rounded-md border px-2.5 text-[12.5px] outline-none"
                      />
                      <div className="flex gap-2">
                        <select
                          value={editSubtaskAssigneeId}
                          onChange={(e) => setEditSubtaskAssigneeId(e.target.value)}
                          className="bg-card border-border h-8 flex-1 rounded-md border px-2 text-[12px] outline-none"
                        >
                          <option value="">Unassigned</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={editSubtaskDueDate}
                          onChange={(e) => setEditSubtaskDueDate(e.target.value)}
                          className="bg-card border-border h-8 rounded-md border px-2 text-[12px] outline-none"
                        />
                      </div>
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          className="text-muted hover:text-ink text-[11.5px] font-semibold"
                          onClick={() => setEditingSubtaskId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="text-lavender text-[11.5px] font-semibold"
                          onClick={() => saveEditSubtask(s)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )
                }

                const subtaskAssignee = getMember(s.assigneeId)
                return (
                  <div
                    key={s.id}
                    className="text-ink hover:bg-subtle group duration-[var(--duration-fast)] ease-[var(--ease-standard)] flex items-center gap-2.5 rounded-sm px-1 py-2 text-left text-[13px] transition-colors [&_svg]:text-faint [&_svg]:shrink-0"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2.5 border-none bg-none text-left"
                      onClick={() => toggleSubtask(s)}
                    >
                      {s.status === 'COMPLETED' ? <CheckSquare size={17} className="shrink-0" /> : <Square size={17} className="shrink-0" />}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={`truncate ${s.status === 'COMPLETED' ? 'text-faint line-through' : ''}`}>
                          {s.title}
                        </span>
                        {(subtaskAssignee || s.dueDate) && (
                          <span className="text-faint flex items-center gap-1.5 truncate text-[11px] font-normal">
                            {subtaskAssignee && <span className="truncate">{subtaskAssignee.name}</span>}
                            {subtaskAssignee && s.dueDate && <span>·</span>}
                            {s.dueDate && <span className="shrink-0">{formatDate(s.dueDate)}</span>}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                      aria-label="Edit subtask"
                      onClick={() => startEditSubtask(s)}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 hover:text-danger"
                      aria-label="Delete subtask"
                      onClick={() => removeSubtask(s.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
            <form
              className="mt-1 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const input = e.currentTarget.elements.namedItem('subtask')
                addSubtask(input.value)
                input.value = ''
              }}
            >
              <input
                name="subtask"
                type="text"
                placeholder="Add a subtask..."
                className="bg-subtle border-border focus:border-lavender h-9 flex-1 rounded-md border px-3 text-[12.5px] outline-none"
              />
              <button type="submit" className="btn btn-secondary px-3 py-2 text-[12px]">
                Add
              </button>
            </form>
          </div>

          <div className="mb-[22px]">
            <div className="mb-2.5 flex items-center gap-2">
              <Link2 size={14} className="text-faint" />
              <h4 className="text-[13px] font-[650]">Depends on</h4>
            </div>
            {dependencies.length === 0 && (
              <p className="text-faint text-[12.5px]">No dependencies.</p>
            )}
            <div className="flex flex-col gap-0.5">
              {dependencies.map((d) => (
                <div
                  key={d.dependsOnTask.id}
                  className="hover:bg-subtle group flex items-center gap-2.5 rounded-sm px-1 py-2 text-[13px]"
                >
                  {d.dependsOnTask.status === 'COMPLETED' ? (
                    <CheckSquare size={15} className="text-success shrink-0" />
                  ) : (
                    <Square size={15} className="text-faint shrink-0" />
                  )}
                  <span
                    className={`flex-1 truncate ${d.dependsOnTask.status === 'COMPLETED' ? 'text-faint line-through' : 'text-ink'}`}
                  >
                    {d.dependsOnTask.title}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      className="icon-btn h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 hover:text-danger"
                      aria-label="Remove dependency"
                      onClick={() => removeDependency(d.dependsOnTask.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canManage && availableToDepend.length > 0 && (
              <div className="mt-1 flex items-center gap-2">
                <select
                  value={newDependencyId}
                  onChange={(e) => setNewDependencyId(e.target.value)}
                  className="bg-subtle border-border h-9 flex-1 rounded-md border px-2.5 text-[12.5px] outline-none"
                >
                  <option value="">Select a task…</option>
                  {availableToDepend.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary px-3 py-2 text-[12px]"
                  disabled={!newDependencyId}
                  onClick={addDependency}
                >
                  Add
                </button>
              </div>
            )}
          </div>

          <div className="mb-[22px]">
            <h4 className="mb-2.5 text-[13px] font-[650]">Comments</h4>
            {comments.length === 0 && (
              <p className="text-faint text-[12.5px]">No comments yet.</p>
            )}
            <div className="flex flex-col gap-3.5">
              {comments.map((c) => {
                const isOwn = profile?.id != null && c.userId === profile.id
                const author = getMember(c.userId)
                return (
                  <div key={c.id} className="group flex gap-2.5">
                    <Avatar
                      initials={initialsFor(c.authorName)}
                      color="var(--accent-purple)"
                      photoUrl={author?.photoUrl}
                      size={28}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-[3px] flex items-baseline gap-2">
                        <span className="text-[12.5px] font-[650]">{c.authorName}</span>
                        <span className="text-faint text-[11px]">{timeAgo(c.createdAt)}</span>
                        {isOwn && (
                          <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
                            <button
                              type="button"
                              className="icon-btn h-6 w-6"
                              aria-label="Edit comment"
                              onClick={() => startEditComment(c)}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn h-6 w-6 hover:text-danger"
                              aria-label="Delete comment"
                              onClick={() => removeComment(c.id)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </span>
                        )}
                        {!isOwn && canManage && (
                          <button
                            type="button"
                            className="icon-btn ml-auto h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-danger"
                            aria-label="Delete comment"
                            onClick={() => removeComment(c.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      {editingCommentId === c.id ? (
                        <form
                          className="flex items-center gap-2"
                          onSubmit={(e) => {
                            e.preventDefault()
                            saveEditComment(c.id)
                          }}
                        >
                          <input
                            type="text"
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value)}
                            autoFocus
                            className="bg-subtle border-border focus:border-lavender h-8 flex-1 rounded-md border px-2.5 text-[12.5px] outline-none"
                          />
                          <button type="submit" className="text-lavender text-[11.5px] font-semibold">
                            Save
                          </button>
                          <button
                            type="button"
                            className="text-muted text-[11.5px] font-semibold"
                            onClick={() => setEditingCommentId(null)}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <p className="text-muted text-[12.5px] leading-normal">{c.message}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <History size={14} className="text-faint" />
              <h4 className="text-[13px] font-[650]">Activity</h4>
            </div>
            {activity.length === 0 && <p className="text-faint text-[12.5px]">No activity yet.</p>}
            <div className="flex flex-col gap-3">
              {activity.map((a) => (
                <div key={a.id} className="flex gap-2.5">
                  <span className="bg-subtle text-faint mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                    <History size={12} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink text-[12.5px] leading-snug">{a.description}</p>
                    <span className="text-faint text-[11px]">
                      {a.userName} · {timeAgo(a.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <form
          className="border-divider flex items-center gap-2 border-t px-[18px] py-3.5"
          onSubmit={submitComment}
        >
          <input
            type="text"
            placeholder="Add a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="bg-subtle border-border focus:border-lavender h-10 flex-1 rounded-md border px-3.5 text-[13px] outline-none"
          />
          <button type="submit" className="icon-btn" aria-label="Send comment">
            <Send size={16} />
          </button>
        </form>
      </aside>

      {editing && (
        <TaskFormModal
          task={task}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            onChange?.()
            onClose()
          }}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete task"
          message={`Delete "${task.title}"? This can't be undone.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
