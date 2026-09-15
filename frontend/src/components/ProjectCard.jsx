import { Link } from 'react-router-dom'
import { CalendarDays, ListChecks, AlertTriangle } from 'lucide-react'
import { Avatar, AvatarGroup } from './ui/Avatar'
import { ProgressBar } from './ui/ProgressBar'
import { Badge } from './ui/Badge'
import { humanizeEnum, formatDate, initialsFor, colorForId } from '../api/format'

// `stats` is optional ({ total, completed, overdue } from
// buildProjectTaskStats) — omitted wherever a caller hasn't already fetched
// the task list (e.g. Dashboard's top-2 widget), since fetching all tasks
// just for two cards isn't worth it there.
export function ProjectCard({ project, stats }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="card hover:shadow-card-hover flex flex-col gap-4 px-6 py-[22px] shadow-[0_10px_28px_rgba(17,17,17,.22)] hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-ink truncate text-[15.5px] font-[650]">{project.name}</h3>
          {project.projectCode && <p className="text-faint mt-0.5 text-[11px] font-semibold">{project.projectCode}</p>}
          <p className="text-muted mt-1.5 line-clamp-2 text-[12.5px]">{project.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge tone={project.status}>{humanizeEnum(project.status)}</Badge>
          {project.priority && <Badge tone={project.priority}>{humanizeEnum(project.priority)}</Badge>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-muted flex items-center justify-between text-xs">
          <span>Progress</span>
          <span className="text-ink font-[650]">{project.progress}%</span>
        </div>
        <ProgressBar percent={project.progress} />
      </div>

      {stats && (
        <div className="text-muted flex items-center gap-3.5 text-[11.5px]">
          <span className="inline-flex items-center gap-1.5">
            <ListChecks size={13} />
            {stats.completed}/{stats.total} tasks
          </span>
          {stats.overdue > 0 && (
            <span className="text-danger inline-flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={13} />
              {stats.overdue} overdue
            </span>
          )}
        </div>
      )}

      {project.manager && (
        <div className="flex items-center gap-2">
          <Avatar
            initials={initialsFor(project.manager.fullName)}
            color={colorForId(project.manager.id)}
            photoUrl={project.manager.profilePhotoUrl}
            size={22}
          />
          <span className="text-muted truncate text-[12px]">{project.manager.fullName}</span>
        </div>
      )}

      <div className="border-divider flex items-center justify-between border-t pt-3.5">
        <AvatarGroup memberIds={project.members} size={28} />
        <span className="text-muted inline-flex items-center gap-1.5 text-xs">
          <CalendarDays size={14} />
          {project.startDate ? `${formatDate(project.startDate)} – ${formatDate(project.endDate)}` : `Due ${project.due}`}
        </span>
      </div>
    </Link>
  )
}
