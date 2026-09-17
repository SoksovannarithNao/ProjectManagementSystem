import { useMemo, useState } from 'react'
import { UserPlus, Mail, FolderKanban, ListChecks, Search, UsersRound, X } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { Avatar } from '../components/ui/Avatar'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { LookupSelect } from '../components/ui/LookupSelect'
import { AddLookupModal } from '../components/AddLookupModal'
import { useToast } from '../components/ui/Toast'
import { AddMemberModal } from '../components/AddMemberModal'
import { useMembers } from '../data/UsersContext'
import { useAuth } from '../auth/AuthContext'
import { canManageUsers } from '../api/permissions'
import { useApi } from '../api/useApi'
import { getProjects } from '../api/projects'
import { getProjectMembers, inviteMember, deleteProjectMember } from '../api/projectMembers'
import { getTaskAssignees } from '../api/taskAssignees'
import { getPositions, createPosition } from '../api/positions'
import { getDepartments, createDepartment } from '../api/departments'
import { updateMemberPositionDepartment } from '../api/users'
import { buildProjectMemberMap, buildTaskAssigneeMap, countByValue } from '../api/relations'

export function Team() {
  const { profile, role } = useAuth()
  const notify = useToast()
  const { members, loading: membersLoading, refetch: refetchMembers } = useMembers()
  const { data: projects } = useApi(getProjects)
  const { data: projectMembers, refetch: refetchProjectMembers } = useApi(getProjectMembers)
  const { data: taskAssignees } = useApi(getTaskAssignees)
  const { data: positions, refetch: refetchPositions } = useApi(getPositions)
  const { data: departments, refetch: refetchDepartments } = useApi(getDepartments)

  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [addProjectId, setAddProjectId] = useState('')
  const [addingProject, setAddingProject] = useState(false)
  const [savingAttributes, setSavingAttributes] = useState(false)
  const [addingPosition, setAddingPosition] = useState(false)
  const [addingDepartment, setAddingDepartment] = useState(false)
  const canInvite = canManageUsers(role)
  const isAdmin = role === 'ADMINISTRATOR'

  const projectMemberMap = useMemo(() => buildProjectMemberMap(projectMembers), [projectMembers])
  const taskAssigneeMap = useMemo(() => buildTaskAssigneeMap(taskAssignees), [taskAssignees])
  const projectCountByUser = useMemo(() => countByValue(projectMemberMap.values()), [projectMemberMap])
  const taskCountByUser = useMemo(() => countByValue(taskAssigneeMap.values()), [taskAssigneeMap])

  const activeId = selectedId ?? members[0]?.id
  const selected = members.find((m) => m.id === activeId)
  const isSelf = selected?.id === profile?.id

  // Projects the current user actually administers (an active OWNER/ADMIN
  // membership, or a system ADMINISTRATOR) — mirrors
  // ProjectAccessGuard.canManage on the backend, so "Invite"/"Remove" only
  // offer teams the caller can really act on. null means "every project"
  // (system ADMINISTRATOR).
  const administeredProjectIds = useMemo(() => {
    if (isAdmin || profile == null) return null
    const ids = new Set()
    for (const pm of projectMembers ?? []) {
      if (
        pm.user?.id === profile.id &&
        pm.status === 'ACTIVE' &&
        (pm.projectRole === 'OWNER' || pm.projectRole === 'ADMIN')
      ) {
        ids.add(pm.project?.id)
      }
    }
    return ids
  }, [isAdmin, profile, projectMembers])

  const memberProjects = useMemo(() => {
    if (activeId == null) return []
    const ids = []
    for (const [projectId, userIds] of projectMemberMap.entries()) {
      if (userIds.includes(activeId)) ids.push(projectId)
    }
    return (projects ?? []).filter((p) => ids.includes(p.id))
  }, [projectMemberMap, projects, activeId])

  const availableProjects = useMemo(() => {
    if (activeId == null) return []
    const memberIds = new Set(memberProjects.map((p) => p.id))
    return (projects ?? []).filter(
      (p) => !memberIds.has(p.id) && (administeredProjectIds == null || administeredProjectIds.has(p.id))
    )
  }, [projects, memberProjects, activeId, administeredProjectIds])

  // Whether the caller administers (OWNER/ADMIN of, or system ADMINISTRATOR)
  // at least one project the selected member is also in — gates
  // position/department editing and per-project removal, matching
  // UserService.updateMemberPositionDepartment's "Team Admin for THIS
  // member" check on the backend (not a flat global permission).
  const canManageSelectedMember =
    isAdmin || memberProjects.some((p) => administeredProjectIds?.has(p.id))

  const isAddProjectIdValid = availableProjects.some((p) => String(p.id) === addProjectId)
  const effectiveAddProjectId = isAddProjectIdValid
    ? addProjectId
    : availableProjects[0]
      ? String(availableProjects[0].id)
      : ''

  const handleInviteToProject = async () => {
    if (!effectiveAddProjectId || !selected) return
    setAddingProject(true)
    try {
      await inviteMember({
        projectId: Number(effectiveAddProjectId),
        username: selected.username,
      })
      setAddProjectId('')
      notify(`Invitation sent to ${selected.name}`, { tone: 'success' })
    } catch (err) {
      notify(err.message || 'Failed to send invitation', { tone: 'error' })
    } finally {
      setAddingProject(false)
    }
  }

  const handleRemoveFromProject = async (projectId) => {
    const row = (projectMembers ?? []).find(
      (pm) => pm.project?.id === projectId && pm.user?.id === activeId
    )
    if (!row) return
    try {
      await deleteProjectMember(row.id)
      refetchProjectMembers()
      notify('Removed from project', { tone: 'success' })
    } catch (err) {
      notify(err.message || 'Failed to remove member from project', { tone: 'error' })
    }
  }

  const handleSaveAttributes = async ({ positionId, departmentId }) => {
    if (!selected) return
    setSavingAttributes(true)
    try {
      await updateMemberPositionDepartment(selected.id, {
        positionId: positionId ?? selected.positionId ?? null,
        departmentId: departmentId ?? selected.departmentId ?? null,
      })
      refetchMembers()
      notify('Team member updated', { tone: 'success' })
    } catch (err) {
      notify(err.message || 'Failed to update team member', { tone: 'error' })
    } finally {
      setSavingAttributes(false)
    }
  }

  const filtered = members.filter(
    (m) =>
      m.name?.toLowerCase().includes(query.toLowerCase()) ||
      m.username?.toLowerCase().includes(query.toLowerCase()) ||
      m.role?.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div>
      <TopBar
        title="Team"
        subtitle={`${members.length} members collaborating across projects`}
        actions={
          canInvite && (
            <button className="btn btn-primary" onClick={() => setShowInvite(true)}>
              <UserPlus size={16} /> Invite Member
            </button>
          )
        }
      />

      <div className="grid grid-cols-[320px_1fr] items-start gap-5 max-[900px]:grid-cols-1">
        <section className="card flex flex-col gap-3 p-4">
          <div className="bg-subtle border-border text-faint flex h-10 items-center gap-2 rounded-md border px-3">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by name or @username"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="text-ink w-full border-none bg-transparent text-[13px] outline-none"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            {membersLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5">
                  <Skeleton className="h-[38px] w-[38px] shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
              ))}
            {!membersLoading &&
              filtered.map((m) => (
                <button
                  key={m.id}
                  className={`hover:bg-subtle duration-[var(--duration-fast)] ease-[var(--ease-standard)] flex items-center gap-3 rounded-md border-none bg-none p-2.5 text-left transition-colors ${
                    m.id === activeId ? 'bg-subtle shadow-[inset_0_0_0_1px_var(--color-border)]' : ''
                  }`}
                  onClick={() => setSelectedId(m.id)}
                >
                  <Avatar initials={m.initials} color={m.color} photoUrl={m.photoUrl} size={38} />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-ink truncate text-[13.5px] font-[650]">{m.name}</span>
                    <span className="text-faint truncate text-[11.5px]">@{m.username}</span>
                  </span>
                </button>
              ))}
            {!membersLoading && filtered.length === 0 && (
              <EmptyState icon={UsersRound} title="No members found" subtitle="Try a different search." />
            )}
          </div>
        </section>

        {selected && (
          <section className="card px-[26px] py-6">
            <div className="border-divider mb-5 flex items-center gap-4 border-b pb-5">
              <Avatar initials={selected.initials} color={selected.color} photoUrl={selected.photoUrl} size={64} />
              <div>
                <h2 className="text-[19px] font-bold tracking-[-0.01em]">{selected.name}</h2>
                <p className="text-muted my-1 text-[13px]">@{selected.username}</p>
                <span className="text-faint inline-flex items-center gap-1.5 text-[12.5px]">
                  <Mail size={13} /> {selected.email}
                </span>
              </div>
            </div>

            <div className="mb-6 flex gap-3.5">
              <div className="bg-subtle border-border text-muted flex flex-1 items-center gap-3 rounded-md border px-4 py-3.5">
                <ListChecks size={16} />
                <div>
                  <span className="text-ink block text-lg font-bold">{taskCountByUser.get(selected.id) ?? 0}</span>
                  <span className="text-faint mt-0.5 block text-[11.5px]">Assigned Tasks</span>
                </div>
              </div>
              <div className="bg-subtle border-border text-muted flex flex-1 items-center gap-3 rounded-md border px-4 py-3.5">
                <FolderKanban size={16} />
                <div>
                  <span className="text-ink block text-lg font-bold">{projectCountByUser.get(selected.id) ?? 0}</span>
                  <span className="text-faint mt-0.5 block text-[11.5px]">Projects</span>
                </div>
              </div>
            </div>

            <div className="mb-[22px]">
              <h4 className="mb-3 text-[13px] font-[650]">Team Information</h4>
              {canManageSelectedMember && !isSelf ? (
                <div className="flex gap-3">
                  <LookupSelect
                    label="Position"
                    items={positions}
                    value={selected.positionId ?? null}
                    disabled={savingAttributes}
                    onChange={(positionId) => handleSaveAttributes({ positionId })}
                    onAddNew={() => setAddingPosition(true)}
                  />
                  <LookupSelect
                    label="Department"
                    items={departments}
                    value={selected.departmentId ?? null}
                    disabled={savingAttributes}
                    onChange={(departmentId) => handleSaveAttributes({ departmentId })}
                    onAddNew={() => setAddingDepartment(true)}
                  />
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="bg-subtle border-border flex-1 rounded-md border px-4 py-3">
                    <span className="text-faint block text-[11.5px] font-semibold">Position</span>
                    <span className="text-ink text-[13.5px] font-semibold">
                      {selected.positionName || 'Not set'}
                    </span>
                  </div>
                  <div className="bg-subtle border-border flex-1 rounded-md border px-4 py-3">
                    <span className="text-faint block text-[11.5px] font-semibold">Department</span>
                    <span className="text-ink text-[13.5px] font-semibold">
                      {selected.departmentName || 'Not set'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-[22px]">
              <h4 className="mb-3 text-[13px] font-[650]">Projects</h4>
              {memberProjects.length === 0 && (
                <p className="text-faint text-[12.5px]">No active projects.</p>
              )}
              <div className="flex flex-col gap-0.5">
                {memberProjects.map((p) => (
                  <div
                    key={p.id}
                    className="border-divider flex items-center justify-between border-b py-2.5 text-[13px] font-semibold last:border-b-0"
                  >
                    <span>{p.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted font-[650]">{Math.round(Number(p.progress ?? 0))}%</span>
                      {(isAdmin || administeredProjectIds?.has(p.id)) && (
                        <button
                          type="button"
                          className="icon-btn h-7 w-7 hover:text-danger"
                          aria-label={`Remove from ${p.name}`}
                          onClick={() => handleRemoveFromProject(p.id)}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {!isSelf && availableProjects.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <select
                    value={effectiveAddProjectId}
                    onChange={(e) => setAddProjectId(e.target.value)}
                    className="bg-subtle border-border h-9 flex-1 rounded-md border px-2.5 text-[12.5px] outline-none"
                  >
                    {availableProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary px-3 py-2 text-[12px]"
                    disabled={addingProject}
                    onClick={handleInviteToProject}
                  >
                    {addingProject ? 'Inviting…' : 'Invite to team'}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {showInvite && (
        <AddMemberModal onClose={() => setShowInvite(false)} onCreated={refetchMembers} />
      )}

      {addingPosition && (
        <AddLookupModal
          title="Add New Position"
          nameLabel="Position Name"
          onClose={() => setAddingPosition(false)}
          onCreate={createPosition}
          onCreated={(created) => {
            refetchPositions()
            handleSaveAttributes({ positionId: created.id })
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
            handleSaveAttributes({ departmentId: created.id })
          }}
        />
      )}
    </div>
  )
}
