import { useMemo, useState } from 'react'
import { Plus, FolderKanban } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { ProjectCard } from '../components/ProjectCard'
import { NewProjectModal } from '../components/NewProjectModal'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { useAuth } from '../auth/AuthContext'
import { canCreateProject } from '../api/permissions'
import { useApi } from '../api/useApi'
import { getProjects } from '../api/projects'
import { getProjectMembers } from '../api/projectMembers'
import { buildProjectMemberMap, toProjectCard } from '../api/relations'

export function Projects() {
  const { role } = useAuth()
  const { data: projects, loading, refetch } = useApi(getProjects)
  const { data: projectMembers } = useApi(getProjectMembers)
  const [showNewProject, setShowNewProject] = useState(false)
  const [search, setSearch] = useState('')
  const memberMap = useMemo(() => buildProjectMemberMap(projectMembers), [projectMembers])

  const items = useMemo(
    () => (projects ?? []).map((p) => toProjectCard(p, memberMap.get(p.id) ?? [])),
    [projects, memberMap]
  )

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (p) => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
    )
  }, [items, search])

  return (
    <div>
      <TopBar
        title="Projects"
        subtitle={`${items.length} active projects across your team`}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search projects"
        actions={
          canCreateProject(role) && (
            <button className="btn btn-primary" onClick={() => setShowNewProject(true)}>
              <Plus size={16} /> New Project
            </button>
          )
        }
      />

      <div className="grid grid-cols-3 gap-5 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[172px] rounded-card" />
          ))}
        {!loading && filteredItems.map((p) => <ProjectCard key={p.id} project={p} />)}
      </div>

      {!loading && items.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          subtitle={canCreateProject(role) ? 'Create your first project to get started.' : 'Check back once one is created.'}
        />
      )}

      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <EmptyState icon={FolderKanban} title="No projects match your search" />
      )}

      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} onCreated={refetch} />
      )}
    </div>
  )
}
