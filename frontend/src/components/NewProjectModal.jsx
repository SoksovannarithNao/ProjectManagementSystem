import { useEffect, useState } from 'react'
import { X, Flag, CalendarDays } from 'lucide-react'
import { Modal } from './ui/Modal'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { useToast } from './ui/Toast'
import { useDirtyForm } from './ui/useDirtyForm'
import { createProject, updateProject } from '../api/projects'
import { useAuth } from '../auth/AuthContext'
import { useMembers } from '../data/UsersContext'
import { humanizeEnum } from '../api/format'

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

// Manager reassignment is admin-only and edit-only — the authenticated
// caller always becomes the project's manager/OWNER on create (see backend
// ProjectService.createProject), and on update, applyRequest keeps the
// existing manager unless request.managerId names someone else AND the
// caller is a system ADMINISTRATOR (a non-admin's managerId is silently
// ignored server-side, so there's no point offering the field to anyone
// else). Status isn't editable here either — that's a quick inline control
// on the project detail page (like the task status dropdown), not part of
// this content form, and PUT only touches fields it's sent (see
// projectResponseToRequest), so leaving either out on edit doesn't reset it.
//
// The project code is never typed: the backend generates the next PRJ-####
// on create (ProjectService.generateProjectCode) and it's fixed afterwards,
// so Edit shows it read-only.
//
// New Project renders as a right-side drawer matching New Task's chrome
// (TaskFormModal); Edit keeps the centered dialog, same as Edit Task.
export function NewProjectModal({ project, onClose, onSaved }) {
  const isEdit = Boolean(project)
  const notify = useToast()
  const { isAdministrator } = useAuth()
  // Naming someone else as the project's manager is an Administrator-only action.
  const canReassignManager = isEdit && isAdministrator
  // Real org-wide user directory (GET /api/users) — a system ADMINISTRATOR
  // sees everyone there (UserService.getAllUsers), so this is the correct,
  // already-existing source for "who can be named manager", not a new
  // endpoint.
  const { members } = useMembers()
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [startDate, setStartDate] = useState(project?.startDate ?? '')
  const [endDate, setEndDate] = useState(project?.endDate ?? '')
  const [priority, setPriority] = useState(project?.priority ?? 'MEDIUM')
  const [managerId, setManagerId] = useState(project?.manager?.id != null ? String(project.manager.id) : '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isDirty = useDirtyForm({ name, description, startDate, endDate, priority, managerId })

  // Same dirty-check-before-close guard Modal gives the Edit path, for the
  // New Project drawer which renders its own chrome.
  const [confirmingClose, setConfirmingClose] = useState(false)
  const requestDrawerClose = () => {
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !startDate || !endDate) return
    if (startDate > endDate) {
      setError('Start date must be on or before the end date')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        ...(isEdit && { projectCode: project.projectCode }),
        name: name.trim(),
        description: description.trim() || null,
        startDate,
        endDate,
        priority,
      }
      if (canReassignManager && managerId) {
        payload.managerId = Number(managerId)
      }
      const saved = isEdit
        ? await updateProject(project.id, payload)
        : await createProject({ ...payload, status: 'PLANNING', progress: 0 })
      onSaved?.(saved)
      onClose()
      notify(`Project "${saved.name}" ${isEdit ? 'updated' : 'created'}`, { tone: 'success' })
    } catch (err) {
      setError(err.message || `Failed to ${isEdit ? 'update' : 'create'} project`)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isEdit) {
    return (
      <>
        <div
          className="animate-fade-in fixed inset-0 z-[60] flex justify-end bg-scrim"
          onClick={requestDrawerClose}
        >
          <aside
            className="animate-slide-in bg-card shadow-pop flex h-full w-[440px] max-w-[100vw] flex-col max-sm:w-[100vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-divider flex items-center justify-between border-b px-[22px] py-[18px]">
              <span className="text-ink text-[15px] font-[650]">New Project</span>
              <button className="icon-btn" onClick={requestDrawerClose} aria-label="Close panel">
                <X size={18} />
              </button>
            </div>

            <form id="new-project-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-[22px] pt-5 pb-6">
              <label className="mb-5 flex flex-col gap-1.5">
                <span className="text-muted text-[12px] font-semibold">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                  autoFocus
                  required
                />
                <span className="text-faint text-[12px]">A project code (e.g. PRJ-2004) is generated automatically.</span>
              </label>

              <div className="bg-subtle border-border mb-[22px] grid grid-cols-2 gap-4 rounded-md border p-4 max-sm:grid-cols-1">
                <div className="col-span-2 flex flex-col gap-1.5 max-sm:col-span-1">
                  <span className="text-faint inline-flex items-center gap-1.5 text-[12px] font-semibold">
                    <Flag size={14} /> Priority
                  </span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="bg-card border-border focus:border-focus h-9 rounded-md border px-2.5 text-[12px] outline-none"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {humanizeEnum(p)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-faint inline-flex items-center gap-1.5 text-[12px] font-semibold">
                    <CalendarDays size={14} /> Start date
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-card border-border focus:border-focus h-9 rounded-md border px-2.5 text-[12px] outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-faint inline-flex items-center gap-1.5 text-[12px] font-semibold">
                    <CalendarDays size={14} /> End date
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-card border-border focus:border-focus h-9 rounded-md border px-2.5 text-[12px] outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <h4 className="mb-2.5 text-[13px] font-[650]">Description</h4>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Add a description…"
                  className="bg-subtle border-border focus:border-focus w-full rounded-md border px-3 py-2 text-[13px] leading-relaxed outline-none"
                />
              </div>

              {error && <p className="text-danger-ink mt-4 text-[12px] font-semibold">{error}</p>}
            </form>

            <div className="border-divider flex items-center justify-end gap-2 border-t px-[18px] py-3.5">
              <button type="button" className="btn btn-secondary" onClick={requestDrawerClose}>
                Cancel
              </button>
              <button type="submit" form="new-project-form" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Project'}
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

  return (
    <Modal title="Edit Project" onClose={onClose} isDirty={isDirty}>
      {({ requestClose }) => (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[12px] font-semibold">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
            autoFocus
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[12px] font-semibold">Project code</span>
          <input
            type="text"
            value={project.projectCode}
            className="field text-muted"
            readOnly
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[12px] font-semibold">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="bg-subtle border-border focus:border-focus rounded-md border px-3 py-2 text-[13px] outline-none"
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="field"
              required
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="field"
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[12px] font-semibold">Priority</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="field"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {humanizeEnum(p)}
              </option>
            ))}
          </select>
        </label>

        {canReassignManager && (
          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Project manager</span>
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="field"
            >
              {members
                .filter((m) => m.id === project?.manager?.id || m.role === 'PROJECT_MANAGER' || m.role === 'ADMINISTRATOR')
                .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && <p className="text-danger-ink text-[12px] font-semibold">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={requestClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
      )}
    </Modal>
  )
}
