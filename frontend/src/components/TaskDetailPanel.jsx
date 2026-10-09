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
  ClipboardCheck,
  Reply,
} from 'lucide-react'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'
import { useToast } from './ui/Toast'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { TaskFormModal } from './TaskFormModal'
import { TimeTracking } from './TimeTracking'
import { ChecklistSection } from './ChecklistSection'
import { AttachmentsSection } from './AttachmentsSection'
import { useMembers } from '../data/UsersContext'
import { useAuth } from '../auth/AuthContext'
import { getActiveProjectMembers } from '../api/relations'
import { getProjectMembers } from '../api/projectMembers'
import { setTaskStatus, deleteTask, getTasks } from '../api/tasks'
import { useApi } from '../api/useApi'
import { getSubtasksByTask, createSubtask, updateSubtask, deleteSubtask } from '../api/subtasks'
import { getCommentsByTask, createComment, updateComment, deleteComment } from '../api/comments'
import { getActivityByTask } from '../api/activityLog'
import { getApprovals, submitForReview, decideApproval, setTaskApprover, DECISION_LABELS } from '../api/approvals'
import { canApproveTask } from '../api/permissions'
import { getDependenciesByTask, createTaskDependency, deleteTaskDependency } from '../api/taskDependencies'
import { formatDate, humanizeEnum, initialsFor, timeAgo, blockedReason } from '../api/format'

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED']

