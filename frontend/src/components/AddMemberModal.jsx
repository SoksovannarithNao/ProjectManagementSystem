import { useState } from 'react'
import { Modal } from './ui/Modal'
import { LookupSelect } from './ui/LookupSelect'
import { AddLookupModal } from './AddLookupModal'
import { useToast } from './ui/Toast'
import { useApi } from '../api/useApi'
import { getRoles } from '../api/roles'
import { humanizeEnum } from '../api/format'
import { createUser } from '../api/users'
import { getPositions, createPosition } from '../api/positions'
import { getDepartments, createDepartment } from '../api/departments'
import { describePasswordProblem, isPasswordComplex, passwordErrorMessage } from '../api/validation'
import { PasswordChecklist } from './ui/PasswordChecklist'

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
  // Empty = the server's default (User). Project roles (Owner, Team Leader,
  // Team Member, Viewer) are not offered: they only exist inside a project.
  const [roleId, setRoleId] = useState('')
  const assignableRoles = (roles ?? []).filter((r) => r.scope !== 'PROJECT')
  const [positionId, setPositionId] = useState(null)
  const [departmentId, setDepartmentId] = useState(null)
  const [addingPosition, setAddingPosition] = useState(false)
  const [addingDepartment, setAddingDepartment] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fullName.trim() || !username.trim() || !email.trim() || !password) return
    if (!isPasswordComplex(password)) {
      setError(describePasswordProblem(password))
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
        roleId: roleId ? Number(roleId) : null,
        positionId,
        departmentId,
        accountStatus: 'ACTIVE',
      })
      onCreated?.(created)
      onClose()
      notify(`${created.fullName} added — share their temporary password to sign in`, { tone: 'success' })
    } catch (err) {
      setError(passwordErrorMessage(err, 'Failed to add member'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Invite Member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[12px] font-semibold">Full name</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="field"
            autoFocus
            required
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="field"
              required
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[12px] font-semibold">Temporary password</span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="field"
            required
          />
          <PasswordChecklist password={password} />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">System role</span>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="field"
            >
              <option value="">User (default)</option>
              {assignableRoles
                .filter((r) => r.name !== 'USER')
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {humanizeEnum(r.name)}
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

        {error && <p className="text-danger-ink text-[12px] font-semibold">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
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
