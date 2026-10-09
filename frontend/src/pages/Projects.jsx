import { useMemo, useState } from 'react'
import { Plus, FolderKanban, SlidersHorizontal, ArrowUpDown, Check } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { Dropdown } from '../components/ui/Dropdown'
import { ProjectCard } from '../components/ProjectCard'
import { NewProjectModal } from '../components/NewProjectModal'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { useAuth } from '../auth/AuthContext'
import { useApi } from '../api/useApi'
import { getProjects } from '../api/projects'
import { getProjectMembers } from '../api/projectMembers'
import { getTasks } from '../api/tasks'
import { buildProjectMemberMap, buildProjectTaskStats, toProjectCard } from '../api/relations'
import { humanizeEnum } from '../api/format'

// "Active" is the specification's word for a project that is under way
// (stored as IN_PROGRESS).
const STATUS_FILTERS = [
  { value: 'PLANNING', label: 'Planning' },
  { value: 'IN_PROGRESS', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  // Not a stored status: the server calculates it (end date passed, not Completed / Cancelled).
  { value: 'DELAYED', label: 'Delayed' },
]
const PRIORITY_FILTERS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const PRIORITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const FAR_FUTURE = '9999-12-31'

const SORT_OPTIONS = [
  { id: 'default', label: 'Default' },
  { id: 'name', label: 'Name (A–Z)' },
  { id: 'startDate', label: 'Start date' },
  { id: 'endDate', label: 'End date' },
  { id: 'priority', label: 'Priority' },
  { id: 'progress', label: 'Progress (highest first)' },
]
const SORTERS = {
  name: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
  startDate: (a, b) => new Date(a.startDate ?? FAR_FUTURE) - new Date(b.startDate ?? FAR_FUTURE),
  endDate: (a, b) => new Date(a.endDate ?? FAR_FUTURE) - new Date(b.endDate ?? FAR_FUTURE),
  priority: (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
  progress: (a, b) => b.progress - a.progress,
}

const toggleInSet = (setter) => (value) =>
  setter((prev) => {
    const next = new Set(prev)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  })

export function Projects() {
  const { canSys } = useAuth()
  const { data: projects, loading, refetch } = useApi(getProjects)
  const { data: projectMembers } = useApi(getProjectMembers)
  const { data: tasks } = useApi(getTasks)
  const [showNewProject, setShowNewProject] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(() => new Set())
  const [priorityFilter, setPriorityFilter] = useState(() => new Set())
  const [managerFilter, setManagerFilter] = useState('')
  const [sortBy, setSortBy] = useState('default')
  const toggleStatus = toggleInSet(setStatusFilter)
  const togglePriority = toggleInSet(setPriorityFilter)
  const memberMap = useMemo(() => buildProjectMemberMap(projectMembers), [projectMembers])
  const taskStats = useMemo(() => buildProjectTaskStats(tasks), [tasks])

  const items = useMemo(
    () =>
      (projects ?? [])
        .map((p) => toProjectCard(p, memberMap.get(p.id) ?? []))
        // Fully-done projects sink to the bottom so the grid stays focused
        // on what still needs tracking — a stable sort (only the two
        // completion buckets are reordered) keeps everything else in its
        // existing order rather than introducing an unrelated re-sort.
        .sort((a, b) => (a.progress >= 100 ? 1 : 0) - (b.progress >= 100 ? 1 : 0)),
    [projects, memberMap]
  )

  // Everything below only narrows or reorders the projects the server already
  // returned for this user, so a filter can never reveal a project the caller
  // cannot open.
  const managers = useMemo(() => {
    const byId = new Map()
    for (const p of items) {
      if (p.manager?.id != null) byId.set(p.manager.id, p.manager.fullName || p.manager.username)
    }
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [items])

  const activeFilterCount = statusFilter.size + priorityFilter.size + (managerFilter ? 1 : 0)

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matched = items.filter((p) => {
      if (q) {
        const haystack = [
          p.name,
          p.description,
          p.projectCode,
          p.manager?.fullName,
          humanizeEnum(p.status),
          p.delayed ? 'delayed' : '',
          STATUS_FILTERS.find((s) => s.value === p.status)?.label,
          p.startDate,
          p.endDate,
          p.due,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (statusFilter.size > 0 && !statusFilter.has(p.status) && !(statusFilter.has('DELAYED') && p.delayed)) return false
      if (priorityFilter.size > 0 && !priorityFilter.has(p.priority)) return false
      if (managerFilter && String(p.manager?.id) !== managerFilter) return false
      return true
    })
    // "Default" keeps the original order (finished projects last); any other
    // choice is a plain sort by that field.
    return sortBy === 'default' ? matched : [...matched].sort(SORTERS[sortBy])
  }, [items, search, statusFilter, priorityFilter, managerFilter, sortBy])

  const clearFilters = () => {
    setStatusFilter(new Set())
    setPriorityFilter(new Set())
    setManagerFilter('')
  }

  return (
    <div>
      <TopBar
        title="Projects"
        subtitle={
          filteredItems.length === items.length
            ? `${items.length} projects across your team`
            : `${filteredItems.length} of ${items.length} projects`
        }
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search projects"
        actions={
          <>
            <Dropdown
              button={({ toggle }) => (
                <button className="btn btn-secondary" onClick={toggle}>
                  <SlidersHorizontal size={15} /> Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </button>
              )}
            >
              {({ close }) => (
                <div className="flex w-[220px] flex-col gap-3 p-1">
                  <div>
                    <span className="text-faint mb-1.5 block text-[12px] font-[650] tracking-[0.04em] uppercase">
                      Status
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {STATUS_FILTERS.map((s) => (
                        <label
                          key={s.value}
                          className="hover:bg-subtle flex items-center gap-2 rounded-sm px-1.5 py-1 text-[13px]"
                        >
                          <input
                            type="checkbox"
                            checked={statusFilter.has(s.value)}
                            onChange={() => toggleStatus(s.value)}
                          />
                          {s.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-faint mb-1.5 block text-[12px] font-[650] tracking-[0.04em] uppercase">
                      Priority
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {PRIORITY_FILTERS.map((p) => (
                        <label
                          key={p}
                          className="hover:bg-subtle flex items-center gap-2 rounded-sm px-1.5 py-1 text-[13px]"
                        >
                          <input
                            type="checkbox"
                            checked={priorityFilter.has(p)}
                            onChange={() => togglePriority(p)}
                          />
                          {humanizeEnum(p)}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-faint mb-1.5 block text-[12px] font-[650] tracking-[0.04em] uppercase">
                      Project manager
                    </span>
                    <select
                      value={managerFilter}
                      onChange={(e) => setManagerFilter(e.target.value)}
                      className="field field-sm w-full"
                      aria-label="Project manager"
                    >
                      <option value="">All managers</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      className="text-muted hover:text-ink text-left text-[12px] font-semibold"
                      onClick={() => {
                        clearFilters()
                        close()
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </Dropdown>

            <Dropdown
              button={({ toggle }) => (
                <button className="btn btn-secondary" onClick={toggle}>
                  <ArrowUpDown size={15} /> Sort
                </button>
              )}
            >
              {({ close }) => (
                <div className="flex flex-col gap-0.5 p-1">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`hover:bg-subtle flex items-center justify-between gap-4 rounded-sm px-2 py-1.5 text-left text-[13px] ${
                        sortBy === opt.id ? 'text-ink font-semibold' : 'text-muted'
                      }`}
                      onClick={() => {
                        setSortBy(opt.id)
                        close()
                      }}
                    >
                      {opt.label}
                      {sortBy === opt.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </Dropdown>

            {canSys('PROJECT', 'CREATE') && (
              <button className="btn btn-primary" onClick={() => setShowNewProject(true)}>
                <Plus size={16} /> New Project
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-3 gap-5 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[260px] rounded-card" />
          ))}
        {!loading &&
          filteredItems.map((p) => <ProjectCard key={p.id} project={p} stats={taskStats.get(p.id)} />)}
      </div>

      {!loading && items.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          subtitle={
            canSys('PROJECT', 'CREATE')
              ? 'Create your first project to get started.'
              : 'You are not on a project yet. A Project Manager can add you to one.'
          }
        />
      )}

      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="No projects match your search or filters"
          action={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                clearFilters()
                setSearch('')
              }}
            >
              Clear
            </button>
          }
        />
      )}

      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} onSaved={refetch} />
      )}
    </div>
  )
}
