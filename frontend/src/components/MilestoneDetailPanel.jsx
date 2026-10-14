import { Link } from 'react-router-dom'
import { Flag, CalendarDays, FolderKanban, ChevronRight, X } from 'lucide-react'
import { Badge } from './ui/Badge'
import { ProgressBar } from './ui/ProgressBar'
import { formatLongDate, formatDate, humanizeEnum } from '../api/format'

// A milestone's details as one pane of the calendar's day drawer (beside the task panel's pane): status, project,
// due date, progress (derived from its linked tasks, so it is only shown), description and the tasks linked to it.
// A linked task opens in the task pane. Editing a milestone stays on its project page (a link leads there).
// The X closes this pane only; the day's list stays.
//
//   milestone  a MilestoneResponse
//   tasks      the tasks linked to it
export function MilestoneDetailPanel({ milestone, tasks, onOpenTask, onClose }) {
  const percent = Math.round(Number(milestone.progress ?? 0))
  return (
    <aside className="bg-card flex h-full w-full flex-col" data-testid="milestone-detail-panel" aria-label="Milestone">
      <div className="border-divider flex items-center justify-between border-b px-[22px] py-[18px]">
        <span className="text-ink text-[15px] font-[650]">Milestone</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-[22px] pt-5 pb-6">
        <div className="mb-4 flex items-start gap-2.5">
          <Flag size={18} className="text-faint mt-0.5 shrink-0" aria-hidden="true" />
          <h4 className="text-ink min-w-0 flex-1 text-[16px] font-[650] break-words">{milestone.title}</h4>
          <Badge tone={milestone.status}>{humanizeEnum(milestone.status)}</Badge>
        </div>

        <div className="bg-subtle border-border mb-[22px] grid grid-cols-2 gap-4 rounded-md border p-4 max-sm:grid-cols-1">
          <div className="flex flex-col gap-1.5">
            <span className="text-faint inline-flex items-center gap-1.5 text-[12px] font-semibold">
              <CalendarDays size={14} /> Due date
            </span>
            <span className="text-ink text-[13px] font-semibold">{formatLongDate(milestone.dueDate)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-faint inline-flex items-center gap-1.5 text-[12px] font-semibold">
              <FolderKanban size={14} /> Project
            </span>
            {milestone.project ? (
              <Link to={`/projects/${milestone.project.id}`} className="text-ink text-[13px] font-semibold hover:underline">
                {milestone.project.name}
              </Link>
            ) : (
              <span className="text-ink text-[13px] font-semibold">—</span>
            )}
          </div>
        </div>

        <div className="mb-[22px] flex flex-col gap-2">
          <div className="text-muted flex items-center justify-between text-xs">
            <span>Progress</span>
            <span className="text-ink font-[650]">{percent}%</span>
          </div>
          <ProgressBar percent={percent} />
          <span className="text-faint text-[12px]">Worked out from the tasks linked to this milestone.</span>
        </div>

        <div className="mb-[22px]">
          <h4 className="mb-2.5 text-[13px] font-[650]">Description</h4>
          <p className="text-muted text-[13px] leading-relaxed">{milestone.description || 'No description provided.'}</p>
        </div>

        <div>
          <h4 className="mb-2.5 text-[13px] font-[650]">Linked tasks ({tasks.length})</h4>
          {tasks.length === 0 && <p className="text-faint text-[12px]">No task is linked to this milestone.</p>}
          <div className="flex flex-col">
            {tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                data-testid="milestone-linked-task"
                onClick={() => onOpenTask(t)}
                className="border-divider hover:bg-subtle -mx-2 flex items-center gap-3 rounded-md border-b px-2 py-2.5 text-left last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-ink block truncate text-[13px] font-semibold">{t.title}</span>
                  <span className="text-faint block text-[12px]">Due {formatDate(t.dueDate)}</span>
                </span>
                <Badge tone={t.status}>{humanizeEnum(t.status)}</Badge>
                <ChevronRight size={15} className="text-faint shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
