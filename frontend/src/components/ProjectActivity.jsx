import { useCallback, useMemo } from 'react'
import {
  History,
  FolderKanban,
  Flag,
  MessageSquare,
  Paperclip,
  ClipboardCheck,
  CheckCircle2,
  ListChecks,
  Trash2,
} from 'lucide-react'
import { useApi } from '../api/useApi'
import { getActivityByProject } from '../api/activityLog'
import { timeAgo } from '../api/format'

// What each kind of event looks like in the feed.
const ICONS = {
  PROJECT_CREATED: FolderKanban,
  PROJECT_UPDATED: FolderKanban,
  PROJECT_COMPLETED: CheckCircle2,
  MILESTONE_CREATED: Flag,
  MILESTONE_COMPLETED: Flag,
  COMMENT_ADDED: MessageSquare,
  FILE_UPLOADED: Paperclip,
  TASK_APPROVAL_REQUESTED: ClipboardCheck,
  TASK_APPROVED: ClipboardCheck,
  TASK_CHANGES_REQUESTED: ClipboardCheck,
  TASK_REJECTED: ClipboardCheck,
  TASK_APPROVER_SET: ClipboardCheck,
  TASK_DELETED: Trash2,
  SUBTASK_ADDED: ListChecks,
  SUBTASK_COMPLETED: ListChecks,
  SUBTASK_DELETED: ListChecks,
}

// The project's activity feed (project, milestone and task events, comments,
// files, approvals), newest first. Read-only; every member of the project sees it.
export function ProjectActivity({ projectId, limit = 30 }) {
  const fetcher = useCallback(() => getActivityByProject(projectId, limit), [projectId, limit])
  const { data, loading, error, refetch } = useApi(fetcher)
  const entries = useMemo(() => data ?? [], [data])

  return (
    <div className="card px-6 py-5" data-testid="project-activity">
      <div className="mb-4 flex items-center gap-2">
        <History size={15} className="text-faint" />
        <h4 className="text-[13px] font-[650]">Activity</h4>
      </div>

      {error && (
        <div className="bg-danger-soft text-danger-ink flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-[12px] font-semibold">
          <span>Failed to load activity.</span>
          <button type="button" className="underline underline-offset-2" onClick={refetch}>
            Try again
          </button>
        </div>
      )}

      {!error && !loading && entries.length === 0 && <p className="text-faint text-[12px]">No activity yet.</p>}

      <div className="flex flex-col gap-3">
        {entries.map((entry) => {
          const Icon = ICONS[entry.action] ?? History
          return (
            <div key={entry.id} className="flex gap-2.5">
              <span className="bg-subtle text-faint mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                <Icon size={12} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ink text-[12px] leading-snug break-words">
                  {entry.taskTitle && <span className="text-muted font-semibold">{entry.taskTitle} — </span>}
                  {entry.description}
                </p>
                <span className="text-faint text-[12px]">
                  {entry.userName} · {timeAgo(entry.createdAt)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
