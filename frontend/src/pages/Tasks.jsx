import { useState } from 'react'
import {
  Plus,
  SlidersHorizontal,
  ArrowUpDown,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  GripVertical,
  Paperclip,
  MessageSquare,
} from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { AvatarGroup } from '../components/ui/Avatar'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { allTasks, getMember } from '../data/mockData'

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
  { key: 'todo', title: 'To do', match: (status) => status === 'To Do' },
  { key: 'doing', title: 'Doing', match: (status) => status === 'In Progress' || status === 'Review' },
  { key: 'done', title: 'Done', match: (status) => status === 'Done' },
]

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

      <div className="flex flex-col gap-6">
        {SECTIONS.map((section) => {
          const sectionTasks = tasks.filter((t) => section.match(t.status))
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
                {sectionTasks.length === 0 && (
                  <p className="text-faint px-2 py-3 text-[12.5px]">No tasks here yet.</p>
                )}
                {sectionTasks.map((t) => {
                  const member = getMember(t.assignee)
                  const pill = pillColor(t.project)
                  const hash = hashStr(t.id)
                  const commentCount = (hash % 4) + 1
                  const hasAttachment = hash % 3 === 0

                  return (
                    <div
                      key={t.id}
                      onClick={() => setActiveTask(t)}
                      className="group bg-card border-border shadow-card hover:shadow-card-hover duration-[var(--duration-med)] ease-[var(--ease-standard)] flex cursor-pointer flex-wrap items-center gap-3 rounded-[13px] border px-4 py-3 transition hover:-translate-y-px sm:flex-nowrap"
                    >
                      <GripVertical size={14} className="text-faint hidden shrink-0 sm:block" />

                      <button
                        onClick={(e) => toggleDone(t.id, e)}
                        className="shrink-0"
                        aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
                      >
                        {t.done ? (
                          <CheckCircle2 size={18} color="var(--status-success)" />
                        ) : (
                          <Circle size={18} className="text-faint" />
                        )}
                      </button>

                      <div className="min-w-[140px] flex-1">
                        <p
                          className={`truncate text-[13.5px] font-semibold ${t.done ? 'text-faint line-through' : 'text-ink'}`}
                        >
                          {t.name}
                        </p>
                        {t.description && (
                          <p className="text-muted mt-0.5 truncate text-[12px]">{t.description}</p>
                        )}
                      </div>

                      <div className="text-faint hidden shrink-0 items-center justify-end gap-3 text-[12px] md:flex md:w-14">
                        {hasAttachment && <Paperclip size={14} />}
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare size={14} /> {commentCount}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="flex w-7 shrink-0 items-center justify-center">
                          {member && <AvatarGroup memberIds={[t.assignee]} size={28} />}
                        </div>
                        <span
                          className="w-[110px] shrink-0 rounded-full px-2.5 py-1 text-center text-[11px] font-semibold whitespace-nowrap"
                          style={{ background: pill.bg, color: pill.text }}
                        >
                          {t.project}
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

      {activeTask && <TaskDetailPanel task={activeTask} onClose={() => setActiveTask(null)} />}
    </div>
  )
}
