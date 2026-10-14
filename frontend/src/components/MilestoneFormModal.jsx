import { useState } from 'react'
import { Modal } from './ui/Modal'
import { useToast } from './ui/Toast'
import { useDirtyForm } from './ui/useDirtyForm'
import { updateMilestone } from '../api/milestones'
import { humanizeEnum } from '../api/format'

const STATUS_OPTIONS = ['PENDING', 'IN_PROGRESS', 'COMPLETED']

// Edits one milestone: title, description, due date and status. The due date has to
// stay inside the project's dates (a database rule; the date input shows the range).
// A milestone may be completed while linked tasks are still open (D-08), so that case
// only shows a warning - the tasks are not changed.
export function MilestoneFormModal({ milestone, project, openTaskCount = 0, onClose, onSaved }) {
  const notify = useToast()
  const [title, setTitle] = useState(milestone.title ?? '')
  const [description, setDescription] = useState(milestone.description ?? '')
  const [dueDate, setDueDate] = useState(milestone.dueDate ?? '')
  const [status, setStatus] = useState(milestone.status ?? 'PENDING')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isDirty = useDirtyForm({ title, description, dueDate, status })
  const completingWithOpenTasks = status === 'COMPLETED' && milestone.status !== 'COMPLETED' && openTaskCount > 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !dueDate) return
    setSubmitting(true)
    setError('')
    try {
      await updateMilestone(milestone.id, {
        projectId: project.id,
        title: title.trim(),
        description: description.trim() || null,
        dueDate,
        status,
      })
      notify(`Milestone "${title.trim()}" updated`, { tone: 'success' })
      if (completingWithOpenTasks) {
        notify(
          `${openTaskCount} linked task${openTaskCount === 1 ? ' is' : 's are'} still open and ${openTaskCount === 1 ? 'was' : 'were'} not changed`,
          { tone: 'warning' }
        )
      }
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update the milestone')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Edit milestone" onClose={onClose} isDirty={isDirty}>
      {({ requestClose }) => (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="field"
              autoFocus
              required
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Description (optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-subtle border-border focus:border-focus rounded-md border px-3 py-2 text-[13px] outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <label className="flex flex-col gap-1.5">
              <span className="text-muted text-[12px] font-semibold">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={project.startDate}
                max={project.endDate}
                className="field"
                required
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-muted text-[12px] font-semibold">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Milestone status"
                className="field"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {humanizeEnum(s)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {completingWithOpenTasks && (
            <p data-testid="milestone-open-tasks-warning" className="text-warning-ink text-[12px] font-medium">
              {openTaskCount} linked task{openTaskCount === 1 ? ' is' : 's are'} still open. They are not changed when you
              complete the milestone.
            </p>
          )}

          {error && <p className="text-danger-ink text-[12px] font-semibold">{error}</p>}

          <div className="mt-1 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={requestClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !title.trim() || !dueDate}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
