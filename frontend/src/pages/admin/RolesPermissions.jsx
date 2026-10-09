import { useMemo, useState } from 'react'
import { Lock, ShieldCheck } from 'lucide-react'
import { TopBar } from '../../layout/TopBar'
import { Badge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../auth/AuthContext'
import { useApi } from '../../api/useApi'
import { getPermissionMatrix, updateRolePermissions } from '../../api/roles'
import { humanizeEnum } from '../../api/format'

// Role & Permission management (Role_Requirment.md). Shows each role, the 7
// permission types, and which role holds which permission on which resource.
// Someone with ROLE:EDIT can change the grants of any role except
// Administrator (which always holds everything). A change applies on the
// server immediately after Save - the backend reads this same table for
// every request.

const ACTION_LABELS = {
  VIEW: 'View',
  CREATE: 'Create',
  EDIT: 'Edit',
  DELETE: 'Delete',
  ASSIGN: 'Assign',
  APPROVE: 'Approve',
  GENERATE_REPORTS: 'Generate reports',
}

// Which of the 7 actions mean something for each resource: the others are
// not shown, so the grid is not a wall of cells that do nothing.
const APPLICABLE = {
  PROJECT: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ASSIGN'],
  MILESTONE: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  MEMBER: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  TASK: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ASSIGN', 'APPROVE'],
  TASK_STATUS: ['EDIT'],
  SUBTASK: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  COMMENT: ['VIEW', 'CREATE', 'DELETE'],
  WORK_LOG: ['VIEW', 'CREATE', 'DELETE'],
  ATTACHMENT: ['VIEW', 'CREATE', 'DELETE'],
  CHECKLIST_ITEM: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  REPORT: ['GENERATE_REPORTS'],
  USER: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ASSIGN'],
  ROLE: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  LOOKUP: ['CREATE'],
}

const SYSTEM_RESOURCES = ['PROJECT', 'REPORT', 'USER', 'ROLE', 'LOOKUP']
const PROJECT_RESOURCES = ['PROJECT', 'MILESTONE', 'MEMBER', 'TASK', 'TASK_STATUS', 'SUBTASK', 'COMMENT', 'WORK_LOG', 'ATTACHMENT', 'CHECKLIST_ITEM', 'REPORT']

// Two levels of role (ADR-0015). System roles say what a person may do anywhere;
// project roles say what they may do inside one project, and carry the business
// names used in the requirements.
const ROLE_LABELS = {
  ADMINISTRATOR: 'Administrator',
  PROJECT_MANAGER: 'Project Manager',
  USER: 'User',
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
}
const BUSINESS_NAMES = { OWNER: 'Project Manager of the project', ADMIN: 'Team Leader', MEMBER: 'Team Member' }
const roleLabel = (name) => ROLE_LABELS[name] ?? humanizeEnum(name)

const RESOURCE_HINTS = {
  PROJECT: { SYSTEM: 'Create applies to starting a new project. Other actions apply inside a project.', PROJECT: 'Assign = make someone a Project Manager of the project.' },
  TASK: { PROJECT: 'Edit = change any field. Assign = assignees and dependencies. Approve = mark a task Completed.' },
  TASK_STATUS: { PROJECT: 'Change status and progress of a task assigned to you.' },
  MEMBER: { PROJECT: 'Create = invite or add. Edit = change a member’s role. Delete = remove.' },
  COMMENT: { PROJECT: 'Everyone can edit their own comment; Delete also lets someone remove others’ comments.' },
  WORK_LOG: { PROJECT: 'Everyone can delete their own entry; Delete also lets someone remove others’ entries.' },
  ATTACHMENT: { PROJECT: 'Create = upload a file to a task or the project. Everyone can delete a file they uploaded; Delete also lets someone remove others’ files.' },
  CHECKLIST_ITEM: { PROJECT: 'Edit = tick or rename items (a Team Member only on tasks assigned to them). Everyone can delete an item they added; Delete also lets someone remove others’.' },
  REPORT: {
    SYSTEM: 'Reports across every project the person belongs to. Needed to open the Reports page.',
    PROJECT: 'Reports for this project. A Team Leader or Owner can open the Reports page through this.',
  },
}

const key = (scope, resource, permission) => `${scope}|${resource}|${permission}`

export function RolesPermissions() {
  const notify = useToast()
  const { canSys, refreshProfile } = useAuth()
  const { data: matrix, loading, error, refetch } = useApi(getPermissionMatrix)
  const [selectedId, setSelectedId] = useState(null)
  // Unsaved edits per role (role id -> Set of keys), so switching roles never loses work.
  const [drafts, setDrafts] = useState(() => new Map())
  const [saving, setSaving] = useState(false)

  const canEdit = canSys('ROLE', 'EDIT')
  const roles = useMemo(() => matrix?.roles ?? [], [matrix])
  const selected = roles.find((r) => r.role.id === (selectedId ?? roles[0]?.role.id))

  const savedKeys = useMemo(
    () => new Set((selected?.grants ?? []).map((g) => key(g.scope, g.resource, g.permission))),
    [selected]
  )
  const draft = selected ? (drafts.get(selected.role.id) ?? savedKeys) : savedKeys
  const dirty = (id) => {
    const d = drafts.get(id)
    if (!d) return false
    const r = roles.find((x) => x.role.id === id)
    const base = new Set((r?.grants ?? []).map((g) => key(g.scope, g.resource, g.permission)))
    return d.size !== base.size || [...d].some((k) => !base.has(k))
  }

  const toggle = (scope, resource, permission) => {
    if (!selected || !canEdit || selected.locked) return
    const next = new Set(draft)
    const k = key(scope, resource, permission)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setDrafts((prev) => new Map(prev).set(selected.role.id, next))
  }

  const discard = () => {
    setDrafts((prev) => {
      const next = new Map(prev)
      next.delete(selected.role.id)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const grants = [...draft].map((k) => {
        const [scope, resource, permission] = k.split('|')
        return { scope, resource, permission }
      })
      await updateRolePermissions(selected.role.id, grants)
      discard()
      await refetch()
      // The signed-in person's own rights may have just changed.
      await refreshProfile()
      notify(`Saved permissions for ${roleLabel(selected.role.name)}`, { tone: 'success' })
    } catch (err) {
      notify(err.message || 'Could not save the permissions', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <TopBar title="Roles & Permissions" subtitle="What each role may do" />

      {loading && <Skeleton className="h-64 w-full rounded-card" />}
      {error && !loading && (
        <EmptyState icon={ShieldCheck} title="Could not load roles" subtitle={error.message} />
      )}

      {selected && (
        <div className="grid grid-cols-[260px_1fr] items-start gap-5 max-[900px]:grid-cols-1">
          <nav className="card flex flex-col gap-1 p-2" aria-label="Roles">
            {roles.map((r) => {
              const active = r.role.id === selected.role.id
              return (
                <button
                  key={r.role.id}
                  type="button"
                  onClick={() => setSelectedId(r.role.id)}
                  aria-current={active ? 'true' : undefined}
                  className={`flex flex-col gap-0.5 rounded-md px-3 py-2.5 text-left transition-colors ${
                    active ? 'bg-charcoal text-on-charcoal' : 'hover:bg-subtle'
                  }`}
                >
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    {roleLabel(r.role.name)}
                    {r.locked && <Lock size={12} aria-label="locked" />}
                    {dirty(r.role.id) && (
                      <span className="bg-warning h-1.5 w-1.5 rounded-full" role="img" aria-label="unsaved changes" />
                    )}
                  </span>
                  <span className={`text-[12px] ${active ? 'opacity-80' : 'text-muted'}`}>
                    {r.role.scope === 'SYSTEM'
                      ? 'System role'
                      : r.role.scope === 'PROJECT'
                        ? 'Project role'
                        : 'System and project role'}
                  </span>
                </button>
              )
            })}
          </nav>

          <section className="flex min-w-0 flex-col gap-5" aria-label={`Permissions of ${roleLabel(selected.role.name)}`}>
            <div className="card px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="section-title">{roleLabel(selected.role.name)}</h2>
                  <p className="text-muted mt-1 text-[13px]">{selected.role.description}</p>
                  {BUSINESS_NAMES[selected.role.name] && (
                    <p className="text-faint mt-1 text-[12px]">
                      A role inside one project. In the requirements it is called{' '}
                      <strong>{BUSINESS_NAMES[selected.role.name]}</strong>.
                    </p>
                  )}
                </div>
                {selected.locked ? (
                  <Badge>Always has every permission</Badge>
                ) : !canEdit ? (
                  <Badge>View only</Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    {dirty(selected.role.id) && (
                      <button type="button" className="btn btn-secondary" onClick={discard} disabled={saving}>
                        Discard
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={save}
                      disabled={saving || !dirty(selected.role.id)}
                    >
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {(selected.role.scope === 'SYSTEM' || selected.role.scope === 'BOTH') && (
              <PermissionTable
                title="Anywhere in the system"
                description="Applies to the whole account, not to one project."
                scope="SYSTEM"
                resources={SYSTEM_RESOURCES}
                draft={draft}
                editable={canEdit && !selected.locked}
                locked={selected.locked}
                onToggle={toggle}
                roleName={roleLabel(selected.role.name)}
              />
            )}
            {(selected.role.scope === 'PROJECT' || selected.role.scope === 'BOTH') && (
              <PermissionTable
                title="Inside a project"
                description="Applies in projects where a member holds this role."
                scope="PROJECT"
                resources={PROJECT_RESOURCES}
                draft={draft}
                editable={canEdit && !selected.locked}
                locked={selected.locked}
                onToggle={toggle}
                roleName={roleLabel(selected.role.name)}
              />
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function PermissionTable({ title, description, scope, resources, draft, editable, locked, onToggle, roleName }) {
  const columns = Object.keys(ACTION_LABELS)
  const resourceLabel = (r) => humanizeEnum(r)
  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <h3 className="card-title">{title}</h3>
        <p className="text-muted text-[12px]">{description}</p>
      </div>
      <div className="scroll-x">
        <table className="w-full min-w-[600px] border-collapse text-[13px]">
          <caption className="sr-only">
            {roleName}: {title}
          </caption>
          <thead>
            <tr className="border-divider border-b">
              <th scope="col" className="bg-card text-muted sticky left-0 z-[1] px-3 py-2 text-left text-[12px] font-semibold sm:px-5">
                Resource
              </th>
              {columns.map((c) => (
                <th key={c} scope="col" className="text-muted px-2 py-2 text-center text-[12px] font-semibold">
                  {ACTION_LABELS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map((resource) => (
              <tr key={resource} className="border-divider border-b last:border-b-0">
                <th scope="row" className="bg-card sticky left-0 z-[1] px-3 py-2.5 text-left font-semibold sm:px-5">
                  <span className="block">{resourceLabel(resource)}</span>
                  {RESOURCE_HINTS[resource]?.[scope] && (
                    <span className="text-faint hidden text-[12px] font-normal sm:block">{RESOURCE_HINTS[resource][scope]}</span>
                  )}
                </th>
                {columns.map((action) => {
                  const applies = APPLICABLE[resource]?.includes(action)
                  const checked = locked || draft.has(key(scope, resource, action))
                  return (
                    <td key={action} className="px-2 py-2.5 text-center">
                      {!applies ? (
                        <span className="text-faint" aria-hidden="true">
                          ·
                        </span>
                      ) : editable ? (
                        <input
                          type="checkbox"
                          className="accent-charcoal h-4 w-4 cursor-pointer"
                          checked={checked}
                          onChange={() => onToggle(scope, resource, action)}
                          aria-label={`${roleName} may ${ACTION_LABELS[action].toLowerCase()} ${resourceLabel(resource).toLowerCase()}`}
                        />
                      ) : checked ? (
                        <span className="text-success-ink font-bold" role="img" aria-label="allowed">
                          ✓
                        </span>
                      ) : (
                        <span className="text-faint" role="img" aria-label="not allowed">
                          –
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