export function TaskDetailPanel({ task, onClose, onChange }) {
  const { getMember } = useMembers()
  const { profile, can, permissions } = useAuth()
  const notify = useToast()
  const { data: projectMembers } = useApi(getProjectMembers)
  // The real ACTIVE members of THIS task's project only — not the org-wide
  // directory (useMembers()), which includes anyone the caller shares ANY
  // project with. Assigning a subtask outside this list isn't a valid
  // choice: SubtaskService now rejects it too.
  const projectMembersForAssignee = useMemo(
    () => getActiveProjectMembers(projectMembers, task.project?.id),
    [projectMembers, task.project]
  )
  // What this user may do on THIS task's project. The server decides (role_permissions);
  // the panel only hides what would be refused. A control the user cannot use is
  // not rendered at all rather than shown disabled.
  const projectId = task?.project?.id
  const canEditTask = can('TASK', 'EDIT', projectId)
  const canDeleteTask = can('TASK', 'DELETE', projectId)
  const canAssignTask = can('TASK', 'ASSIGN', projectId)
  // Completing a task is an approval: only holders of TASK:APPROVE may set Completed.
  // Everyone else submits the task for review instead.
  const isAssignee = (task?.assigneeIds ?? []).includes(profile?.id)
  // ...and the server also refuses a task you are assigned to (unless you own the
  // project), a review you asked for, or one that names someone else as approver.
  const canApprove = canApproveTask(permissions, profile?.id, task, isAssignee)
  const canChangeStatus = canEditTask || (can('TASK_STATUS', 'EDIT', projectId) && isAssignee)
  const canCreateSubtask = can('SUBTASK', 'CREATE', projectId)
  const canEditSubtask = can('SUBTASK', 'EDIT', projectId)
  const canDeleteSubtask = can('SUBTASK', 'DELETE', projectId)
  const canComment = can('COMMENT', 'CREATE', projectId)
  const canModerateComments = can('COMMENT', 'DELETE', projectId)
  const canAddChecklist = can('CHECKLIST_ITEM', 'CREATE', projectId)
  // Like subtasks: a Team Member only ticks items on a task assigned to them.
  const canTickChecklist = can('CHECKLIST_ITEM', 'EDIT', projectId) && (canEditTask || isAssignee)
  const canDeleteChecklist = can('CHECKLIST_ITEM', 'DELETE', projectId)
  const canUploadFiles = can('ATTACHMENT', 'CREATE', projectId)
  const canDeleteAnyFile = can('ATTACHMENT', 'DELETE', projectId)
  const canLogTime = can('WORK_LOG', 'CREATE', projectId)
  const canDeleteAnyTimeEntry = can('WORK_LOG', 'DELETE', projectId)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const subtasksFetcher = useCallback(() => getSubtasksByTask(task.id), [task.id])
  const { data: subtasksData, refetch: refetchSubtasks } = useApi(subtasksFetcher)
  const subtasks = useMemo(() => subtasksData ?? [], [subtasksData])

  const commentsFetcher = useCallback(() => getCommentsByTask(task.id), [task.id])
  const { data: commentsData, refetch: refetchComments } = useApi(commentsFetcher)
  const comments = useMemo(() => commentsData ?? [], [commentsData])
  // Comments arrive oldest first; replies hang under the comment they answer.
  // A reply whose parent is not in the list (it was deleted) is shown at the top level.
  const commentThreads = useMemo(() => {
    const ids = new Set(comments.map((c) => c.id))
    const repliesOf = new Map()
    const roots = []
    for (const c of comments) {
      if (c.parentCommentId != null && ids.has(c.parentCommentId)) {
        const list = repliesOf.get(c.parentCommentId) ?? []
        list.push(c)
        repliesOf.set(c.parentCommentId, list)
      } else {
        roots.push(c)
      }
    }
    return { roots, repliesOf }
  }, [comments])

  const approvalsFetcher = useCallback(() => getApprovals(task.id), [task.id])
  const { data: approvalsData, refetch: refetchApprovals } = useApi(approvalsFetcher)
  const approvals = useMemo(() => approvalsData ?? [], [approvalsData])
  const [approvalComment, setApprovalComment] = useState('')
  const [rejectNext, setRejectNext] = useState('IN_PROGRESS')
  const [approvalBusy, setApprovalBusy] = useState(false)

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
  // The comment the composer at the bottom is answering, if any.
  const [replyingTo, setReplyingTo] = useState(null)
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
  // checking the first subtask on a still-To-Do task auto-promotes the
  // parent to In Progress (SubtaskService.startTaskIfStillToDo). Re-sync
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
        status: s.status === 'COMPLETED' ? 'TODO' : 'COMPLETED',
      })
      refetchSubtasks()
      refetchActivity()
      onChange?.()
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

  const addSubtask = async (label) => {
    if (!label.trim()) return
    try {
      await createSubtask({ taskId: task.id, title: label.trim(), status: 'TODO' })
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
    // Only preselect the current assignee if they're still an active member
    // of this project — otherwise the dropdown would silently show
    // "Unassigned" while this state still held their (now invalid) id, and
    // an untouched Save would resend a changed (null) assigneeId, silently
    // unassigning them. But projectMembers (useApi) is still loading on a
    // fresh panel mount, and projectMembersForAssignee is [] until it
    // resolves — so only clear the assignee when membership data has
    // actually loaded and positively excludes them, never while it's still
    // unknown (which would otherwise wrongly clear a genuinely valid
    // assignee just because this ran before the fetch landed).
    const knownInvalid =
      s.assigneeId != null && projectMembers != null && !projectMembersForAssignee.some((m) => m.id === s.assigneeId)
    setEditSubtaskAssigneeId(s.assigneeId != null && !knownInvalid ? String(s.assigneeId) : '')
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
      await createComment({ taskId: task.id, message: comment.trim(), parentCommentId: replyingTo?.id ?? null })
      setComment('')
      setReplyingTo(null)
      refetchComments()
      refetchActivity()
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

  const awaitingApproval = task?.status === 'IN_REVIEW' && task?.approvalStatus === 'PENDING'
  const canSubmitForReview = task?.status === 'IN_PROGRESS' && canChangeStatus
  const canDecide = awaitingApproval && canApprove
  // Members of this project who could be named the approver (the server re-checks).
  const approverCandidates = (projectMembers ?? []).filter(
    (pm) =>
      pm.status === 'ACTIVE' &&
      pm.project?.id === projectId &&
      ['OWNER', 'ADMIN'].includes(pm.projectRole) &&
      pm.user?.accountStatus === 'ACTIVE'
  )

  const afterApprovalChange = () => {
    refetchApprovals()
    refetchActivity()
    onChange?.()
  }

  const handleSubmitForReview = async () => {
    setApprovalBusy(true)
    try {
      await submitForReview(task.id)
      notify('Submitted for review', { tone: 'success' })
      afterApprovalChange()
    } catch (err) {
      notify(err.message || 'Failed to submit for review', { tone: 'error' })
    } finally {
      setApprovalBusy(false)
    }
  }

  const handleDecision = async (decision) => {
    const comment = approvalComment.trim()
    if (decision !== 'APPROVED' && !comment) {
      notify(decision === 'REJECTED' ? 'Say why it is rejected.' : 'Say what has to change.', { tone: 'error' })
      return
    }
    if (decision === 'APPROVED' && hasIncompleteSubtasks) {
      notify('Complete all subtasks before marking this task as done.', { tone: 'error' })
      return
    }
    setApprovalBusy(true)
    try {
      await decideApproval(task.id, {
        decision,
        comment,
        nextStatus: decision === 'REJECTED' ? rejectNext : null,
      })
      setApprovalComment('')
      notify(
        decision === 'APPROVED' ? 'Approved — the task is completed' : decision === 'REJECTED' ? 'Rejected' : 'Changes requested',
        { tone: 'success' }
      )
      afterApprovalChange()
    } catch (err) {
      notify(err.message || 'Failed to record the decision', { tone: 'error' })
    } finally {
      setApprovalBusy(false)
    }
  }

  const handleApproverChange = async (value) => {
    setApprovalBusy(true)
    try {
      await setTaskApprover(task.id, value ? Number(value) : null)
      afterApprovalChange()
    } catch (err) {
      notify(err.message || 'Failed to set the approver', { tone: 'error' })
    } finally {
      setApprovalBusy(false)
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
      refetchApprovals()
      refetchActivity()
      onChange?.()
    } catch (err) {
      setStatus(previous)
      notify(err.message || 'Failed to update status', { tone: 'error' })
    } finally {
      setSavingStatus(false)
    }
  }

  // One comment and, indented under it, its replies. Deeper levels stop indenting
  // so a long exchange stays readable in the narrow panel.
  const renderThread = (c, depth) => {
    const isOwn = profile?.id != null && c.userId === profile.id
    const author = getMember(c.userId)
    const replies = commentThreads.repliesOf.get(c.id) ?? []
    return (
      <div key={c.id} className={depth > 0 ? `border-divider ${depth <= 2 ? 'ml-8' : ''} border-l pl-3` : ''}>
        <div className="group flex gap-2.5" data-testid="comment">
          <Avatar
            initials={initialsFor(c.authorName)}
            color="var(--accent-purple)"
            photoUrl={author?.photoUrl}
            size={depth > 0 ? 24 : 28}
          />
          <div className="min-w-0 flex-1">
            <div className="mb-[3px] flex items-baseline gap-2">
              <span className="text-[12px] font-[650]">{c.authorName}</span>
              <span className="text-faint text-[12px]">{timeAgo(c.createdAt)}</span>
              <span className="ml-auto flex items-center gap-1">
                {canComment && (
                  <button
                    type="button"
                    className="text-muted hover:text-ink inline-flex items-center gap-1 text-[12px] font-semibold"
                    aria-label={`Reply to ${c.authorName}`}
                    onClick={() => setReplyingTo({ id: c.id, authorName: c.authorName })}
                  >
                    <Reply size={12} /> Reply
                  </button>
                )}
                {isOwn && (
                  <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
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
                      className="icon-btn h-6 w-6 hover:text-danger-ink"
                      aria-label="Delete comment"
                      onClick={() => removeComment(c.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                )}
                {!isOwn && canModerateComments && (
                  <button
                    type="button"
                    className="icon-btn h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-danger-ink"
                    aria-label="Delete comment"
                    onClick={() => removeComment(c.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </span>
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
                  className="bg-subtle border-border focus:border-focus h-8 flex-1 rounded-md border px-2.5 text-[12px] outline-none"
                />
                <button type="submit" className="text-lavender text-[12px] font-semibold">
                  Save
                </button>
                <button
                  type="button"
                  className="text-muted text-[12px] font-semibold"
                  onClick={() => setEditingCommentId(null)}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <p className="text-muted text-[12px] leading-normal break-words">{c.message}</p>
            )}
          </div>
        </div>
        {replies.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">{replies.map((reply) => renderThread(reply, depth + 1))}</div>
        )}
      </div>
    )
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
      className="animate-fade-in fixed inset-0 z-[60] flex justify-end bg-scrim"
      onClick={onClose}
    >
      <aside
        className="animate-slide-in bg-card shadow-pop flex h-full w-[440px] max-w-[100vw] flex-col max-sm:w-[100vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-divider flex items-center justify-between border-b px-[22px] py-[18px]">
          <span className="text-ink text-[15px] font-[650]">
            Task
          </span>
          <div className="flex items-center gap-2">
            {canEditTask && (
              <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit task">
                <Pencil size={16} />
              </button>
            )}
            {canDeleteTask && (
              <button
                className="icon-btn hover:text-danger-ink"
                onClick={() => setConfirmingDelete(true)}
                aria-label="Delete task"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Close panel">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-[22px] pt-5 pb-6">
          <h2 className="mb-3.5 text-xl font-bold tracking-[-0.015em]">{task.title}</h2>

          <div className={`flex flex-wrap items-center gap-2 ${hasIncompleteSubtasks ? 'mb-1.5' : 'mb-5'}`}>
            {canChangeStatus ? (
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={savingStatus}
                aria-label="Task status"
                className="bg-subtle border-border h-8 rounded-full border px-2.5 text-[12px] font-semibold outline-none"
              >
                {STATUS_OPTIONS.filter((s) => s !== 'COMPLETED' || canApprove || status === 'COMPLETED').map((s) => (
                  <option key={s} value={s} disabled={s === 'COMPLETED' && hasIncompleteSubtasks}>
                    {s === 'IN_REVIEW' && !canApprove ? 'In Review (submit for approval)' : humanizeEnum(s)}
                  </option>
                ))}
              </select>
            ) : (
              <Badge tone={status}>{humanizeEnum(status)}</Badge>
            )}
            <Badge tone={task.priority}>{humanizeEnum(task.priority)}</Badge>
            {task.overdue && (
              <span className="bg-danger-soft text-danger-ink inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold">
                <AlertTriangle size={12} /> Overdue
              </span>
            )}
            {task.blocked && (
              <span
                title={blockedReason(task)}
                className="bg-subtle text-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold"
              >
                <Lock size={12} /> Blocked
              </span>
            )}
          </div>
          {hasIncompleteSubtasks && (
            <p className="text-warning-ink mb-3.5 text-[12px] font-medium">
              Complete all subtasks before marking this task as done.
            </p>
          )}

          {(awaitingApproval || canSubmitForReview || canAssignTask || approvals.length > 0) && (
            <section aria-label="Approval" data-testid="approval-section" className="mb-[22px]">
              <h4 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-[650]">
                <ClipboardCheck size={14} /> Approval
              </h4>
              {awaitingApproval && (
                <p className="bg-warning-soft text-warning-ink mb-2.5 rounded-md px-3 py-2 text-[12px] font-semibold">
                  Awaiting approval — requested by {task.approvalRequestedBy?.fullName ?? 'someone'}
                  {task.approvalRequestedAt ? ` · ${timeAgo(task.approvalRequestedAt)}` : ''}.{' '}
                  {task.approver ? `Approver: ${task.approver.fullName}.` : 'Any approver can decide.'}
                </p>
              )}
              {canSubmitForReview && (
                <button
                  type="button"
                  className="btn btn-secondary mb-2.5"
                  onClick={handleSubmitForReview}
                  disabled={approvalBusy}
                >
                  <Send size={14} /> Submit for review
                </button>
              )}
              {canDecide && (
                <div className="bg-subtle border-border mb-2.5 flex flex-col gap-2 rounded-md border p-3">
                  <textarea
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="Comment (required to request changes or reject)"
                    aria-label="Approval comment"
                    rows={2}
                    maxLength={1000}
                    className="bg-card border-border focus:border-focus rounded-md border px-2.5 py-2 text-[12px] outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="btn btn-primary" disabled={approvalBusy} onClick={() => handleDecision('APPROVED')}>
                      Approve
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={approvalBusy} onClick={() => handleDecision('CHANGES_REQUESTED')}>
                      Request changes
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={approvalBusy} onClick={() => handleDecision('REJECTED')}>
                      Reject
                    </button>
                    <select
                      value={rejectNext}
                      onChange={(e) => setRejectNext(e.target.value)}
                      aria-label="After rejecting"
                      className="bg-card border-border h-8 rounded-md border px-2 text-[12px] outline-none"
                    >
                      <option value="IN_PROGRESS">then reopen as In Progress</option>
                      <option value="CANCELLED">then cancel the task</option>
                    </select>
                  </div>
                </div>
              )}
              {canAssignTask && (
                <label className="mb-2.5 flex items-center gap-2 text-[12px]">
                  <span className="text-faint font-semibold">Approver</span>
                  <select
                    value={task.approver?.id ?? ''}
                    onChange={(e) => handleApproverChange(e.target.value)}
                    disabled={approvalBusy}
                    aria-label="Approver"
                    className="bg-subtle border-border h-8 min-w-0 flex-1 rounded-md border px-2 text-[12px] outline-none"
                  >
                    <option value="">Any approver</option>
                    {approverCandidates.map((pm) => (
                      <option key={pm.user.id} value={pm.user.id}>
                        {pm.user.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {approvals.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {approvals.map((a) => (
                    <li key={a.id} className="text-[12px] leading-snug">
                      <span className="text-ink font-semibold">{DECISION_LABELS[a.decision] ?? a.decision}</span>
                      <span className="text-muted">
                        {' '}— requested by {a.requestedBy?.fullName ?? 'someone'} · {timeAgo(a.requestedAt)}
                        {a.decidedBy ? `; ${a.decision === 'WITHDRAWN' ? 'withdrawn' : 'decided'} by ${a.decidedBy.fullName}` : ''}
                      </span>
                      {a.comment && <p className="text-muted mt-0.5">“{a.comment}”</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <div className="bg-subtle border-border mb-[22px] grid grid-cols-2 gap-4 rounded-md border p-4 max-sm:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[12px] font-semibold">
                <CalendarDays size={14} /> Due date
              </span>
              <span className="text-ink text-[13px] font-semibold">{formatDate(task.dueDate)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[12px] font-semibold">
                <FolderKanban size={14} /> Project
              </span>
              <span className="text-ink text-[13px] font-semibold">{task.project?.name}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[12px] font-semibold">
                <Flag size={14} /> Priority
              </span>
              <span className="text-ink text-[13px] font-semibold">{humanizeEnum(task.priority)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint text-[12px] font-semibold">Assignee</span>
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
              <span className="text-faint text-[12px] font-semibold">
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
                        className="bg-card border-border focus:border-focus h-8 rounded-md border px-2.5 text-[12px] outline-none"
                      />
                      <div className="flex gap-2">
                        <select
                          value={editSubtaskAssigneeId}
                          onChange={(e) => setEditSubtaskAssigneeId(e.target.value)}
                          className="bg-card border-border h-8 flex-1 rounded-md border px-2 text-[12px] outline-none"
                        >
                          <option value="">Unassigned</option>
                          {projectMembersForAssignee.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.fullName}
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
                          className="text-muted hover:text-ink text-[12px] font-semibold"
                          onClick={() => setEditingSubtaskId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="text-lavender text-[12px] font-semibold"
                          onClick={() => saveEditSubtask(s)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )
                }

                const subtaskAssignee = getMember(s.assigneeId)
                const RowTag = canEditSubtask ? 'button' : 'div'
                return (
                  <div
                    key={s.id}
                    className="text-ink hover:bg-subtle group duration-[var(--duration-fast)] ease-[var(--ease-standard)] flex items-center gap-2.5 rounded-sm px-1 py-2 text-left text-[13px] transition-colors [&_svg]:text-faint [&_svg]:shrink-0"
                  >
                    <RowTag
                      type={canEditSubtask ? 'button' : undefined}
                      className="flex min-w-0 flex-1 items-center gap-2.5 border-none bg-none text-left"
                      onClick={canEditSubtask ? () => toggleSubtask(s) : undefined}
                    >
                      {s.status === 'COMPLETED' ? <CheckSquare size={17} className="shrink-0" /> : <Square size={17} className="shrink-0" />}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={`truncate ${s.status === 'COMPLETED' ? 'text-faint line-through' : ''}`}>
                          {s.title}
                        </span>
                        {(subtaskAssignee || s.dueDate) && (
                          <span className="text-faint flex items-center gap-1.5 truncate text-[12px] font-normal">
                            {subtaskAssignee && <span className="truncate">{subtaskAssignee.name}</span>}
                            {subtaskAssignee && s.dueDate && <span>·</span>}
                            {s.dueDate && <span className="shrink-0">{formatDate(s.dueDate)}</span>}
                          </span>
                        )}
                      </span>
                    </RowTag>
                    {canEditSubtask && (
                      <button
                        type="button"
                        className="icon-btn h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                        aria-label="Edit subtask"
                        onClick={() => startEditSubtask(s)}
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {canDeleteSubtask && (
                      <button
                        type="button"
                        className="icon-btn h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 hover:text-danger-ink"
                        aria-label="Delete subtask"
                        onClick={() => removeSubtask(s.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {canCreateSubtask && (
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
                  className="field field-sm flex-1"
                />
                <button type="submit" className="btn btn-secondary px-3 py-2 text-[12px]">
                  Add
                </button>
              </form>
            )}
          </div>

          <ChecklistSection
            taskId={task.id}
            canAdd={canAddChecklist}
            canTick={canTickChecklist}
            canDelete={canDeleteChecklist}
            currentUserId={profile?.id}
            onChange={() => {
              refetchActivity()
              onChange?.()
            }}
          />

          <div className="mb-[22px]">
            <div className="mb-2.5 flex items-center gap-2">
              <Link2 size={14} className="text-faint" />
              <h4 className="text-[13px] font-[650]">Depends on</h4>
            </div>
            {dependencies.length === 0 && (
              <p className="text-faint text-[12px]">No dependencies.</p>
            )}
            <div className="flex flex-col gap-0.5">
              {dependencies.map((d) => (
                <div
                  key={d.dependsOnTask.id}
                  className="hover:bg-subtle group flex items-center gap-2.5 rounded-sm px-1 py-2 text-[13px]"
                >
                  {d.dependsOnTask.status === 'COMPLETED' ? (
                    <CheckSquare size={15} className="text-success-ink shrink-0" />
                  ) : (
                    <Square size={15} className="text-faint shrink-0" />
                  )}
                  <span
                    className={`flex-1 truncate ${d.dependsOnTask.status === 'COMPLETED' ? 'text-faint line-through' : 'text-ink'}`}
                  >
                    {d.dependsOnTask.title}
                  </span>
                  {canAssignTask && (
                    <button
                      type="button"
                      className="icon-btn h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 hover:text-danger-ink"
                      aria-label="Remove dependency"
                      onClick={() => removeDependency(d.dependsOnTask.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canAssignTask && availableToDepend.length > 0 && (
              <div className="mt-1 flex items-center gap-2">
                <select
                  value={newDependencyId}
                  onChange={(e) => setNewDependencyId(e.target.value)}
                  className="field field-sm flex-1"
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

          <TimeTracking
            task={task}
            canLog={canLogTime}
            canManage={canDeleteAnyTimeEntry}
            currentUserId={profile?.id}
            onChange={onChange}
          />

          <AttachmentsSection
            taskId={task.id}
            canUpload={canUploadFiles}
            canDelete={canDeleteAnyFile}
            currentUserId={profile?.id}
            onChange={refetchActivity}
          />

          <div className="mb-[22px]">
            <h4 className="mb-2.5 text-[13px] font-[650]">Comments</h4>
            {comments.length === 0 && (
              <p className="text-faint text-[12px]">No comments yet.</p>
            )}
            <div className="flex flex-col gap-3.5">
              {commentThreads.roots.map((c) => renderThread(c, 0))}
            </div>
          </div>

          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <History size={14} className="text-faint" />
              <h4 className="text-[13px] font-[650]">Activity</h4>
            </div>
            {activity.length === 0 && <p className="text-faint text-[12px]">No activity yet.</p>}
            <div className="flex flex-col gap-3">
              {activity.map((a) => (
                <div key={a.id} className="flex gap-2.5">
                  <span className="bg-subtle text-faint mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                    <History size={12} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink text-[12px] leading-snug">{a.description}</p>
                    <span className="text-faint text-[12px]">
                      {a.userName} · {timeAgo(a.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {canComment && (
          <form className="border-divider flex flex-col gap-2 border-t px-[18px] py-3.5" onSubmit={submitComment}>
            {replyingTo && (
              <div className="bg-subtle text-muted flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[12px]">
                <span className="truncate">Replying to {replyingTo.authorName}</span>
                <button
                  type="button"
                  className="icon-btn h-6 w-6 shrink-0"
                  aria-label="Cancel reply"
                  onClick={() => setReplyingTo(null)}
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="field flex-1"
              />
              <button type="submit" className="icon-btn" aria-label="Send comment">
                <Send size={16} />
              </button>
            </div>
          </form>
        )}
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
