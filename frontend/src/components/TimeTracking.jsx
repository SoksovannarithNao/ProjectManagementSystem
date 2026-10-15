import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Play, Square, Trash2, AlertTriangle, Clock, Pencil } from 'lucide-react'
import { ProgressBar } from './ui/ProgressBar'
import { useToast } from './ui/Toast'
import { useApi } from '../api/useApi'
import { getWorkLogsByTask, createWorkLog, updateWorkLog, deleteWorkLog } from '../api/workLogs'
import { parseDuration, formatHours, formatClock, localDateString } from '../api/duration'
import { formatDate } from '../api/format'

const TIMER_KEY = (userId) => `taskflow.timer.${userId}`

// One running timer per user, kept in localStorage so it survives a refresh
// or closing the panel. Storage can be blocked, so every access is guarded;
// without it the timer simply doesn't persist.
function readTimer(userId) {
  try {
    const raw = localStorage.getItem(TIMER_KEY(userId))
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && parsed.taskId && parsed.startedAt ? parsed : null
  } catch {
    return null
  }
}

function writeTimer(userId, timer) {
  try {
    if (timer) localStorage.setItem(TIMER_KEY(userId), JSON.stringify(timer))
    else localStorage.removeItem(TIMER_KEY(userId))
  } catch {
    // Storage unavailable — the timer still runs for this session.
  }
}

const MAX_ENTRY_HOURS = 24

