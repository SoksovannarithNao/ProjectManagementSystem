import { useState } from 'react'
import { Modal } from './ui/Modal'
import { useToast } from './ui/Toast'

// Shared "Add New Position" / "Add New Department" form — both are just a
// name + optional description against a small Team-Admin-managed lookup
// table (see backend PositionController/DepartmentController).
export function AddLookupModal({ title, nameLabel, onClose, onCreate, onCreated }) {
  const notify = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const created = await onCreate({ name: name.trim(), description: description.trim() || null })
      onCreated?.(created)
      onClose()
      notify(`"${created.name}" created`, { tone: 'success' })
    } catch (err) {
      setError(err.message || 'Failed to create')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[12.5px] font-semibold">{nameLabel}</span>
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
          <span className="text-muted text-[12.5px] font-semibold">Description (optional)</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
          />
        </label>

        {error && <p className="text-danger text-[12.5px] font-semibold">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
