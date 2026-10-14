import { useEffect } from 'react'
import { Flag, ChevronRight, Plus, X } from 'lucide-react'
import { Badge } from './ui/Badge'
import { humanizeEnum } from '../api/format'

// The calendar's day drawer, in two parts on the right of the screen:
//   - the list of what is due on that day (milestones first, then tasks), with "New task on this day" under it;
//   - beside it, the detail of the item chosen in the list (the task pane or the milestone pane), so the list stays
//     in view while one item is read or edited.
// Opening a day never changes anything, so everyone who can see the calendar can use it. On a phone or a narrow
// window the two parts do not fit side by side: the detail takes the place of the list, and its X brings the list back.
//
//   date       the day (a Date)
//   events     the calendar's items for that day: { kind: 'task' | 'milestone', id, title, projectName, status, dot, done }
//   selected   { kind, id } of the chosen item (or null), highlighted in the list
//   detail     the node shown in the second part (null when nothing is chosen)
//   canAdd     may the caller create a task somewhere (shows the "New task" button)
export function CalendarDayPanel({ date, events, selected, detail, canAdd, onSelect, onAddTask, onClose }) {
  const title = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const milestones = events.filter((e) => e.kind === 'milestone')
  const tasks = events.filter((e) => e.kind === 'task')

  // Escape closes the drawer, unless the person is typing in a field (a comment, the status list) or an overlay
  // such as the edit form is open on top of it.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      const tag = globalThis.document.activeElement?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (globalThis.document.querySelector('[data-overlay="modal"]')) return
      onClose()
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [onClose])

  const row = (ev) => {
    const chosen = selected?.kind === ev.kind && selected?.id === ev.id
    return (
      <button
        key={`${ev.kind}-${ev.id}`}
        type="button"
        data-testid="calendar-day-item"
        aria-current={chosen ? 'true' : undefined}
        onClick={() => onSelect(ev)}
        className={`hover:bg-subtle flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
          chosen ? 'bg-subtle' : ''
        }`}
      >
        {ev.kind === 'milestone' ? (
          <Flag size={15} className="text-faint shrink-0" aria-hidden="true" />
        ) : (
          <span className={`h-2 w-2 shrink-0 rounded-full ${ev.dot}`} aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <span className={`text-ink block truncate text-[13px] font-semibold ${ev.done ? 'line-through opacity-60' : ''}`}>
            {ev.kind === 'milestone' && <span className="sr-only">Milestone: </span>}
            {ev.title}
          </span>
          {ev.projectName && <span className="text-faint block truncate text-[12px]">{ev.projectName}</span>}
        </span>
        {ev.status && <Badge tone={ev.status}>{humanizeEnum(ev.status)}</Badge>}
        <ChevronRight size={15} className="text-faint shrink-0" aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-[60] flex justify-end bg-scrim" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="calendar-drawer"
        className="animate-slide-in bg-card shadow-pop flex h-full max-w-[100vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <section
          aria-label="Due this day"
          data-testid="calendar-day-panel"
          className={`flex h-full w-[400px] max-w-[100vw] shrink-0 flex-col ${
            detail ? 'max-[1000px]:hidden' : 'max-sm:w-[100vw]'
          }`}
        >
          <div className="border-divider flex items-center justify-between gap-3 border-b px-[22px] py-[18px]">
            <h3 className="text-ink text-[15px] font-[650]">{title}</h3>
            <button type="button" className="icon-btn shrink-0" onClick={onClose} aria-label="Close panel">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pt-4 pb-6">
            {events.length === 0 && <p className="text-faint px-3 py-2 text-[13px]">Nothing is due on this day.</p>}

            {milestones.length > 0 && (
              <section aria-label="Milestones" className="mb-3">
                <h4 className="text-muted px-3 pb-1 text-[12px] font-semibold">Milestones ({milestones.length})</h4>
                {milestones.map(row)}
              </section>
            )}
            {tasks.length > 0 && (
              <section aria-label="Tasks">
                <h4 className="text-muted px-3 pb-1 text-[12px] font-semibold">Tasks ({tasks.length})</h4>
                {tasks.map(row)}
              </section>
            )}
          </div>

          {canAdd && (
            <div className="border-divider flex justify-end border-t px-[22px] py-4">
              <button type="button" className="btn btn-primary" onClick={onAddTask}>
                <Plus size={16} /> New task on this day
              </button>
            </div>
          )}
        </section>

        {detail && (
          <section
            aria-label="Details"
            data-testid="calendar-detail-pane"
            className="border-divider h-full w-[480px] max-w-[100vw] min-[1001px]:border-l max-[1000px]:w-[100vw]"
          >
            {detail}
          </section>
        )}
      </div>
    </div>
  )
}
