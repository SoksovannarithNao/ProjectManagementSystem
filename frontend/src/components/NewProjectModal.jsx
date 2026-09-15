import { useState } from 'react'
import { Modal } from './ui/Modal'
import { useToast } from './ui/Toast'
import { createProject, updateProject } from '../api/projects'
import { humanizeEnum } from '../api/format'

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

// No manager picker — the authenticated caller always becomes the project's
// manager/OWNER on create (see backend ProjectService.createProject) and
// stays the manager on edit (applyRequest keeps the existing one unless a
// system ADMINISTRATOR names someone else, which this form doesn't expose).
// Status isn't editable here either — that's a quick inline control on the
// project detail page (like the task status dropdown), not part of this
// content form, and PUT only touches fields it's sent (see
// projectResponseToRequest), so leaving it out on edit doesn't reset it.
export function NewProjectModal({ project, onClose, onSaved }) {
  const isEdit = Boolean(project)
  const notify = useToast()
  const [name, setName] = useState(project?.name ?? '')
  const [projectCode, setProjectCode] = useState(project?.projectCode ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [startDate, setStartDate] = useState(project?.startDate ?? '')
  const [endDate, setEndDate] = useState(project?.endDate ?? '')
  const [priority, setPriority] = useState(project?.priority ?? 'MEDIUM')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !projectCode.trim() || !startDate || !endDate) return
    if (startDate > endDate) {
      setError('Start date must be on or before the end date')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        projectCode: projectCode.trim(),
        name: name.trim(),
        description: description.trim() || null,
        startDate,
        endDate,
        priority,
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

  return (
    <Modal title={isEdit ? 'Edit Project' : 'New Project'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[12.5px] font-semibold">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
            autoFocus
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[12.5px] font-semibold">Project code</span>
          <input
            type="text"
            value={projectCode}
            onChange={(e) => setProjectCode(e.target.value)}
            maxLength={30}
            placeholder="e.g. WEB-RD"
            className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
            required
          />
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
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-subtle border-border h-10 rounded-md border px-3 text-[13.5px] outline-none"
              required
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12.5px] font-semibold">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-subtle border-border h-10 rounded-md border px-3 text-[13.5px] outline-none"
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
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

        {error && <p className="text-danger text-[12.5px] font-semibold">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
