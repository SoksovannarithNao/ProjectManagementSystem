import { useState } from 'react'
import { Modal } from './ui/Modal'
import { useToast } from './ui/Toast'
import { useApi } from '../api/useApi'
import { getRoles } from '../api/roles'
import { createUser } from '../api/users'

// There's no email-invite flow on the backend — this creates the account
// directly (POST /api/users, Administrator-only) with a temporary password
// the admin shares with the new member themselves.
export function AddMemberModal({ onClose, onCreated }) {
  const notify = useToast()
  const { data: roles } = useApi(getRoles)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('')
  const [department, setDepartment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const effectiveRoleId = roleId || (roles?.[0] ? String(roles[0].id) : '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fullName.trim() || !username.trim() || !email.trim() || !password || !effectiveRoleId) return
    setSubmitting(true)
    setError('')
    try {
      const created = await createUser({
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        roleId: Number(effectiveRoleId),
        department: department.trim() || null,
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
            minLength={8}
            placeholder="At least 8 characters"
            className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
            required
          />
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
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12.5px] font-semibold">Department</span>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
            />
          </label>
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
    </Modal>
  )
}
