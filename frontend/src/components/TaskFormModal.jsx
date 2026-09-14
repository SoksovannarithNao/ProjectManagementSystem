import { useMemo, useState } from 'react'
import { Modal } from './ui/Modal'
import { useToast } from './ui/Toast'
import { useApi } from '../api/useApi'
import { getProjects } from '../api/projects'
import { getProjectMembers } from '../api/projectMembers'
import { createTask, taskResponseToRequest, updateTask } from '../api/tasks'
import { getTaskAssignees, createTaskAssignee, deleteTaskAssignee } from '../api/taskAssignees'
import { useMembers } from '../data/UsersContext'
import { useAuth } from '../auth/AuthContext'
import { canEditProjectContent, canManageProject } from '../api/permissions'
import { buildMyProjectRoleMap } from '../api/relations'
import { humanizeEnum } from '../api/format'

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

// New tasks always start in TO_DO — per the board's workflow, they only ever
// reach Doing/Done by being moved forward from there, never created directly.
// Editing an existing task (`task` passed) keeps its current status untouched.
export function TaskFormModal({ task, defaultProjectId, defaultDueDate, onClose, onSaved }) {
  const isEdit = Boolean(task)
  const notify = useToast()
  const { role, profile } = useAuth()
  const { members } = useMembers()
  const isSystemAdmin = role === 'ADMINISTRATOR'
  const { data: projects } = useApi(getProjects)
  const { data: projectMembers } = useApi(getProjectMembers)
  const { data: taskAssignees } = useApi(getTaskAssignees)
  const myProjectRoleMap = useMemo(
    () => buildMyProjectRoleMap(projectMembers, profile?.id),
    [projectMembers, profile]
  )
  // Only offer projects the caller can actually create/edit tasks in
  // (OWNER/ADMIN/MEMBER, not VIEWER) — the backend enforces this
  // authoritatively regardless, this just avoids an obvious 403.
  const selectableProjects = useMemo(
    () => (projects ?? []).filter((p) => canEditProjectContent(myProjectRoleMap.get(p.id), isSystemAdmin)),
    [projects, myProjectRoleMap, isSystemAdmin]
  )
  const [title, setTitle] = useState(task?.title ?? '')
  const [projectId, setProjectId] = useState(
    task?.project?.id ? String(task.project.id) : defaultProjectId ? String(defaultProjectId) : ''
  )
  const [description, setDescription] = useState(task?.description ?? '')
  const [priority, setPriority] = useState(task?.priority ?? 'MEDIUM')
  const [startDate, setStartDate] = useState(task?.startDate ?? todayIso())
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaultDueDate ?? '')
  const [assigneeId, setAssigneeId] = useState(
    task?.assigneeIds?.[0] != null ? String(task.assigneeIds[0]) : ''
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const effectiveProjectId = projectId || (selectableProjects[0] ? String(selectableProjects[0].id) : '')
  // Assigning a task to someone else requires OWNER/ADMIN of ITS project —
  // a MEMBER can create/edit tasks but not hand them to other people (see
  // ProjectAccessGuard.canManage on the backend).
  const canAssign = canManageProject(myProjectRoleMap.get(Number(effectiveProjectId)), isSystemAdmin)

  // Reconcile the task's single assignee against the task-assignees join
  // table — Task itself carries no assignee field, assignment is a separate
  // POST/DELETE against /api/task-assignees.
  const syncAssignee = async (taskId) => {
    const existing = (taskAssignees ?? []).find((ta) => ta.task?.id === taskId)
    const existingUserId = existing?.user?.id != null ? String(existing.user.id) : ''
    if (existingUserId === assigneeId) return
    if (existing) await deleteTaskAssignee(existing.id)
    if (assigneeId) await createTaskAssignee({ taskId, userId: Number(assigneeId) })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !effectiveProjectId) return
    if (startDate && dueDate && startDate > dueDate) {
      setError('Start date must be on or before the due date')
      return
    }
    setSubmitting(true)
    setError('')

    // The task save and the assignee sync are two separate API calls — if the
    // task itself saves but the assignee sync then fails (e.g. the selected
    // user isn't a member of the task's project, rejected by a DB trigger),
    // the task must not be left stranded behind a form the user might
    // resubmit and duplicate. So: save the task first and bail out on
    // failure (nothing created yet, safe to retry); once it succeeds, always
    // close and report success — an assignee failure afterward is reported
    // separately and doesn't reopen the form.
    let saved
    try {
      saved = isEdit
        ? await updateTask(
            task.id,
            taskResponseToRequest(task, {
              projectId: Number(effectiveProjectId),
              title: title.trim(),
              description: description.trim() || null,
              priority,
              startDate: startDate || null,
              dueDate: dueDate || null,
            })
          )
        : await createTask({
            projectId: Number(effectiveProjectId),
            title: title.trim(),
            description: description.trim() || null,
            priority,
            status: 'TO_DO',
            startDate: startDate || null,
            dueDate: dueDate || null,
            progress: 0,
          })
    } catch (err) {
      setError(err.message || `Failed to ${isEdit ? 'update' : 'create'} task`)
      setSubmitting(false)
      return
    }

    let assigneeError = ''
    if (canAssign) {
      try {
        await syncAssignee(saved.id)
      } catch (err) {
        assigneeError = err.message || 'Failed to update the assignee'
      }
    }

    onSaved?.(saved)
    onClose()
    if (assigneeError) {
      notify(`Task "${saved.title}" ${isEdit ? 'updated' : 'created'}, but ${assigneeError}`, { tone: 'error' })
    } else {
      notify(`Task "${saved.title}" ${isEdit ? 'updated' : 'created'}`, { tone: 'success' })
    }
  }

  return (
    <Modal title={isEdit ? 'Edit Task' : 'New Task'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[12.5px] font-semibold">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
            autoFocus
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[12.5px] font-semibold">Project</span>
          <select
            value={effectiveProjectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="bg-subtle border-border h-10 rounded-md border px-3 text-[13.5px] outline-none"
            required
          >
            {!selectableProjects.length && <option value="">No projects available</option>}
            {selectableProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[12.5px] font-semibold">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="bg-subtle border-border focus:border-lavender rounded-md border px-3 py-2 text-[13.5px] outline-none"
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12.5px] font-semibold">Start date</span>
            <input
              type="date"
              value={startDate ?? ''}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-subtle border-border h-10 rounded-md border px-3 text-[13.5px] outline-none"
              required
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12.5px] font-semibold">Due date</span>
            <input
              type="date"
              value={dueDate ?? ''}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-subtle border-border h-10 rounded-md border px-3 text-[13.5px] outline-none"
            />
          </label>
        </div>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12.5px] font-semibold">Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="bg-subtle border-border h-10 rounded-md border px-3 text-[13.5px] outline-none"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {humanizeEnum(p)}
                </option>
              ))}
            </select>
          </label>
          {canAssign && (
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-muted text-[12.5px] font-semibold">Assignee</span>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="bg-subtle border-border h-10 rounded-md border px-3 text-[13.5px] outline-none"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {error && <p className="text-danger text-[12.5px] font-semibold">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || !effectiveProjectId}>
            {submitting ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
