import { useState } from 'react'
import { Plus, SlidersHorizontal, ArrowUpDown, CheckCircle2, Circle, MoreHorizontal } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { allTasks, getMember } from '../data/mockData'

export function Tasks() {
  const [tasks, setTasks] = useState(allTasks)
  const [activeTask, setActiveTask] = useState(null)

  const toggleDone = (id, e) => {
    e.stopPropagation()
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done, status: !t.done ? 'Done' : 'To Do' } : t))
    )
  }

  return (
    <div>
      <TopBar
        title="My Tasks"
        subtitle={`${tasks.length} tasks across all your projects`}
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

      <div className="card px-2 pt-2 pb-1">
        <div className="scroll-x">
          <table className="w-full min-w-[780px] border-collapse">
            <thead>
              <tr>
                <th className="w-10"></th>
                <th className="text-faint border-divider border-b px-4 py-3.5 text-left text-[11.5px] font-[650] tracking-[0.04em] uppercase">
                  Task
                </th>
                <th className="text-faint border-divider border-b px-4 py-3.5 text-left text-[11.5px] font-[650] tracking-[0.04em] uppercase">
                  Project
                </th>
                <th className="text-faint border-divider border-b px-4 py-3.5 text-left text-[11.5px] font-[650] tracking-[0.04em] uppercase">
                  Assignee
                </th>
                <th className="text-faint border-divider border-b px-4 py-3.5 text-left text-[11.5px] font-[650] tracking-[0.04em] uppercase">
                  Priority
                </th>
                <th className="text-faint border-divider border-b px-4 py-3.5 text-left text-[11.5px] font-[650] tracking-[0.04em] uppercase">
                  Status
                </th>
                <th className="text-faint border-divider border-b px-4 py-3.5 text-left text-[11.5px] font-[650] tracking-[0.04em] uppercase">
                  Due Date
                </th>
                <th className="border-divider border-b"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const member = getMember(t.assignee)
                return (
                  <tr
                    key={t.id}
                    onClick={() => setActiveTask(t)}
                    className="hover:bg-subtle duration-[var(--duration-fast)] ease-[var(--ease-standard)] cursor-pointer transition-colors last:[&>td]:border-b-0 [&>td]:border-b [&>td]:border-[#d3d4d8] [&>td]:px-4 [&>td]:py-3.5 [&>td]:align-middle [&>td]:whitespace-nowrap [&>td]:text-[13.5px] [&>td]:text-ink"
                  >
                    <td onClick={(e) => toggleDone(t.id, e)}>
                      {t.done ? (
                        <CheckCircle2 size={18} color="var(--status-success)" />
                      ) : (
                        <Circle size={18} color="var(--text-muted)" />
                      )}
                    </td>
                    <td
                      className={`!min-w-[200px] !whitespace-normal font-semibold ${t.done ? '!text-faint line-through' : ''}`}
                    >
                      {t.name}
                    </td>
                    <td className="!text-muted">{t.project}</td>
                    <td>
                      {member && (
                        <span className="text-muted inline-flex items-center gap-2 text-[12.5px]">
                          <Avatar initials={member.initials} color={member.color} size={26} />
                          {member.name}
                        </span>
                      )}
                    </td>
                    <td>
                      <Badge tone={t.priority}>{t.priority}</Badge>
                    </td>
                    <td>
                      <Badge tone={t.status}>{t.status}</Badge>
                    </td>
                    <td className="!text-muted">{t.due}</td>
                    <td>
                      <button
                        className="icon-btn"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="More actions"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {activeTask && <TaskDetailPanel task={activeTask} onClose={() => setActiveTask(null)} />}
    </div>
  )
}
