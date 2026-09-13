import { useState } from 'react'
import { Modal } from './ui/Modal'
import { LookupSelect } from './ui/LookupSelect'
import { AddLookupModal } from './AddLookupModal'
import { useToast } from './ui/Toast'
import { useApi } from '../api/useApi'
import { getRoles } from '../api/roles'
import { createUser } from '../api/users'
import { getPositions, createPosition } from '../api/positions'
import { getDepartments, createDepartment } from '../api/departments'
import { PASSWORD_REQUIREMENTS_MESSAGE, isPasswordComplex } from '../api/validation'

// There's no email-invite flow for brand-new accounts on the backend — this
// creates the account directly (POST /api/users, Administrator-only) with a
// temporary password the admin shares with the new member themselves.
// (Inviting an *existing* user to a specific project/team goes through
// ProjectMemberService.inviteMember instead — see Team.jsx.)
export function AddMemberModal({ onClose, onCreated }) {
  const notify = useToast()
  const { data: roles } = useApi(getRoles)
  const { data: positions, refetch: refetchPositions } = useApi(getPositions)
  const { data: departments, refetch: refetchDepartments } = useApi(getDepartments)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('')
  const [positionId, setPositionId] = useState(null)
  const [departmentId, setDepartmentId] = useState(null)
  const [addingPosition, setAddingPosition] = useState(false)
  const [addingDepartment, setAddingDepartment] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const effectiveRoleId = roleId || (roles?.[0] ? String(roles[0].id) : '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fullName.trim() || !username.trim() || !email.trim() || !password || !effectiveRoleId) return
    if (!isPasswordComplex(password)) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const created = await createUser({
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        roleId: Number(effectiveRoleId),
        positionId,
        departmentId,
        accountStatus: 'ACTIVE',
      })
      onCreated?.(created)
      onClose()
      notify(`${created.fullName} added — share their temporary password to sign in`, { tone: 'success' })
    } catch (err) {
      setError(err.message || 'Failed to add member')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Invite Member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[12.5px] font-semibold">Full name</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
            autoFocus
            required
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12.5px] font-semibold">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
              required
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12.5px] font-semibold">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[12.5px] font-semibold">Temporary password</span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
            required
          />
          <span className="text-faint text-[11.5px]">{PASSWORD_REQUIREMENTS_MESSAGE}</span>
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12.5px] font-semibold">Role</span>
            <select
              value={effectiveRoleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="bg-subtle border-border h-10 rounded-md border px-3 text-[13.5px] outline-none"
              required
            >
              {!roles?.length && <option value="">Loading…</option>}
              {roles?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-3">
          <LookupSelect
            label="Position"
            items={positions}
            value={positionId}
            onChange={setPositionId}
            onAddNew={() => setAddingPosition(true)}
          />
          <LookupSelect
            label="Department"
            items={departments}
            value={departmentId}
            onChange={setDepartmentId}
            onAddNew={() => setAddingDepartment(true)}
          />
        </div>

        {error && <p className="text-danger text-[12.5px] font-semibold">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || !effectiveRoleId}>
            {submitting ? 'Adding…' : 'Add Member'}
          </button>
        </div>
      </form>

      {addingPosition && (
        <AddLookupModal
          title="Add New Position"
          nameLabel="Position Name"
          onClose={() => setAddingPosition(false)}
          onCreate={createPosition}
          onCreated={(created) => {
            refetchPositions()
            setPositionId(created.id)
          }}
        />
      )}

      {addingDepartment && (
        <AddLookupModal
          title="Add New Department"
          nameLabel="Department Name"
          onClose={() => setAddingDepartment(false)}
          onCreate={createDepartment}
          onCreated={(created) => {
            refetchDepartments()
            setDepartmentId(created.id)
          }}
        />
      )}
    </Modal>
  )
}