// Estimated vs. actual time for one task (Role_Requirment.md "Time Tracking
// & Work Logs"): a summary bar, a start/stop timer, a manual entry form and
// the list of entries. `locked` (a completed task or project) hides the timer and the form for a new entry;
// existing entries stay editable. `canLog` is the same OWNER/ADMIN/MEMBER rule the
// backend enforces; `canManage` lets a project manager delete anyone's entry.
// Only the author changes an entry (the pencil on their own rows).
export function TimeTracking({ task, canLog, locked = false, canManage, currentUserId, onChange }) {
  const notify = useToast()
  const logsFetcher = useCallback(() => getWorkLogsByTask(task.id), [task.id])
  const { data: logsData, loading, error: loadError, refetch } = useApi(logsFetcher)
  const logs = useMemo(() => logsData ?? [], [logsData])

  const [timer, setTimer] = useState(() => readTimer(currentUserId))
  const [now, setNow] = useState(() => Date.now())
  const [today] = useState(() => localDateString())
  const [duration, setDuration] = useState('')
  const [workDate, setWorkDate] = useState(today)
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  // The entry being changed: { id, duration, workDate, note, error, saving }.
  const [editing, setEditing] = useState(null)
  const durationRef = useRef(null)

  const timerOnThisTask = timer?.taskId === task.id
  const timerElsewhere = timer && !timerOnThisTask

  useEffect(() => {
    if (!timer) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [timer])

  // Summary numbers come from the fetched logs when available so the bar
  // moves the instant an entry is saved; the task's own actualHours is the
  // fallback until they load.
  const actual = loading && logsData == null ? Number(task.actualHours) || 0 : logs.reduce((sum, l) => sum + Number(l.hoursWorked), 0)
  const estimate = Number(task.estimatedHours) || 0
  const hasEstimate = estimate > 0
  const over = hasEstimate && actual > estimate
  const percent = hasEstimate ? Math.min(100, (actual / estimate) * 100) : 0

  const startTimer = () => {
    if (timerElsewhere) {
      notify(`A timer is already running on “${timer.title}”. Stop it first.`, { tone: 'error' })
      return
    }
    const next = { taskId: task.id, title: task.title, startedAt: Date.now() }
    writeTimer(currentUserId, next)
    setNow(next.startedAt)
    setTimer(next)
  }

  // A timer that was already running when its task was completed cannot be logged any more: it can only be dropped.
  const discardTimer = () => {
    writeTimer(currentUserId, null)
    setTimer(null)
  }

  const stopTimer = () => {
    const elapsedHours = (Date.now() - timer.startedAt) / 3_600_000
    writeTimer(currentUserId, null)
    setTimer(null)
    if (elapsedHours < 0.01) {
      notify('Timer stopped — under a minute, so nothing to log.')
      return
    }
    const capped = Math.min(elapsedHours, MAX_ENTRY_HOURS)
    if (elapsedHours > MAX_ENTRY_HOURS) {
      notify('The timer ran over 24 hours — adjust the time before saving.', { tone: 'error' })
    }
    // Hand the result to the form rather than saving blindly: the person
    // confirms (or trims) the time and can add a note.
    setDuration(formatHours(Math.round(capped * 100) / 100))
    setWorkDate(localDateString(new Date(timer.startedAt)))
    setFormError('')
    setTimeout(() => durationRef.current?.focus(), 0)
  }

  const submit = async (e) => {
    e.preventDefault()
    const hours = parseDuration(duration)
    if (hours == null || hours <= 0) {
      setFormError('Enter a time like 1.5, 1h 30m or 45m.')
      return
    }
    if (hours > MAX_ENTRY_HOURS) {
      setFormError('A single entry cannot exceed 24 hours.')
      return
    }
    if (workDate > today) {
      setFormError('The date cannot be in the future.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await createWorkLog({
        taskId: task.id,
        workDate,
        hoursWorked: hours,
        description: note.trim() || null,
      })
      setDuration('')
      setNote('')
      setWorkDate(today)
      refetch()
      onChange?.()
      notify(`Logged ${formatHours(hours)}.`)
    } catch (err) {
      setFormError(err.message || 'Could not save the time entry.')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (log) => {
    setPendingDelete(null)
    setEditing({
      id: log.id,
      duration: formatHours(Number(log.hoursWorked)),
      workDate: log.workDate,
      note: log.description ?? '',
      error: '',
      saving: false,
    })
  }

  const patchEditing = (changes) => setEditing((prev) => (prev ? { ...prev, ...changes } : prev))

  const saveEdit = async (e) => {
    e.preventDefault()
    const hours = parseDuration(editing.duration)
    if (hours == null || hours <= 0) {
      patchEditing({ error: 'Enter a time like 1.5, 1h 30m or 45m.' })
      return
    }
    if (hours > MAX_ENTRY_HOURS) {
      patchEditing({ error: 'A single entry cannot exceed 24 hours.' })
      return
    }
    if (!editing.workDate || editing.workDate > today) {
      patchEditing({ error: 'The date cannot be in the future.' })
      return
    }
    patchEditing({ saving: true, error: '' })
    try {
      await updateWorkLog(editing.id, {
        taskId: task.id,
        workDate: editing.workDate,
        hoursWorked: hours,
        description: editing.note.trim() || null,
      })
      setEditing(null)
      refetch()
      onChange?.()
      notify('Time entry updated.')
    } catch (err) {
      patchEditing({ saving: false, error: err.message || 'Could not save the time entry.' })
    }
  }

  const confirmDelete = async () => {
    const log = pendingDelete
    setPendingDelete(null)
    try {
      await deleteWorkLog(log.id)
      refetch()
      onChange?.()
    } catch (err) {
      notify(err.message || 'Failed to delete the time entry', { tone: 'error' })
    }
  }

  return (
    <div className="mb-[22px]">
      <h4 className="mb-2.5 text-[13px] font-[650]">Time tracking</h4>

      <div className="bg-subtle rounded-md px-3.5 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-ink text-[15px] font-[650]">
            {formatHours(actual)} <span className="text-muted text-[12px] font-medium">logged</span>
          </span>
          <span className="text-muted text-[12px]">
            {hasEstimate ? `of ${formatHours(estimate)} estimated` : 'No estimate set'}
          </span>
        </div>
        {hasEstimate && (
          <>
            <div className="mt-2" role="img" aria-label={`${Math.round(percent)}% of the estimate used`}>
              <ProgressBar percent={percent} color={over ? 'var(--color-danger)' : undefined} height={6} />
            </div>
            <p className={`mt-1.5 text-[12px] ${over ? 'text-danger-ink font-semibold' : 'text-muted'}`}>
              {over ? (
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle size={12} /> {formatHours(actual - estimate)} over the estimate
                </span>
              ) : (
                `${formatHours(estimate - actual)} left`
              )}
            </p>
          </>
        )}
        {!hasEstimate && canManage && (
          <p className="text-muted mt-1.5 text-[12px]">Edit the task to add an estimate and see progress against it.</p>
        )}
      </div>

      {canLog && locked && timerOnThisTask && (
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <span className="text-muted text-[12px]">A timer was running on this task, but it is completed, so its time cannot be logged.</span>
          <button type="button" className="btn btn-secondary" onClick={discardTimer}>
            Discard timer
          </button>
        </div>
      )}

      {canLog && !locked && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {timerOnThisTask ? (
              <button type="button" className="btn btn-primary" onClick={stopTimer}>
                <Square size={14} /> Stop · <span className="tabular-nums">{formatClock(now - timer.startedAt)}</span>
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={startTimer} disabled={Boolean(timerElsewhere)}>
                <Play size={14} /> Start timer
              </button>
            )}
            {timerElsewhere && (
              <span className="text-muted text-[12px]">A timer is running on “{timer.title}”.</span>
            )}
          </div>

          <form onSubmit={submit} className="mt-3 flex flex-col gap-2.5" noValidate>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-muted text-[12px] font-semibold">Time spent</span>
                <input
                  ref={durationRef}
                  type="text"
                  inputMode="decimal"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="1h 30m"
                  className="field field-sm w-full"
                  autoComplete="off"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-muted text-[12px] font-semibold">Date</span>
                <input
                  type="date"
                  value={workDate}
                  max={today}
                  onChange={(e) => setWorkDate(e.target.value)}
                  className="field field-sm w-full"
                  required
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-muted text-[12px] font-semibold">What did you work on? (optional)</span>
              <input
                type="text"
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                className="field field-sm w-full"
                autoComplete="off"
              />
            </label>
            {formError && <p className="text-danger-ink text-[12px] font-semibold">{formError}</p>}
            <div className="flex items-center justify-between gap-3">
              <span className="text-faint text-[12px]">Hours by default. m = minutes, d = 8-hour day.</span>
              <button type="submit" className="btn btn-secondary shrink-0" disabled={saving || !duration.trim()}>
                {saving ? 'Saving…' : 'Log time'}
              </button>
            </div>
          </form>
        </>
      )}

      {loadError && <p className="text-danger-ink mt-3 text-[12px] font-semibold">Could not load time entries.</p>}

      {logs.length > 0 && (
        <ul className="mt-3 flex flex-col" aria-label="Time entries">
          {logs.map((log) => {
            const mine = log.userId === currentUserId
            const canDelete = mine || canManage
            const canEdit = mine && canLog
            if (editing?.id === log.id) {
              return (
                <li key={log.id} className="border-divider border-b py-2.5 last:border-b-0">
                  <form onSubmit={saveEdit} className="flex flex-col gap-2.5" noValidate aria-label="Change time entry">
                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-muted text-[12px] font-semibold">Time spent</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editing.duration}
                          onChange={(e) => patchEditing({ duration: e.target.value })}
                          className="field field-sm w-full"
                          autoComplete="off"
                          autoFocus
                        />
                      </label>
                      <label className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-muted text-[12px] font-semibold">Date</span>
                        <input
                          type="date"
                          value={editing.workDate}
                          max={today}
                          onChange={(e) => patchEditing({ workDate: e.target.value })}
                          className="field field-sm w-full"
                          required
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-muted text-[12px] font-semibold">Note (optional)</span>
                      <input
                        type="text"
                        value={editing.note}
                        maxLength={500}
                        onChange={(e) => patchEditing({ note: e.target.value })}
                        className="field field-sm w-full"
                        autoComplete="off"
                      />
                    </label>
                    {editing.error && <p className="text-danger-ink text-[12px] font-semibold">{editing.error}</p>}
                    <div className="flex items-center justify-end gap-3 text-[12px]">
                      <button type="button" className="text-muted font-semibold" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-secondary shrink-0" disabled={editing.saving || !editing.duration.trim()}>
                        {editing.saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </form>
                </li>
              )
            }
            return (
              <li key={log.id} className="border-divider flex items-start gap-3 border-b py-2.5 last:border-b-0">
                <Clock size={14} className="text-faint mt-0.5 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-ink text-[13px] font-semibold">
                    {formatHours(Number(log.hoursWorked))}
                    <span className="text-muted ml-2 text-[12px] font-normal">
                      {mine ? 'You' : log.authorName} · {formatDate(log.workDate)}
                    </span>
                  </p>
                  {log.description && <p className="text-muted mt-0.5 text-[12px] break-words">{log.description}</p>}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    className="hit-area text-faint hover:text-ink shrink-0 p-1"
                    aria-label={`Change ${formatHours(Number(log.hoursWorked))} entry from ${formatDate(log.workDate)}`}
                    onClick={() => startEdit(log)}
                  >
                    <Pencil size={14} />
                  </button>
                )}
                {canDelete &&
                  (pendingDelete?.id === log.id ? (
                    <span className="flex shrink-0 items-center gap-2 text-[12px]">
                      <button type="button" className="text-danger-ink font-semibold" onClick={confirmDelete}>
                        Delete
                      </button>
                      <button type="button" className="text-muted font-semibold" onClick={() => setPendingDelete(null)}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="hit-area text-faint hover:text-danger-ink shrink-0 p-1"
                      aria-label={`Delete ${formatHours(Number(log.hoursWorked))} entry from ${formatDate(log.workDate)}`}
                      onClick={() => setPendingDelete(log)}
                    >
                      <Trash2 size={14} />
                    </button>
                  ))}
              </li>
            )
          })}
        </ul>
      )}
      {!loading && logs.length === 0 && !loadError && (
        <p className="text-faint mt-3 text-[12px]">No time logged yet.</p>
      )}
    </div>
  )
}
