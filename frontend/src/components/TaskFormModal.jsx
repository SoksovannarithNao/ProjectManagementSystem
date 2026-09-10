import { useState } from 'react'
import { Modal } from './ui/Modal'
import { useToast } from './ui/Toast'
import { useApi } from '../api/useApi'
import { getProjects } from '../api/projects'
import { createTask, taskResponseToRequest, updateTask } from '../api/tasks'
import { humanizeEnum } from '../api/format'

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

// New tasks always start in TO_DO — per the board's workflow, they only ever
// reach Doing/Done by being moved forward from there, never created directly.
// Editing an existing task (`task` passed) keeps its current status untouched.
export function TaskFormModal({ task, defaultProjectId, defaultDueDate, onClose, onSaved }) {
  const isEdit = Boolean(task)
  const notify = useToast()
  const { data: projects } = useApi(getProjects)
  const [title, setTitle] = useState(task?.title ?? '')
  const [projectId, setProjectId] = useState(
    task?.project?.id ? String(task.project.id) : defaultProjectId ? String(defaultProjectId) : ''
  )
  const [description, setDescription] = useState(task?.description ?? '')
  const [priority, setPriority] = useState(task?.priority ?? 'MEDIUM')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaultDueDate ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const effectiveProjectId = projectId || (projects?.[0] ? String(projects[0].id) : '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !effectiveProjectId) return
    setSubmitting(true)
    setError('')
    try {
      const saved = isEdit
        ? await updateTask(
            task.id,
            taskResponseToRequest(task, {
              projectId: Number(effectiveProjectId),
              title: title.trim(),
              description: description.trim() || null,
              priority,
              dueDate: dueDate || null,
            })
          )
        : await createTask({
            projectId: Number(effectiveProjectId),
            title: title.trim(),
            description: description.trim() || null,
            priority,
            status: 'TO_DO',
            dueDate: dueDate || null,
            progress: 0,
          })
      onSaved?.(saved)
      onClose()
      notify(`Task "${saved.title}" ${isEdit ? 'updated' : 'created'}`, { tone: 'success' })
    } catch (err) {
      setError(err.message || `Failed to ${isEdit ? 'update' : 'create'} task`)
    } finally {
      setSubmitting(false)
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
            {!projects?.length && <option value="">Loading projects…</option>}
            {projects?.map((p) => (
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
