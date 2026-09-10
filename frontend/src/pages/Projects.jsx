import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { ProjectCard } from '../components/ProjectCard'
import { useApi } from '../api/useApi'
import { getProjects } from '../api/projects'
import { getProjectMembers } from '../api/projectMembers'
import { buildProjectMemberMap, toProjectCard } from '../api/relations'

export function Projects() {
  const { data: projects, loading } = useApi(getProjects)
  const { data: projectMembers } = useApi(getProjectMembers)
  const memberMap = useMemo(() => buildProjectMemberMap(projectMembers), [projectMembers])

  const items = useMemo(
    () => (projects ?? []).map((p) => toProjectCard(p, memberMap.get(p.id) ?? [])),
    [projects, memberMap]
  )

  return (
    <div>
      <TopBar
        title="Projects"
        subtitle={`${items.length} active projects across your team`}
        actions={
          <button className="btn btn-primary">
            <Plus size={16} /> New Project
          </button>
        }
      />

      {loading && <p className="text-faint mb-4 text-[13px]">Loading projects…</p>}

      <div className="grid grid-cols-3 gap-5 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        {items.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  )
}
