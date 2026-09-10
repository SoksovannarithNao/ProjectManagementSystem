import { useMemo, useState } from 'react'
import { UserPlus, Mail, FolderKanban, ListChecks, Search, UsersRound } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { Avatar } from '../components/ui/Avatar'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { AddMemberModal } from '../components/AddMemberModal'
import { useMembers } from '../data/UsersContext'
import { useAuth } from '../auth/AuthContext'
import { canManageUsers } from '../api/permissions'
import { useApi } from '../api/useApi'
import { getProjects } from '../api/projects'
import { getProjectMembers } from '../api/projectMembers'
import { getTaskAssignees } from '../api/taskAssignees'
import { buildProjectMemberMap, buildTaskAssigneeMap, countByValue } from '../api/relations'

export function Team() {
  const { role } = useAuth()
  const { members, loading: membersLoading, refetch: refetchMembers } = useMembers()
  const { data: projects } = useApi(getProjects)
  const { data: projectMembers } = useApi(getProjectMembers)
  const { data: taskAssignees } = useApi(getTaskAssignees)

  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const canInvite = canManageUsers(role)

  const projectMemberMap = useMemo(() => buildProjectMemberMap(projectMembers), [projectMembers])
  const taskAssigneeMap = useMemo(() => buildTaskAssigneeMap(taskAssignees), [taskAssignees])
  const projectCountByUser = useMemo(() => countByValue(projectMemberMap.values()), [projectMemberMap])
  const taskCountByUser = useMemo(() => countByValue(taskAssigneeMap.values()), [taskAssigneeMap])

  const activeId = selectedId ?? members[0]?.id
  const selected = members.find((m) => m.id === activeId)

  const memberProjects = useMemo(() => {
    if (activeId == null) return []
    const ids = []
    for (const [projectId, userIds] of projectMemberMap.entries()) {
      if (userIds.includes(activeId)) ids.push(projectId)
    }
    return (projects ?? []).filter((p) => ids.includes(p.id))
  }, [projectMemberMap, projects, activeId])

  const filtered = members.filter(
    (m) =>
      m.name?.toLowerCase().includes(query.toLowerCase()) ||
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
              placeholder="Search members"
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
                  <Avatar initials={m.initials} color={m.color} size={38} />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-ink truncate text-[13.5px] font-[650]">{m.name}</span>
                    <span className="text-faint text-[11.5px]">{m.role}</span>
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
              <Avatar initials={selected.initials} color={selected.color} size={64} />
              <div>
                <h2 className="text-[19px] font-bold tracking-[-0.01em]">{selected.name}</h2>
                <p className="text-muted my-1 text-[13px]">{selected.role}</p>
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
                    <span className="text-muted font-[650]">{Math.round(Number(p.progress ?? 0))}%</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {showInvite && (
        <AddMemberModal onClose={() => setShowInvite(false)} onCreated={refetchMembers} />
      )}
    </div>
  )
}
