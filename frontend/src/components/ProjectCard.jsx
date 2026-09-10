import { CalendarDays } from 'lucide-react'
import { AvatarGroup } from './ui/Avatar'
import { ProgressBar } from './ui/ProgressBar'
import { Badge } from './ui/Badge'
import { humanizeEnum } from '../api/format'

export function ProjectCard({ project }) {
  return (
    <div className="card hover:shadow-card-hover flex flex-col gap-4 px-6 py-[22px] shadow-[0_10px_28px_rgba(17,17,17,.22)] hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-ink mb-1 text-[15.5px] font-[650]">{project.name}</h3>
          <p className="text-muted text-[12.5px]">{project.description}</p>
        </div>
        <Badge tone={project.status}>{humanizeEnum(project.status)}</Badge>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-muted flex items-center justify-between text-xs">
          <span>Progress</span>
          <span className="text-ink font-[650]">{project.progress}%</span>
        </div>
        <ProgressBar percent={project.progress} />
      </div>

      <div className="flex items-center justify-between">
        <AvatarGroup memberIds={project.members} size={28} />
        <span className="text-muted inline-flex items-center gap-1.5 text-xs">
          <CalendarDays size={14} />
          Due {project.due}
        </span>
      </div>
    </div>
  )
}
