import { useMemo, useState } from 'react'
import { Users as UsersIcon } from 'lucide-react'
import { TopBar } from '../../layout/TopBar'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../auth/AuthContext'
import { useApi } from '../../api/useApi'
import { getUsers, assignUserRole } from '../../api/users'
import { getRoles } from '../../api/roles'
import { humanizeEnum, initialsFor, colorForId } from '../../api/format'

// User & Role Management (Role_Requirment.md): an Administrator gives each
// account its system role. The role decides what the account may do anywhere
// (create a project, generate reports, manage users) - what it may do inside a
// project also depends on the role it holds there (see Team and Project pages).
// Roles come from the server; project-only roles (Viewer) are not offered.
export function UsersAdmin() {
  const notify = useToast()
  const { canSys, profile, refreshProfile } = useAuth()
  const { data: users, loading, error, refetch } = useApi(getUsers)
  const { data: roles } = useApi(getRoles)
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState(null)

  const canAssign = canSys('USER', 'ASSIGN')
  const assignableRoles = useMemo(() => (roles ?? []).filter((r) => r.scope !== 'PROJECT'), [roles])
  const roleIdByName = useMemo(() => new Map(assignableRoles.map((r) => [r.name, r.id])), [assignableRoles])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = users ?? []
    if (!q) return list
    return list.filter((u) =>
      [u.fullName, u.username, u.email, u.role].some((v) => v?.toLowerCase().includes(q))
    )
  }, [users, search])

  const changeRole = async (user, roleName) => {
    const roleId = roleIdByName.get(roleName)
    if (!roleId || roleName === user.role) return
    setSavingId(user.id)
    try {
      await assignUserRole(user.id, roleId)
      notify(`${user.fullName} is now ${humanizeEnum(roleName)}`, { tone: 'success' })
      refetch()
      // Changing your own role changes what you may do right now.
      if (user.id === profile?.id) refreshProfile()
    } catch (err) {
      notify(err.message || 'Could not change the role', { tone: 'error' })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <TopBar
        title="Users"
        subtitle="Give each account a role"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search users"
      />

      <section className="card px-2 py-2 sm:px-4 sm:py-3" aria-label="Users and their roles">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}

        {error && !loading && (
          <EmptyState icon={UsersIcon} title="Could not load users" subtitle={error.message} />
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState icon={UsersIcon} title="No users match your search" />
        )}

        <ul className="flex flex-col">
          {filtered.map((u) => (
            <li
              key={u.id}
              className="border-divider flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-2 py-3 last:border-b-0 sm:px-3"
            >
              <div className="flex min-w-0 flex-1 basis-[220px] items-center gap-3">
                <Avatar
                  initials={initialsFor(u.fullName)}
                  color={colorForId(u.id)}
                  photoUrl={u.profilePhotoUrl}
                  size={36}
                />
                <div className="min-w-0">
                  <p className="text-ink truncate text-[13px] font-semibold">{u.fullName}</p>
                  <p className="text-muted truncate text-[12px]">
                    @{u.username} · {u.email}
                  </p>
                </div>
              </div>

              {u.accountStatus !== 'ACTIVE' && (
                <Badge tone={u.accountStatus === 'SUSPENDED' ? 'danger' : 'medium'}>
                  {humanizeEnum(u.accountStatus)}
                </Badge>
              )}

              {canAssign ? (
                <label className="flex items-center gap-2">
                  <span className="sr-only">Role for {u.fullName}</span>
                  <select
                    className="field field-sm w-[180px]"
                    value={u.role ?? ''}
                    disabled={savingId === u.id}
                    onChange={(e) => changeRole(u, e.target.value)}
                  >
                    {assignableRoles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {humanizeEnum(r.name)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <Badge>{humanizeEnum(u.role)}</Badge>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
