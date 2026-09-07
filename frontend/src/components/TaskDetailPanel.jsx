import { useState } from 'react'
import {
  X,
  CalendarDays,
  Flag,
  FolderKanban,
  Paperclip,
  CheckSquare,
  Square,
  Send,
} from 'lucide-react'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'
import { getMember } from '../data/mockData'

const defaultSubtasks = [
  { id: 's1', label: 'Gather requirements', done: true },
  { id: 's2', label: 'Draft initial version', done: true },
  { id: 's3', label: 'Get stakeholder feedback', done: false },
  { id: 's4', label: 'Finalize and ship', done: false },
]

const defaultComments = [
  { id: 'c1', user: 'u3', text: 'Left a few notes on the latest draft, looks great overall.', time: '2h ago' },
  { id: 'c2', user: 'u1', text: 'Thanks! Will address those before Friday.', time: '1h ago' },
]

export function TaskDetailPanel({ task, onClose }) {
  const [subtasks, setSubtasks] = useState(defaultSubtasks)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState(defaultComments)

  if (!task) return null

  const assignee = getMember(task.assignee)
  const doneCount = subtasks.filter((s) => s.done).length

  const toggleSubtask = (id) => {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)))
  }

  const submitComment = (e) => {
    e.preventDefault()
    if (!comment.trim()) return
    setComments((prev) => [...prev, { id: `c${Date.now()}`, user: 'u1', text: comment.trim(), time: 'Just now' }])
    setComment('')
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex justify-end bg-[rgba(20,20,22,.32)]"
      onClick={onClose}
    >
      <aside
        className="animate-slide-in bg-card shadow-pop flex h-full w-[440px] max-w-[100vw] flex-col max-sm:w-[100vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-divider flex items-center justify-between border-b px-[22px] py-[18px]">
          <span className="text-faint text-[11.5px] font-[650] tracking-[0.05em] uppercase">
            Task
          </span>
          <button className="icon-btn" onClick={onClose} aria-label="Close panel">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-[22px] pt-5 pb-6">
          <h2 className="mb-3.5 text-xl font-bold tracking-[-0.015em]">{task.name || task.title}</h2>

          <div className="mb-5 flex gap-2">
            <Badge tone={task.status || 'To Do'}>{task.status || 'To Do'}</Badge>
            <Badge tone={task.priority || 'Medium'}>{task.priority || 'Medium'}</Badge>
          </div>

          <div className="bg-subtle border-border mb-[22px] grid grid-cols-2 gap-4 rounded-md border p-4 max-sm:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                <CalendarDays size={14} /> Due date
              </span>
              <span className="text-ink text-[13px] font-semibold">{task.due}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                <FolderKanban size={14} /> Project
              </span>
              <span className="text-ink text-[13px] font-semibold">{task.project}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                <Flag size={14} /> Priority
              </span>
              <span className="text-ink text-[13px] font-semibold">{task.priority || 'Medium'}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint text-[11.5px] font-semibold">Assignee</span>
              {assignee ? (
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
                  <Avatar initials={assignee.initials} color={assignee.color} size={22} />
                  {assignee.name}
                </span>
              ) : (
                <span className="text-ink text-[13px] font-semibold">Unassigned</span>
              )}
            </div>
          </div>

          <div className="mb-[22px]">
            <h4 className="mb-2.5 text-[13px] font-[650]">Description</h4>
            <p className="text-muted text-[13px] leading-relaxed">
              Work on <strong>{task.name || task.title}</strong> for the {task.project} project. Keep the team
              posted on progress and flag any blockers early so the timeline stays on track.
            </p>
          </div>

          <div className="mb-[22px]">
            <div className="mb-2.5 flex items-center justify-between">
              <h4 className="text-[13px] font-[650]">Subtasks</h4>
              <span className="text-faint text-[11.5px] font-semibold">
                {doneCount}/{subtasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {subtasks.map((s) => (
                <button
                  key={s.id}
                  className="text-ink hover:bg-subtle duration-[var(--duration-fast)] ease-[var(--ease-standard)] flex items-center gap-2.5 rounded-sm border-none bg-none px-1 py-2 text-left text-[13px] transition-colors [&_svg]:text-faint [&_svg]:shrink-0"
                  onClick={() => toggleSubtask(s.id)}
                >
                  {s.done ? <CheckSquare size={17} /> : <Square size={17} />}
                  <span className={s.done ? 'text-faint line-through' : ''}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-[22px]">
            <h4 className="mb-2.5 text-[13px] font-[650]">Attachments</h4>
            <div className="bg-subtle border-border text-muted flex items-center gap-2 rounded-sm border px-3 py-2.5 text-[12.5px]">
              <Paperclip size={14} />
              <span>homepage-wireframe-v3.fig</span>
            </div>
          </div>

          <div className="mb-[22px]">
            <h4 className="mb-2.5 text-[13px] font-[650]">Comments</h4>
            <div className="flex flex-col gap-3.5">
              {comments.map((c) => {
                const user = getMember(c.user)
                return (
                  <div key={c.id} className="flex gap-2.5">
                    {user && <Avatar initials={user.initials} color={user.color} size={28} />}
                    <div className="min-w-0 flex-1">
                      <div className="mb-[3px] flex items-baseline gap-2">
                        <span className="text-[12.5px] font-[650]">{user?.name}</span>
                        <span className="text-faint text-[11px]">{c.time}</span>
                      </div>
                      <p className="text-muted text-[12.5px] leading-normal">{c.text}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <form
          className="border-divider flex items-center gap-2 border-t px-[18px] py-3.5"
          onSubmit={submitComment}
        >
          <input
            type="text"
            placeholder="Add a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="bg-subtle border-border focus:border-lavender h-10 flex-1 rounded-md border px-3.5 text-[13px] outline-none"
          />
          <button type="submit" className="icon-btn" aria-label="Send comment">
            <Send size={16} />
          </button>
          <button type="button" className="btn btn-primary px-4 py-2.5">
            Save
          </button>
        </form>
      </aside>
    </div>
  )
}
