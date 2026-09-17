import { useEffect, useMemo, useState } from 'react'
import { X, FolderKanban, Flag, CalendarDays } from 'lucide-react'
import { Modal } from './ui/Modal'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { useToast } from './ui/Toast'
import { useDirtyForm } from './ui/useDirtyForm'
import { useApi } from '../api/useApi'
import { getProjects } from '../api/projects'
import { getProjectMembers } from '../api/projectMembers'
import { createTask, taskResponseToRequest, updateTask } from '../api/tasks'
import { getTaskAssignees, createTaskAssignee, deleteTaskAssignee } from '../api/taskAssignees'
import { useAuth } from '../auth/AuthContext'
import { canEditProjectContent, canManageProject } from '../api/permissions'
import { buildMyProjectRoleMap, getActiveProjectMembers } from '../api/relations'
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
  const [estimatedHours, setEstimatedHours] = useState(
    task?.estimatedHours != null ? String(task.estimatedHours) : ''
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const effectiveProjectId = projectId || (selectableProjects[0] ? String(selectableProjects[0].id) : '')
  // Assigning a task to someone else requires OWNER/ADMIN of ITS project —
  // a MEMBER can create/edit tasks but not hand them to other people (see
  // ProjectAccessGuard.canManage on the backend).
  const canAssign = canManageProject(myProjectRoleMap.get(Number(effectiveProjectId)), isSystemAdmin)

  // The real ACTIVE members of the currently selected project only — not
  // the org-wide directory (useMembers()), which includes anyone the caller
  // shares ANY project with. Assigning outside this list isn't a valid
  // choice: the backend now rejects it too (TaskAssigneeService).
  const projectMembersForAssignee = useMemo(
    () => getActiveProjectMembers(projectMembers, effectiveProjectId),
    [projectMembers, effectiveProjectId]
  )
  // Switching the Project dropdown can strand a previously-picked assignee
  // who isn't a member of the newly selected project — clear it rather than
  // silently submit an assignment the backend will now reject. Adjusted
  // during render (React's recommended pattern for "state depends on a prop/
  // derived value changing" — see https://react.dev/learn/you-might-not-need-an-effect,
  // and TaskDetailPanel's own syncedStatus for the same pattern in this
  // codebase) rather than an effect, guarded so it only re-checks once per
  // actual project change and only once projectMembers has actually loaded
  // (so a valid existing assignee isn't wiped out before that data arrives).
  //
  // checkedProjectId's initial value is the project this form opened with
  // (captured once, synchronously — not dependent on projectMembers having
  // loaded), not null. That means this only ever fires on a project change
  // the user actually makes here, never retroactively against the task's
  // original assignee once async data lands: doing that on load would clear
  // a since-removed member's stale assignment (correct on its own) but do
  // it via setState after useDirtyForm's mount snapshot was already taken,
  // making an untouched form register as dirty and wrongly prompt "discard
  // changes?" on a plain Cancel — confirmed live before this guard existed.
  // An already-stale assignee is instead left as-is until the user changes
  // something, same as SubtaskService now only re-validates on an actual
  // reassignment rather than every save.
  const [checkedProjectId, setCheckedProjectId] = useState(() => effectiveProjectId)
  if (projectMembers && effectiveProjectId && effectiveProjectId !== checkedProjectId) {
    setCheckedProjectId(effectiveProjectId)
    if (assigneeId && !projectMembersForAssignee.some((m) => String(m.id) === assigneeId)) {
      setAssigneeId('')
    }
  }

  const isDirty = useDirtyForm({
    title,
    projectId,
    description,
    priority,
    startDate,
    dueDate,
    assigneeId,
    estimatedHours,
  })

  // New Task renders its own right-side drawer chrome (to match
  // TaskDetailPanel) instead of going through the shared centered <Modal>,
  // so it needs its own copy of the same dirty-check-before-close guard
  // Modal already provides for the Edit path below — same isDirty snapshot,
  // just not routed through that component.
  const [confirmingClose, setConfirmingClose] = useState(false)
  const requestClose = () => {
    if (isDirty) setConfirmingClose(true)
    else onClose()
  }

  useEffect(() => {
    if (isEdit || !isDirty) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isEdit, isDirty])

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
    if (estimatedHours !== '' && Number(estimatedHours) < 0) {
      setError('Estimated hours cannot be negative')
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
              estimatedHours: estimatedHours !== '' ? Number(estimatedHours) : null,
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
            estimatedHours: estimatedHours !== '' ? Number(estimatedHours) : null,
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

  // Edit keeps the existing centered dialog (unchanged) — only New Task
  // becomes a right-side drawer matching TaskDetailPanel, per the redesign
  // request; editing a task already happens with TaskDetailPanel's own
  // drawer open behind it, so turning this into a second right-side drawer
  // would stack two of them rather than match that pattern.
  if (isEdit) {
    return (
      <Modal title="Edit Task" onClose={onClose} isDirty={isDirty}>
        {({ requestClose: requestCloseModal }) => (
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
                    {projectMembersForAssignee.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                  {canAssign && projectMembers && projectMembersForAssignee.length === 0 && (
                    <span className="text-faint text-[11.5px]">No members in this project yet.</span>
                  )}
                </label>
              )}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-muted text-[12.5px] font-semibold">Estimated hours</span>
              <input
                type="number"
                min="0"
                step="0.25"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="e.g. 4"
                className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
              />
            </label>

            {error && <p className="text-danger text-[12.5px] font-semibold">{error}</p>}

            <div className="mt-1 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={requestCloseModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting || !effectiveProjectId}>
                {submitting ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    )
  }

  // New Task: a right-side drawer reusing TaskDetailPanel's exact chrome
  // (backdrop, aside sizing/animation, header row, scrollable body, footer
  // bar) instead of the centered Modal, per the redesign request — same
  // fields/validation/API calls as before, just laid out like that panel's
  // own sections (a bordered "details" box for the short fields, then
  // labeled sections below for the longer ones).
  return (
    <>
      <div
        className="animate-fade-in fixed inset-0 z-[60] flex justify-end bg-[rgba(20,20,22,.4)] backdrop-blur-[2px]"
        onClick={requestClose}
      >
        <aside
          className="animate-slide-in bg-card shadow-pop flex h-full w-[440px] max-w-[100vw] flex-col max-sm:w-[100vw]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-divider flex items-center justify-between border-b px-[22px] py-[18px]">
            <span className="text-faint text-[11.5px] font-[650] tracking-[0.05em] uppercase">New Task</span>
            <button className="icon-btn" onClick={requestClose} aria-label="Close panel">
              <X size={18} />
            </button>
          </div>

          <form id="new-task-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-[22px] pt-5 pb-6">
            <label className="mb-5 flex flex-col gap-1.5">
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

            <div className="bg-subtle border-border mb-[22px] grid grid-cols-2 gap-4 rounded-md border p-4 max-sm:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                  <FolderKanban size={14} /> Project
                </span>
                <select
                  value={effectiveProjectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="bg-card border-border focus:border-lavender h-9 rounded-md border px-2.5 text-[12.5px] outline-none"
                  required
                >
                  {!selectableProjects.length && <option value="">No projects available</option>}
                  {selectableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                  <Flag size={14} /> Priority
                </span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="bg-card border-border focus:border-lavender h-9 rounded-md border px-2.5 text-[12.5px] outline-none"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {humanizeEnum(p)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                  <CalendarDays size={14} /> Start date
                </span>
                <input
                  type="date"
                  value={startDate ?? ''}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-card border-border focus:border-lavender h-9 rounded-md border px-2.5 text-[12.5px] outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                  <CalendarDays size={14} /> Due date
                </span>
                <input
                  type="date"
                  value={dueDate ?? ''}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-card border-border focus:border-lavender h-9 rounded-md border px-2.5 text-[12.5px] outline-none"
                />
              </div>

              {canAssign && (
                <div className="col-span-2 flex flex-col gap-1.5 max-sm:col-span-1">
                  <span className="text-faint text-[11.5px] font-semibold">Assignee</span>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="bg-card border-border focus:border-lavender h-9 rounded-md border px-2.5 text-[12.5px] outline-none"
                  >
                    <option value="">Unassigned</option>
                    {projectMembersForAssignee.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                  {projectMembers && projectMembersForAssignee.length === 0 && (
                    <span className="text-faint text-[11.5px]">No members in this project yet.</span>
                  )}
                </div>
              )}
            </div>

            <div className="mb-[22px]">
              <h4 className="mb-2.5 text-[13px] font-[650]">Description</h4>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Add a description…"
                className="bg-subtle border-border focus:border-lavender w-full rounded-md border px-3 py-2 text-[13px] leading-relaxed outline-none"
              />
            </div>

            <div>
              <h4 className="mb-2.5 text-[13px] font-[650]">Estimated hours</h4>
              <input
                type="number"
                min="0"
                step="0.25"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="e.g. 4"
                className="bg-subtle border-border focus:border-lavender h-10 w-full max-w-[160px] rounded-md border px-3 text-[13.5px] outline-none"
              />
            </div>

            {error && <p className="text-danger mt-4 text-[12.5px] font-semibold">{error}</p>}
          </form>

          <div className="border-divider flex items-center justify-end gap-2 border-t px-[18px] py-3.5">
            <button type="button" className="btn btn-secondary" onClick={requestClose}>
              Cancel
            </button>
            <button
              type="submit"
              form="new-task-form"
              className="btn btn-primary"
              disabled={submitting || !effectiveProjectId}
            >
              {submitting ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </aside>
      </div>

      {confirmingClose && (
        <ConfirmDialog
          title="Discard changes?"
          message="You have unsaved changes. Closing now will discard them."
          confirmLabel="Discard"
          onConfirm={onClose}
          onClose={() => setConfirmingClose(false)}
        />
      )}
    </>
  )
}
