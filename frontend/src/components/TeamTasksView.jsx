import { useCallback, useState } from 'react'
import { AlertTriangle, Users } from 'lucide-react'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'
import { ProgressBar } from './ui/ProgressBar'
import { EmptyState } from './ui/EmptyState'
import { Skeleton } from './ui/Skeleton'
import { useToast } from './ui/Toast'
import { useApi } from '../api/useApi'
import { getTeamTasks } from '../api/teamViews'
import { createTaskAssignee, deleteTaskAssignee } from '../api/taskAssignees'
import { formatDate, humanizeEnum, initialsFor, colorForId } from '../api/format'

// Team Tasks (workflow flow 22): every active member of the project with the
// tasks assigned to them and how far along they are, plus the tasks nobody has
// yet. A task opens in the usual panel (follow up); someone who may assign can
// move it to another member from here (reassign).
//   canAssign  TASK:ASSIGN in this project
// One task of a member (or of the unassigned list): open it, see where it stands,
// and - for someone who may assign - move it to another member.
function TaskRow({ task, memberUserId, canAssign, busy, memberOptions, onOpenTask, onReassign }) {
  return (
    <div
      className="border-divider flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b py-2.5 last:border-b-0"
      data-testid="team-task-row"
    >
      <button
        type="button"
        className="text-ink hover:text-lavender min-w-[160px] flex-1 truncate text-left text-[13px] font-semibold"
        onClick={() => onOpenTask?.(task.id)}
      >
        {task.title}
      </button>
      <Badge tone={task.status}>{humanizeEnum(task.status)}</Badge>
      {task.overdue && (
        <span className="bg-danger-soft text-danger-ink inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] leading-none font-semibold">
          <AlertTriangle size={12} /> Overdue
        </span>
      )}
      <span className="text-muted w-[64px] text-[12px]">{formatDate(task.dueDate)}</span>
      <span className="flex w-[110px] items-center gap-2">
        <span className="min-w-0 flex-1">
          <ProgressBar percent={Number(task.progress ?? 0)} height={5} />
        </span>
        <span className="text-faint w-8 text-right text-[12px]">{Math.round(Number(task.progress ?? 0))}%</span>
      </span>
      {canAssign && task.status !== 'COMPLETED' && (
        <select
          aria-label={`Reassign ${task.title}`}
          value={memberUserId ?? ''}
          disabled={busy}
          onChange={(e) => onReassign(task, task.assignmentId, e.target.value)}
          className="bg-subtle border-border h-8 max-w-[150px] rounded-md border px-2 text-[12px] outline-none"
        >
          <option value="">{memberUserId ? 'Unassign' : 'Assign to…'}</option>
          {memberOptions
            .filter((m) => m.user.id !== memberUserId)
            .map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.fullName}
              </option>
            ))}
        </select>
      )}
    </div>
  )
}

export function TeamTasksView({ projectId, canAssign, onOpenTask, refreshKey = 0, onChanged }) {
  const notify = useToast()
  const fetcher = useCallback(() => getTeamTasks(projectId).then((r) => ({ ...r, key: refreshKey })), [projectId, refreshKey])
  const { data, loading, error, refetch } = useApi(fetcher)
  const [busyTask, setBusyTask] = useState(null)

  // Reassign = unassign from the current member (if any), then assign the new one.
  const reassign = async (task, fromAssignmentId, toUserId) => {
    setBusyTask(task.id)
    try {
      if (fromAssignmentId != null) await deleteTaskAssignee(fromAssignmentId)
      if (toUserId) await createTaskAssignee({ taskId: task.id, userId: Number(toUserId) })
      notify(toUserId ? 'Task reassigned' : 'Task unassigned', { tone: 'success' })
      refetch()
      onChanged?.()
    } catch (err) {
      notify(err.message || 'Failed to reassign the task', { tone: 'error' })
      refetch()
    } finally {
      setBusyTask(null)
    }
  }

  if (loading) return <Skeleton className="h-[200px] rounded-card" />
  if (error) {
    return (
      <EmptyState
        icon={Users}
        title={error.status === 403 ? 'Only the Owner, a Team Leader or an Administrator can see this' : 'Failed to load the team'}
        subtitle={error.status === 403 ? undefined : error.message}
      />
    )
  }
  const members = data?.members ?? []
  const unassigned = data?.unassigned ?? []
  const memberOptions = members.filter((m) => m.user)

  return (
    <div className="flex flex-col gap-4" data-testid="team-tasks">
      {members.length === 0 && <EmptyState icon={Users} title="No team members yet" />}

      {members.map((m) => (
        <section key={m.user.id} className="card px-6 py-5" data-testid="team-member">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Avatar
              initials={initialsFor(m.user.fullName)}
              color={colorForId(m.user.id)}
              photoUrl={m.user.profilePhotoUrl}
              size={34}
            />
            <div className="min-w-0 flex-1">
              <p className="text-ink truncate text-[14px] font-[650]">{m.user.fullName}</p>
              <p className="text-faint text-[12px]">{humanizeEnum(m.projectRole)}</p>
            </div>
            <div className="text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
              <span>
                <strong className="text-ink">{m.assigned}</strong> assigned
              </span>
              <span>
                <strong className="text-ink">{m.active}</strong> active
              </span>
              <span className={m.overdue > 0 ? 'text-danger-ink font-semibold' : ''}>
                <strong>{m.overdue}</strong> overdue
              </span>
              <span>
                <strong className="text-ink">{m.completed}</strong> completed
              </span>
              <span className="flex w-[130px] items-center gap-2">
                <span className="min-w-0 flex-1">
                  <ProgressBar percent={Number(m.averageProgress ?? 0)} height={6} />
                </span>
                <span className="text-ink w-9 text-right font-semibold">{Math.round(Number(m.averageProgress ?? 0))}%</span>
              </span>
            </div>
          </div>
          {m.tasks.length === 0 ? (
            <p className="text-faint text-[12px]">No tasks assigned.</p>
          ) : (
            m.tasks.map((t) => (
              <TaskRow key={t.id} task={t} memberUserId={m.user.id} canAssign={canAssign} busy={busyTask === t.id} memberOptions={memberOptions} onOpenTask={onOpenTask} onReassign={reassign} />
            ))
          )}
        </section>
      ))}

      <section className="card px-6 py-5" data-testid="team-unassigned">
        <h4 className="mb-2 text-[13px] font-[650]">
          Unassigned <span className="text-faint font-semibold">({unassigned.length})</span>
        </h4>
        {unassigned.length === 0 ? (
          <p className="text-faint text-[12px]">Every task has someone on it.</p>
        ) : (
          unassigned.map((t) => (
            <TaskRow key={t.id} task={t} memberUserId={null} canAssign={canAssign} busy={busyTask === t.id} memberOptions={memberOptions} onOpenTask={onOpenTask} onReassign={reassign} />
          ))
        )}
      </section>
    </div>
  )
}
