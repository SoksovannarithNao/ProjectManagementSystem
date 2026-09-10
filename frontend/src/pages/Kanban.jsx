import { useMemo, useState } from 'react'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { Avatar } from '../components/ui/Avatar'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { useMembers } from '../data/UsersContext'
import { useApi } from '../api/useApi'
import { getTasks } from '../api/tasks'
import { getTaskAssignees } from '../api/taskAssignees'
import { buildTaskAssigneeMap } from '../api/relations'
import { groupTasksByStatus } from '../api/stats'
import { formatDate } from '../api/format'

export function Kanban() {
  const { getMember } = useMembers()
  const { data: tasks, loading, refetch } = useApi(getTasks)
  const { data: taskAssignees } = useApi(getTaskAssignees)
  const [activeTask, setActiveTask] = useState(null)

  const assigneeMap = useMemo(() => buildTaskAssigneeMap(taskAssignees), [taskAssignees])
  const columns = useMemo(() => groupTasksByStatus(tasks), [tasks])

  return (
    <div>
      <TopBar
        title="Kanban Board"
        subtitle="Track progress across stages"
        actions={
          <>
            <button className="btn btn-secondary">
              <SlidersHorizontal size={15} /> Filter
            </button>
            <button className="btn btn-primary">
              <Plus size={16} /> New Task
            </button>
          </>
        }
      />

      <div className="scroll-x flex items-start gap-[18px] pb-2">
        {columns.map((col) => (
          <div
            key={col.id}
            className="bg-subtle border-divider flex w-[268px] shrink-0 flex-col gap-2.5 rounded-md border p-3.5"
          >
            <div className="flex items-center justify-between px-1 pt-0.5 pb-1.5">
              <span className="text-ink text-[13px] font-[650]">{col.title}</span>
              <span className="text-faint bg-card border-border rounded-full border px-2 text-[11px]">
                {col.tasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {!loading && col.tasks.length === 0 && (
                <p className="text-faint px-1 py-2 text-[12px]">No tasks.</p>
              )}
              {col.tasks.map((task) => {
                const assigneeIds = assigneeMap.get(task.id) ?? []
                const member = getMember(assigneeIds[0])
                return (
                  <button
                    key={task.id}
                    className="bg-card border-border shadow-card hover:shadow-card-hover duration-[var(--duration-med)] ease-[var(--ease-standard)] rounded-[13px] border p-[13px] text-left transition hover:-translate-y-px"
                    onClick={() => setActiveTask({ ...task, assigneeIds })}
                  >
                    <span className="text-faint text-[10.5px] font-[650] tracking-[0.04em] uppercase">
                      {task.project?.name}
                    </span>
                    <p className="text-ink my-2 text-[13px] leading-normal font-semibold">{task.title}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-muted text-[11px]">{formatDate(task.dueDate)}</span>
                      {member && (
                        <Avatar initials={member.initials} color={member.color} size={24} title={member.name} />
                      )}
                    </div>
                  </button>
                )
              })}
              <button className="text-faint hover:bg-card hover:text-ink duration-[var(--duration-fast)] ease-[var(--ease-standard)] flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-none p-2.5 text-[12.5px] transition-colors">
                <Plus size={14} /> Add task
              </button>
            </div>
          </div>
        ))}
      </div>

      {activeTask && (
        <TaskDetailPanel
          key={activeTask.id}
          task={activeTask}
          onClose={() => setActiveTask(null)}
          onChange={refetch}
        />
      )}
    </div>
  )
}
