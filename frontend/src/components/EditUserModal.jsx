import { useState } from 'react'
import { Modal } from './ui/Modal'
import { LookupSelect } from './ui/LookupSelect'
import { PasswordChecklist } from './ui/PasswordChecklist'
import { useToast } from './ui/Toast'
import { useDirtyForm } from './ui/useDirtyForm'
import { useApi } from '../api/useApi'
import { updateUserAccount } from '../api/users'
import { getPositions } from '../api/positions'
import { getDepartments } from '../api/departments'
import { humanizeEnum } from '../api/format'
import { describePasswordProblem, isPasswordComplex, passwordErrorMessage } from '../api/validation'

const GENDER_OPTIONS = ['', 'Male', 'Female', 'Other']
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED']

// Administrator edit of one account (PUT /api/users/{id} replaces the whole
// profile, so every field is sent back). The system role stays on the row's own
// picker. The status is sent only when it was changed: an account still waiting
// for its e-mail code (PENDING_VERIFICATION) is not a status the server accepts back.
// A new password is optional; blank keeps the current one.
export function EditUserModal({ user, isSelf, onClose, onSaved }) {
  const notify = useToast()
  const { data: positions } = useApi(getPositions)
  const { data: departments } = useApi(getDepartments)
  const [fullName, setFullName] = useState(user.fullName ?? '')
  const [username, setUsername] = useState(user.username ?? '')
  const [email, setEmail] = useState(user.email ?? '')
  const [gender, setGender] = useState(user.gender ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth ?? '')
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber ?? '')
  const [positionId, setPositionId] = useState(user.positionId ?? null)
  const [departmentId, setDepartmentId] = useState(user.departmentId ?? null)
  const [accountStatus, setAccountStatus] = useState(user.accountStatus)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isDirty = useDirtyForm({
    fullName, username, email, gender, dateOfBirth, phoneNumber, positionId, departmentId, accountStatus, password,
  })
  const statusOptions = STATUS_OPTIONS.includes(user.accountStatus) ? STATUS_OPTIONS : [user.accountStatus, ...STATUS_OPTIONS]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fullName.trim() || !username.trim() || !email.trim()) return
    if (password && !isPasswordComplex(password)) {
      setError(describePasswordProblem(password))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await updateUserAccount(user.id, {
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        gender: gender || null,
        dateOfBirth: dateOfBirth || null,
        phoneNumber: phoneNumber.trim() || null,
        positionId,
        departmentId,
        ...(accountStatus !== user.accountStatus ? { accountStatus } : {}),
        ...(password ? { password } : {}),
      })
      notify(`${fullName.trim()} updated`, { tone: 'success' })
      onSaved?.()
      onClose()
    } catch (err) {
      setError(passwordErrorMessage(err, 'Failed to update the user'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Edit user" onClose={onClose} isDirty={isDirty}>
      {({ requestClose }) => (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Full name</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={150}
              className="field"
              autoFocus
              required
            />
          </label>

          <div className="flex gap-3 max-sm:flex-col">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-muted text-[12px] font-semibold">Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={50}
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
                maxLength={255}
                className="field"
                required
              />
            </label>
          </div>

          <div className="flex gap-3 max-sm:flex-col">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-muted text-[12px] font-semibold">Gender</span>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="field">
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g || 'Not set'}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-muted text-[12px] font-semibold">Date of birth</span>
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="field" />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-muted text-[12px] font-semibold">Phone number</span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                maxLength={30}
                className="field"
              />
            </label>
          </div>

          <div className="flex gap-3 max-sm:flex-col">
            <LookupSelect label="Position" items={positions} value={positionId} onChange={setPositionId} />
            <LookupSelect label="Department" items={departments} value={departmentId} onChange={setDepartmentId} />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Account status</span>
            <select
              value={accountStatus}
              onChange={(e) => setAccountStatus(e.target.value)}
              disabled={isSelf}
              className="field"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s} disabled={!STATUS_OPTIONS.includes(s)}>
                  {humanizeEnum(s)}
                </option>
              ))}
            </select>
            <span className="text-muted text-[11px]">
              {isSelf
                ? 'You cannot change the status of your own account.'
                : 'An inactive or suspended account cannot sign in.'}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">New password (optional)</span>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep the current password"
              autoComplete="off"
              className="field"
            />
            {password && <PasswordChecklist password={password} />}
          </label>

          {error && <p className="text-danger-ink text-[12px] font-semibold">{error}</p>}

          <div className="mt-1 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={requestClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !fullName.trim() || !username.trim() || !email.trim()}
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
