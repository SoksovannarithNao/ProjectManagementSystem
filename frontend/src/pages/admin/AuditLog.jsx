import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollText } from 'lucide-react'
import { TopBar } from '../../layout/TopBar'
import { Badge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApi } from '../../api/useApi'
import { getAuditLogs } from '../../api/auditLog'
import { humanizeEnum } from '../../api/format'

// The administrator audit log (assignment-brief.md B10, D-11): who did what, to which
// account, role or project, when, and the value before and after. Read-only and append-only:
// there is nothing here to edit or delete. Only the Administrator role opens it.

const PAGE_SIZE = 25

const ACTIONS = {
  USER_ROLE_CHANGED: 'System role changed',
  PERMISSIONS_CHANGED: 'Permissions changed',
  PROJECT_ROLE_CHANGED: 'Project role changed',
  OWNERSHIP_TRANSFERRED: 'Ownership transferred',
  ACCOUNT_CREATED: 'Account created',
  ACCOUNT_STATUS_CHANGED: 'Account status changed',
  ACCOUNT_DELETED: 'Account deleted',
  PROJECT_DELETED: 'Project deleted',
  ROLE_CREATED: 'Role created',
  ROLE_UPDATED: 'Role updated',
  ROLE_DELETED: 'Role deleted',
}

const TARGETS = { USER: 'Account', ROLE: 'Role', PROJECT: 'Project' }

// These keep the stored words (USER, PROJECT_MANAGER, ACTIVE ...), shown the way the rest of the app does.
const ENUM_VALUES = new Set(['USER_ROLE_CHANGED', 'PROJECT_ROLE_CHANGED', 'ACCOUNT_STATUS_CHANGED'])

const dateTime = (value) =>
  new Date(value).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// "PROJECT:TASK:APPROVE" -> "Task: Approve (in a project)"
function grantLabel(token) {
  const [scope, resource, permission] = token.split(':')
  return `${humanizeEnum(resource)}: ${humanizeEnum(permission)} (${scope === 'SYSTEM' ? 'anywhere' : 'in a project'})`
}

const splitList = (value) => (value ? value.split(', ').filter(Boolean) : [])

function Change({ entry }) {
  if (entry.action === 'PERMISSIONS_CHANGED') {
    const before = splitList(entry.beforeValue)
    const after = splitList(entry.afterValue)
    const added = after.filter((g) => !before.includes(g))
    const removed = before.filter((g) => !after.includes(g))
    return (
      <div className="flex flex-col gap-1.5" data-testid="audit-permission-change">
        {added.length > 0 && (
          <p className="text-[12px]">
            <span className="text-success-ink font-semibold">Added </span>
            {added.map(grantLabel).join('; ')}
          </p>
        )}
        {removed.length > 0 && (
          <p className="text-[12px]">
            <span className="text-danger-ink font-semibold">Removed </span>
            {removed.map(grantLabel).join('; ')}
          </p>
        )}
      </div>
    )
  }
  const pretty = (v) => (v && ENUM_VALUES.has(entry.action) ? humanizeEnum(v) : v)
  const before = pretty(entry.beforeValue)
  const after = pretty(entry.afterValue)
  if (!before && !after) return <span className="text-faint">—</span>
  return (
    <p className="text-[12px]">
      {before && <span className="text-muted">{before}</span>}
      {before && after && <span className="text-faint"> → </span>}
      {after && <span className="text-ink font-medium">{after}</span>}
    </p>
  )
}

export function AuditLog() {
  const [search, setSearch] = useState('')
  const [text, setText] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)

  // Typing searches after a short pause, from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setText(search.trim())
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetcher = useCallback(
    () => getAuditLogs({ q: text, action, from, to, page, size: PAGE_SIZE }),
    [text, action, from, to, page]
  )
  const { data, loading, error } = useApi(fetcher)
  const items = useMemo(() => data?.items ?? [], [data])
  const total = data?.total ?? 0
  const filtered = Boolean(text || action || from || to)
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)

  const reset = () => {
    setSearch('')
    setText('')
    setAction('')
    setFrom('')
    setTo('')
    setPage(0)
  }

  return (
    <div>
      <TopBar
        title="Audit log"
        subtitle="Who did what, and when"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search the audit log"
      />

      <section className="card px-4 py-4 sm:px-5" aria-label="Audit log entries">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-muted text-[12px] font-semibold">Action</span>
            <select
              className="field field-sm w-[210px]"
              value={action}
              onChange={(e) => {
                setAction(e.target.value)
                setPage(0)
              }}
            >
              <option value="">All actions</option>
              {Object.entries(ACTIONS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted text-[12px] font-semibold">From</span>
            <input
              type="date"
              className="field field-sm"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value)
                setPage(0)
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted text-[12px] font-semibold">To</span>
            <input
              type="date"
              className="field field-sm"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value)
                setPage(0)
              }}
            />
          </label>
          {filtered && (
            <button type="button" className="btn btn-secondary" onClick={reset}>
              Clear filters
            </button>
          )}
        </div>

        {loading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="mb-2 h-10 w-full" />)}

        {error && !loading && <EmptyState icon={ScrollText} title="Could not load the audit log" subtitle={error.message} />}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            icon={ScrollText}
            title={filtered ? 'No entries match your filters' : 'Nothing has been recorded yet'}
            subtitle={filtered ? undefined : 'Changes to accounts, roles, permissions, project roles and ownership appear here.'}
          />
        )}

        {items.length > 0 && (
          <div className="scroll-x">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <caption className="sr-only">Audit log entries, newest first</caption>
              <thead>
                <tr className="border-divider border-b">
                  {['When', 'Who', 'What', 'On', 'Change'].map((h) => (
                    <th key={h} scope="col" className="text-muted px-3 py-2 text-left text-[12px] font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id} data-testid="audit-row" className="border-divider border-b align-top last:border-b-0">
                    <td className="text-muted px-3 py-2.5 whitespace-nowrap">{dateTime(e.createdAt)}</td>
                    <td className="text-ink px-3 py-2.5 font-semibold">{e.actorName}</td>
                    <td className="px-3 py-2.5">
                      <Badge>{ACTIONS[e.action] ?? humanizeEnum(e.action)}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-ink">{e.targetLabel ?? '—'}</p>
                      <p className="text-faint text-[12px]">{TARGETS[e.targetType] ?? humanizeEnum(e.targetType)}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Change entry={e} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px]">
            <span className="text-muted" data-testid="audit-range">
              {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}
            </span>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <button type="button" className="btn btn-secondary" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
