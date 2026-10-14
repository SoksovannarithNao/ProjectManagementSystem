import { useState } from 'react'
import { SidePanel } from './ui/SidePanel'
import { useToast } from './ui/Toast'
import { useDirtyForm } from './ui/useDirtyForm'
import { createRole, updateRole } from '../api/roles'
import { humanizeEnum } from '../api/format'

// Creates or renames an extra system role (D-14), in the right-hand panel. A new role
// starts with no permissions: they are ticked on the Roles & Permissions grid afterwards.
export function RoleFormPanel({ role, onClose, onSaved }) {
  const notify = useToast()
  const [name, setName] = useState(role ? humanizeEnum(role.name) : '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isDirty = useDirtyForm({ name, description })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const body = { name: name.trim(), description: description.trim() }
      const saved = role ? await updateRole(role.id, body) : await createRole(body)
      notify(role ? 'Role updated' : 'Role created. Choose what it may do below.', { tone: 'success' })
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save the role')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SidePanel title={role ? 'Edit role' : 'New role'} onClose={onClose} isDirty={isDirty}>
      {({ requestClose }) => (
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-[22px] pt-5 pb-6">
            <p className="text-muted text-[13px] leading-relaxed">
              {role
                ? 'Rename the role or change what it is for. Its permissions are edited on the grid.'
                : 'An extra system role says what an account may do anywhere. It starts with no permissions: tick them on the grid once it is created.'}
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-muted text-[12px] font-semibold">Role name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                placeholder="For example, Quality Auditor"
                className="field"
                autoFocus
                required
              />
              <span className="text-faint text-[12px]">
                What a person may do inside one project still depends on the role they hold there.
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-muted text-[12px] font-semibold">Description (optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={255}
                rows={4}
                className="bg-subtle border-border focus:border-focus rounded-md border px-3 py-2 text-[13px] outline-none"
              />
            </label>

            {error && <p className="text-danger-ink text-[12px] font-semibold">{error}</p>}
          </div>

          <div className="border-divider flex justify-end gap-2 border-t px-[22px] py-4">
            <button type="button" className="btn btn-secondary" onClick={requestClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
              {submitting ? 'Saving…' : role ? 'Save' : 'Create role'}
            </button>
          </div>
        </form>
      )}
    </SidePanel>
  )
}
