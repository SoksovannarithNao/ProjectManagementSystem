import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
import { useToast } from './ui/Toast'
import { useDirtyForm } from './ui/useDirtyForm'
import { inviteMember, searchInvitableUsers } from '../api/projectMembers'

const SEARCH_DEBOUNCE_MS = 250

// Invites a user to one project from its detail page (same POST
// /api/project-members/invite the Team page uses — the invitee still has to
// accept, and joins as a MEMBER). Suggestions are searched server-side across
// every eligible ACTIVE user in the org (not just people the caller already
// shares a project with) — the backend already leaves out the caller,
// existing/pending members and INACTIVE/SUSPENDED accounts — and the full
// username can still be typed directly.
export function AddProjectMemberModal({ projectId, onClose, onInvited }) {
  const notify = useToast()
  const [username, setUsername] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isDirty = useDirtyForm({ username })

  // Debounced type-ahead. A stale response (the user typed again before it
  // came back) is dropped via the `cancelled` flag. All setState happens in
  // the promise callbacks, not synchronously in the effect.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      searchInvitableUsers(projectId, username.trim())
        .then((users) => {
          if (!cancelled) setSuggestions(users)
        })
        .catch(() => {
          // Suggestions are a convenience — a failed lookup just leaves the
          // list as it was; typing the username by hand still works.
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [projectId, username])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const target = username.trim()
    if (!target) return
    setSubmitting(true)
    setError('')
    try {
      await inviteMember({ projectId, username: target })
      onInvited?.()
      onClose()
      notify(`Invitation sent to ${target}`, { tone: 'success' })
    } catch (err) {
      setError(err.message || 'Failed to send invitation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Add Member" onClose={onClose} isDirty={isDirty}>
      {({ requestClose }) => (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              list="project-member-suggestions"
              placeholder="Search by name or username"
              className="field"
              autoComplete="off"
              autoFocus
              required
            />
            <datalist id="project-member-suggestions">
              {suggestions.map((u) => (
                <option key={u.id} value={u.username}>
                  {u.fullName}
                </option>
              ))}
            </datalist>
            <span className="text-faint text-[12px]">
              They&apos;ll get an invitation and join as a member once they accept.
            </span>
          </label>

          {error && <p className="text-danger-ink text-[12px] font-semibold">{error}</p>}

          <div className="mt-1 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={requestClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Inviting…' : 'Send Invitation'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
