import { useMemo, useState } from 'react'
import {
  X,
  CalendarDays,
  Flag,
  FolderKanban,
  CheckSquare,
  Square,
  Send,
} from 'lucide-react'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'
import { useMembers } from '../data/UsersContext'
import { useAuth } from '../auth/AuthContext'
import { setTaskStatus } from '../api/tasks'
import { formatDate, humanizeEnum, initialsFor } from '../api/format'

const STATUS_OPTIONS = ['TO_DO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED']

export function TaskDetailPanel({ task, onClose, onChange }) {
  const { getMember } = useMembers()
  const { profile, username } = useAuth()
  // Subtasks/comments have no backend entity — a local-only, empty-by-default
  // checklist per task (not the same fake seed data for every task). The
  // parent gives this component `key={task.id}` so switching tasks remounts
  // it and resets this state naturally, without an extra effect.
  const [subtasks, setSubtasks] = useState([])
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState([])
  const [status, setStatus] = useState(task?.status)
  const [savingStatus, setSavingStatus] = useState(false)

  const assigneeId = useMemo(() => task?.assigneeIds?.[0], [task])
  const assignee = getMember(assigneeId)
  const doneCount = subtasks.filter((s) => s.done).length

  if (!task) return null

  const toggleSubtask = (id) => {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)))
  }

  const addSubtask = (label) => {
    if (!label.trim()) return
    setSubtasks((prev) => [...prev, { id: `s${Date.now()}`, label: label.trim(), done: false }])
  }

  const submitComment = (e) => {
    e.preventDefault()
    if (!comment.trim()) return
    setComments((prev) => [
      ...prev,
      { id: `c${Date.now()}`, authorName: profile?.fullName || username, text: comment.trim(), time: 'Just now' },
    ])
    setComment('')
  }

  const handleStatusChange = async (nextStatus) => {
    const previous = status
    setStatus(nextStatus)
    setSavingStatus(true)
    try {
      await setTaskStatus(task, nextStatus)
      onChange?.()
    } catch {
      setStatus(previous)
    } finally {
      setSavingStatus(false)
    }
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
          <h2 className="mb-3.5 text-xl font-bold tracking-[-0.015em]">{task.title}</h2>

          <div className="mb-5 flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={savingStatus}
              className="bg-subtle border-border h-8 rounded-full border px-2.5 text-[11.5px] font-semibold outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {humanizeEnum(s)}
                </option>
              ))}
            </select>
            <Badge tone={task.priority}>{humanizeEnum(task.priority)}</Badge>
          </div>

          <div className="bg-subtle border-border mb-[22px] grid grid-cols-2 gap-4 rounded-md border p-4 max-sm:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                <CalendarDays size={14} /> Due date
              </span>
              <span className="text-ink text-[13px] font-semibold">{formatDate(task.dueDate)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                <FolderKanban size={14} /> Project
              </span>
              <span className="text-ink text-[13px] font-semibold">{task.project?.name}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-faint inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                <Flag size={14} /> Priority
              </span>
              <span className="text-ink text-[13px] font-semibold">{humanizeEnum(task.priority)}</span>
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
              {task.description || 'No description provided.'}
            </p>
          </div>

          <div className="mb-[22px]">
            <div className="mb-2.5 flex items-center justify-between">
              <h4 className="text-[13px] font-[650]">Subtasks</h4>
              <span className="text-faint text-[11.5px] font-semibold">
                {doneCount}/{subtasks.length}
              </span>
            </div>
            <p className="text-faint mb-2 text-[11.5px]">
              Local checklist for this session — there's no subtask storage on the server yet.
            </p>
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
            <form
              className="mt-1 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const input = e.currentTarget.elements.namedItem('subtask')
                addSubtask(input.value)
                input.value = ''
              }}
            >
              <input
                name="subtask"
                type="text"
                placeholder="Add a subtask..."
                className="bg-subtle border-border focus:border-lavender h-9 flex-1 rounded-md border px-3 text-[12.5px] outline-none"
              />
              <button type="submit" className="btn btn-secondary px-3 py-2 text-[12px]">
                Add
              </button>
            </form>
          </div>

          <div className="mb-[22px]">
            <h4 className="mb-2.5 text-[13px] font-[650]">Comments</h4>
            {comments.length === 0 && (
              <p className="text-faint text-[12.5px]">No comments yet.</p>
            )}
            <div className="flex flex-col gap-3.5">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar initials={initialsFor(c.authorName)} color="var(--accent-purple)" size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-[3px] flex items-baseline gap-2">
                      <span className="text-[12.5px] font-[650]">{c.authorName}</span>
                      <span className="text-faint text-[11px]">{c.time}</span>
                    </div>
                    <p className="text-muted text-[12.5px] leading-normal">{c.text}</p>
                  </div>
                </div>
              ))}
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
        </form>
      </aside>
    </div>
  )
}
