import { useEffect, useMemo, useState } from 'react'
import { SidePanel } from './ui/SidePanel'
import { Combobox } from './ui/Combobox'
import { Avatar } from './ui/Avatar'
import { useToast } from './ui/Toast'
import { useDirtyForm } from './ui/useDirtyForm'
import { inviteMember, searchInvitableUsers } from '../api/projectMembers'
import { initialsFor, colorForId, projectRoleLabel } from '../api/format'

const SEARCH_DEBOUNCE_MS = 250

// The roles an invitation can carry (the same three the Team page offers). Owner is not one of
// them: ownership is transferred, never invited (the project has exactly one Owner).
const INVITE_ROLES = [
  { value: 'MEMBER', label: projectRoleLabel('MEMBER') },
  { value: 'ADMIN', label: projectRoleLabel('ADMIN') },
  { value: 'VIEWER', label: projectRoleLabel('VIEWER') },
]

// Adds an EXISTING user to a project (it is not for creating accounts: that is "Add User" on the Team page).
// Both the project and the person are picked from a combo box, so nothing has to be typed out in full:
//   - the project page passes `projectId` (the project is known, only the person is chosen);
//   - the Team page passes `projects` (the ones the caller manages) and the project is chosen first.
// It sends the same POST /api/project-members/invite as before: the person gets an invitation and joins,
// with the role chosen here, once they accept. Suggestions are searched server-side across every eligible
// ACTIVE user in the organisation - the backend already leaves out the caller, existing and pending members
// and INACTIVE / SUSPENDED accounts - so only someone who can really be added is ever listed.
export function AddProjectMemberModal({ projectId, projects, onClose, onInvited }) {
  const notify = useToast()
  const [project, setProject] = useState(null)
  const [user, setUser] = useState(null)
  const [projectRole, setProjectRole] = useState('MEMBER')
  const [searchText, setSearchText] = useState('')
  const [users, setUsers] = useState([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const effectiveProjectId = projectId ?? (project ? Number(project.value) : null)
  const isDirty = useDirtyForm({ project: project?.value ?? null, user: user?.value ?? null, projectRole })

  const projectOptions = useMemo(
    () => (projects ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.projectCode })),
    [projects]
  )

  // Debounced type-ahead. A stale response (the text changed again before it came back) is dropped via the
  // `cancelled` flag. All setState happens in the timer and promise callbacks, not synchronously in the effect.
  useEffect(() => {
    if (effectiveProjectId == null) return undefined
    let cancelled = false
    const timer = setTimeout(() => {
      setSearching(true)
      searchInvitableUsers(effectiveProjectId, searchText.trim())
        .then((found) => {
          if (cancelled) return
          setUsers(
            found.map((u) => ({
              value: u.id,
              label: u.fullName,
              hint: [u.username, u.positionName].filter(Boolean).join(' · '),
              username: u.username,
              leading: (
                <Avatar
                  initials={initialsFor(u.fullName)}
                  color={colorForId(u.id)}
                  photoUrl={u.profilePhotoUrl}
                  size={26}
                />
              ),
            }))
          )
        })
        .catch(() => {
          // Suggestions are a convenience: a failed lookup just leaves the list as it was.
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [effectiveProjectId, searchText])

  const chooseProject = (option) => {
    setProject(option)
    // the people offered depend on the project: start again
    setUser(null)
    setUsers([])
    setSearchText('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user || effectiveProjectId == null) return
    setSubmitting(true)
    setError('')
    try {
      await inviteMember({ projectId: effectiveProjectId, username: user.username, projectRole })
      onInvited?.()
      onClose()
      notify(`Invitation sent to ${user.label}`, { tone: 'success' })
    } catch (err) {
      setError(err.message || 'Failed to send invitation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SidePanel title="Add Member" onClose={onClose} isDirty={isDirty}>
      {({ requestClose }) => (
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-[22px] pt-5 pb-6">
            <p className="text-muted text-[13px] leading-relaxed">
              Add someone who already has an account to {projectId != null ? 'this project' : 'a project'}. To create a
              new account, use Add User on the Team page.
            </p>

            {projects && (
              <Combobox
                label="Project"
                options={projectOptions}
                value={project}
                onChange={chooseProject}
                placeholder="Choose a project"
                emptyMessage="You do not manage any project"
                autoFocus
              />
            )}

            <Combobox
              label="Person"
              options={users}
              value={user}
              onChange={setUser}
              onInputChange={setSearchText}
              placeholder="Search by name or username"
              emptyMessage="No one left to add: they may already be a member or have a pending invitation"
              loading={searching}
              disabled={effectiveProjectId == null}
              autoFocus={!projects}
              hint={effectiveProjectId == null ? 'Choose a project first.' : undefined}
            />

            <label className="flex flex-col gap-1.5">
              <span className="text-muted text-[12px] font-semibold">Role in this project</span>
              <select value={projectRole} onChange={(e) => setProjectRole(e.target.value)} className="field">
                {INVITE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <span className="text-faint text-[12px]">
                They&apos;ll get an invitation and join as {INVITE_ROLES.find((r) => r.value === projectRole).label}{' '}
                once they accept.
              </span>
            </label>

            {error && <p className="text-danger-ink text-[12px] font-semibold">{error}</p>}
          </div>

          <div className="border-divider flex justify-end gap-2 border-t px-[22px] py-4">
            <button type="button" className="btn btn-secondary" onClick={requestClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !user || effectiveProjectId == null}>
              {submitting ? 'Inviting…' : 'Send Invitation'}
            </button>
          </div>
        </form>
      )}
    </SidePanel>
  )
}
