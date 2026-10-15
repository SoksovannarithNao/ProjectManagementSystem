import { useState } from 'react'
import { Flag, CalendarDays } from 'lucide-react'
import { SidePanel } from './ui/SidePanel'
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
// New and Edit both render in the shared right-hand SidePanel, the same frame as the task panel and
// the task form (scrim, title, close button, Escape and the "Discard changes?" check come from it).
export function NewProjectModal({ project, onClose, onSaved }) {
  const isEdit = Boolean(project)
  const notify = useToast()
  const { isAdministrator, refreshProfile } = useAuth()
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
      // The creator is now this project's Owner. The permission list was read at sign-in, so read it
      // again; otherwise the project's page hides the Owner's controls (Add member ...) until a reload.
      if (!isEdit) await refreshProfile().catch(() => {})
      onSaved?.(saved)
      onClose()
      notify(`Project "${saved.name}" ${isEdit ? 'updated' : 'created'}`, { tone: 'success' })
    } catch (err) {
      setError(err.message || `Failed to ${isEdit ? 'update' : 'create'} project`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SidePanel title={isEdit ? 'Edit Project' : 'New Project'} onClose={onClose} isDirty={isDirty}>
      {({ requestClose }) => (
        <>
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
                {!isEdit && (
                  <span className="text-faint text-[12px]">A project code (e.g. PRJ-2004) is generated automatically.</span>
                )}
              </label>

              {isEdit && (
                <label className="mb-5 flex flex-col gap-1.5">
                  <span className="text-muted text-[12px] font-semibold">Project code</span>
                  <input type="text" value={project.projectCode} className="field text-muted" readOnly />
                </label>
              )}

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

              {canReassignManager && (
                <label className="mb-[22px] flex flex-col gap-1.5">
                  <span className="text-muted text-[12px] font-semibold">Project manager</span>
                  <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className="field">
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
            <button type="button" className="btn btn-secondary" onClick={requestClose}>
              Cancel
            </button>
            <button type="submit" form="new-project-form" className="btn btn-primary" disabled={submitting}>
              {isEdit ? (submitting ? 'Saving…' : 'Save Changes') : submitting ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </>
      )}
    </SidePanel>
  )
}
