import { useMemo, useState } from 'react'
import {
  Plus,
  SlidersHorizontal,
  ArrowUpDown,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  GripVertical,
} from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { AvatarGroup } from '../components/ui/Avatar'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { useApi } from '../api/useApi'
import { getTasks, toggleTaskCompletion } from '../api/tasks'
import { getTaskAssignees } from '../api/taskAssignees'
import { buildTaskAssigneeMap } from '../api/relations'

function hashStr(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

const PILL_COLORS = [
  { bg: '#E7F5EA', text: '#4B8B5E' },
  { bg: '#FBEAEC', text: '#C2596B' },
  { bg: '#FDEEE1', text: '#C07A3E' },
  { bg: '#FCF3D9', text: '#B08A2E' },
  { bg: '#E8EFFC', text: '#4C6FB9' },
  { bg: '#F2E9FB', text: '#8B5CB9' },
]

function pillColor(key) {
  return PILL_COLORS[hashStr(key || '') % PILL_COLORS.length]
}

const SECTIONS = [
  { key: 'todo', title: 'To do', match: (status) => status === 'TO_DO' },
  { key: 'doing', title: 'Doing', match: (status) => status === 'IN_PROGRESS' || status === 'IN_REVIEW' },
  { key: 'done', title: 'Done', match: (status) => status === 'COMPLETED' || status === 'CANCELLED' },
]

export function Tasks() {
  const { data: tasks, loading, refetch } = useApi(getTasks)
  const { data: taskAssignees } = useApi(getTaskAssignees)
  const [activeTask, setActiveTask] = useState(null)

  const assigneeMap = useMemo(() => buildTaskAssigneeMap(taskAssignees), [taskAssignees])
  const list = tasks ?? []

  const toggleDone = async (task, e) => {
    e.stopPropagation()
    await toggleTaskCompletion(task)
    refetch()
  }

  return (
    <div>
      <TopBar
        title="My Tasks"
        subtitle={`${list.length} tasks across all your projects`}
        actions={
          <>
            <button className="btn btn-secondary">
              <SlidersHorizontal size={15} /> Filter
            </button>
            <button className="btn btn-secondary">
              <ArrowUpDown size={15} /> Sort
            </button>
            <button className="btn btn-primary">
              <Plus size={16} /> New Task
            </button>
          </>
        }
      />

      <div className="flex flex-col gap-6">
        {SECTIONS.map((section) => {
          const sectionTasks = list.filter((t) => section.match(t.status))
          return (
            <div
              key={section.key}
              className="rounded-2xl p-4 sm:p-5"
              style={{ background: 'rgba(40, 43, 50, 0.2)' }}
            >
              <div className="mb-3.5 flex items-center justify-between px-1">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-ink text-[15px] font-[650]">{section.title}</h3>
                  <span className="text-[17px] font-bold" style={{ color: 'rgba(40, 24, 27, 0.85)' }}>{sectionTasks.length}</span>
                </div>
                <button className="hover:text-ink duration-[var(--duration-fast)] ease-[var(--ease-standard)] inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#3a3a3d] transition-colors">
                  <Plus size={14} /> Add task
                </button>
              </div>

              <div className="flex flex-col gap-2.5">
                {!loading && sectionTasks.length === 0 && (
                  <p className="text-faint px-2 py-3 text-[12.5px]">No tasks here yet.</p>
                )}
                {sectionTasks.map((t) => {
                  const assigneeIds = assigneeMap.get(t.id) ?? []
                  const pill = pillColor(t.project?.name)
                  const done = t.status === 'COMPLETED'

                  return (
                    <div
                      key={t.id}
                      onClick={() => setActiveTask({ ...t, assigneeIds })}
                      className="group bg-card border-border shadow-card hover:shadow-card-hover duration-[var(--duration-med)] ease-[var(--ease-standard)] flex cursor-pointer flex-wrap items-center gap-3 rounded-[13px] border px-4 py-3 transition hover:-translate-y-px sm:flex-nowrap"
                    >
                      <GripVertical size={14} className="text-faint hidden shrink-0 sm:block" />

                      <button
                        onClick={(e) => toggleDone(t, e)}
                        className="shrink-0"
                        aria-label={done ? 'Mark as not done' : 'Mark as done'}
                      >
                        {done ? (
                          <CheckCircle2 size={18} color="var(--status-success)" />
                        ) : (
                          <Circle size={18} className="text-faint" />
                        )}
                      </button>

                      <div className="min-w-[140px] flex-1">
                        <p
                          className={`truncate text-[13.5px] font-semibold ${done ? 'text-faint line-through' : 'text-ink'}`}
                        >
                          {t.title}
                        </p>
                        {t.description && (
                          <p className="text-muted mt-0.5 truncate text-[12px]">{t.description}</p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="flex w-7 shrink-0 items-center justify-center">
                          {assigneeIds.length > 0 && <AvatarGroup memberIds={assigneeIds} size={28} />}
                        </div>
                        <span
                          className="w-[110px] shrink-0 rounded-full px-2.5 py-1 text-center text-[11px] font-semibold whitespace-nowrap"
                          style={{ background: pill.bg, color: pill.text }}
                        >
                          {t.project?.name}
                        </span>
                        <button
                          className="icon-btn h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="More actions"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
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
