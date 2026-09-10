import { useState } from 'react'
import { Modal } from './ui/Modal'
import { useToast } from './ui/Toast'
import { useMembers } from '../data/UsersContext'
import { createProject } from '../api/projects'
import { humanizeEnum } from '../api/format'

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export function NewProjectModal({ onClose, onCreated }) {
  const notify = useToast()
  const { members } = useMembers()
  const [name, setName] = useState('')
  const [projectCode, setProjectCode] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [managerId, setManagerId] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const effectiveManagerId = managerId || (members[0] ? String(members[0].id) : '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !projectCode.trim() || !startDate || !endDate || !effectiveManagerId) return
    setSubmitting(true)
    setError('')
    try {
      const created = await createProject({
        projectCode: projectCode.trim(),
        name: name.trim(),
        description: description.trim() || null,
        startDate,
        endDate,
        managerId: Number(effectiveManagerId),
        priority,
        status: 'PLANNING',
        progress: 0,
      })
      onCreated?.(created)
      onClose()
      notify(`Project "${created.name}" created`, { tone: 'success' })
    } catch (err) {
      setError(err.message || 'Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="New Project" onClose={onClose}>
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

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12.5px] font-semibold">Manager</span>
            <select
              value={effectiveManagerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="bg-subtle border-border h-10 rounded-md border px-3 text-[13.5px] outline-none"
              required
            >
              {!members.length && <option value="">Loading…</option>}
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
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
        </div>

        {error && <p className="text-danger text-[12.5px] font-semibold">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || !effectiveManagerId}>
            {submitting ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
