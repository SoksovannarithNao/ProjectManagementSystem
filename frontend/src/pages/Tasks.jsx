import { useState } from 'react'
import {
  Plus,
  SlidersHorizontal,
  ArrowUpDown,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  GripVertical,
  CalendarDays,
} from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { allTasks, getMember } from '../data/mockData'
import './Tasks.css'

const STATUS_ORDER = ['To Do', 'In Progress', 'Review', 'Done']

const PROJECT_TONES = ['green', 'pink', 'yellow', 'orange', 'blue', 'purple']

function projectTone(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return PROJECT_TONES[hash % PROJECT_TONES.length]
}

export function Tasks() {
  const [tasks, setTasks] = useState(allTasks)
  const [activeTask, setActiveTask] = useState(null)

  const toggleDone = (id, e) => {
    e.stopPropagation()
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done, status: !t.done ? 'Done' : 'To Do' } : t))
    )
  }

  const sections = STATUS_ORDER.map((status) => ({
    status,
    items: tasks.filter((t) => t.status === status),
  }))

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

      <div className="tasks-board">
        {sections.map((section) => (
          <section className="tasks-section" key={section.status}>
            <header className="tasks-section__head">
              <div className="tasks-section__heading">
                <h3 className="tasks-section__title">{section.status}</h3>
                <span className="tasks-section__count">{section.items.length}</span>
              </div>
              <button className="tasks-section__add">
                <Plus size={14} /> Add task
              </button>
            </header>

            <div className="tasks-section__list">
              {section.items.length === 0 && (
                <div className="tasks-section__empty">No tasks here yet</div>
              )}

              {section.items.map((t) => {
                const member = getMember(t.assignee)
                const tone = projectTone(t.project)
                return (
                  <div key={t.id} className="task-row" onClick={() => setActiveTask(t)}>
                    <span className="task-row__handle" aria-hidden="true">
                      <GripVertical size={15} />
                    </span>

                    <button
                      className="task-row__check"
                      onClick={(e) => toggleDone(t.id, e)}
                      aria-label="Toggle complete"
                    >
                      {t.done ? (
                        <CheckCircle2 size={18} color="var(--status-success)" />
                      ) : (
                        <Circle size={18} color="var(--text-muted)" />
                      )}
                    </button>

                    <div className="task-row__main">
                      <span className={t.done ? 'task-row__title task-row__title--done' : 'task-row__title'}>
                        {t.name}
                      </span>
                      {t.project && <span className="task-row__subtitle">{t.project}</span>}
                    </div>

                    <div className="task-row__meta">
                      {t.due && (
                        <span className="task-row__due">
                          <CalendarDays size={13} />
                          {t.due}
                        </span>
                      )}
                    </div>

                    <div className="task-row__right">
                      {member && (
                        <Avatar initials={member.initials} color={member.color} size={28} title={member.name} />
                      )}
                      <span className={`pill pill--${tone}`}>{t.project}</span>
                      <Badge tone={t.priority}>{t.priority}</Badge>
                      <button
                        className="task-row__menu"
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
          </section>
        ))}
      </div>

      {activeTask && <TaskDetailPanel task={activeTask} onClose={() => setActiveTask(null)} />}
    </div>
  )
}
