import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { TopBar } from '../layout/TopBar'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const VIEWS = ['Month', 'Week', 'Day']

const eventTones = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
}

const eventClass = (tone) =>
  `truncate rounded-[5px] px-1.5 py-[3px] text-[10.5px] font-semibold max-[900px]:text-[9.5px] ${eventTones[tone] ?? eventTones.info}`

const sampleEvents = {
  3: [{ title: 'Design settings page', tone: 'success' }],
  5: [{ title: 'Sprint planning', tone: 'info' }],
  10: [{ title: 'Fix login redirect bug', tone: 'danger' }],
  14: [{ title: 'Usability testing', tone: 'warning' }, { title: 'Team sync', tone: 'info' }],
  19: [{ title: 'Migrate user table', tone: 'danger' }],
  22: [{ title: 'Client review', tone: 'info' }],
  27: [{ title: 'Release v2.1', tone: 'success' }],
}

function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7 // Monday = 0
  const start = new Date(year, month, 1 - startOffset)
  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}

export function Calendar() {
  const [cursor, setCursor] = useState(new Date(2026, 7, 1))
  const [view, setView] = useState('Month')
  const today = new Date(2026, 7, 31)

  const days = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor])

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const shiftMonth = (delta) => {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  return (
    <div>
      <TopBar
        title="Calendar"
        subtitle="Plan and track deadlines across your projects"
        actions={
          <button className="btn btn-primary">
            <Plus size={16} /> New Event
          </button>
        }
      />

      <div className="card px-[22px] pt-5 pb-6">
        <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex items-center gap-2.5">
            <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[148px] text-center text-[15px] font-[650]">{monthLabel}</span>
            <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
            <button
              className="btn btn-secondary ml-1 px-3.5 py-2"
              onClick={() => setCursor(new Date(2026, 7, 1))}
            >
              Today
            </button>
          </div>
          <div className="bg-subtle border-border flex gap-0.5 rounded-md border p-[3px]">
            {VIEWS.map((v) => (
              <button
                key={v}
                className={`duration-[var(--duration-fast)] ease-[var(--ease-standard)] rounded-sm border-none px-3.5 py-[7px] text-[12.5px] font-semibold transition-colors ${
                  view === v ? 'bg-charcoal text-white' : 'bg-transparent text-muted'
                }`}
                onClick={() => setView(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {view === 'Month' && (
          <>
            <div className="grid grid-cols-7 px-0.5 pb-2">
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className="text-faint text-center text-[11.5px] font-[650] tracking-[0.03em] uppercase max-[900px]:text-[10px]"
                >
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5 max-[640px]:gap-[3px]">
              {days.map((d, i) => {
                const inMonth = d.getMonth() === cursor.getMonth()
                const events = inMonth ? sampleEvents[d.getDate()] : null
                const isToday = isSameDay(d, today)
                return (
                  <div
                    key={i}
                    className={`duration-[var(--duration-fast)] ease-[var(--ease-standard)] flex min-h-24 flex-col gap-1.5 rounded-sm border p-2 transition-colors max-[900px]:min-h-[68px] max-[900px]:p-1.5 ${
                      inMonth ? 'bg-card hover:bg-subtle' : 'bg-subtle'
                    } ${isToday ? 'border-charcoal' : 'border-divider'}`}
                  >
                    <span
                      className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-xs font-[650] ${
                        isToday ? 'bg-charcoal text-white' : !inMonth ? 'text-faint' : ''
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    <div className={`flex flex-col gap-[3px] ${isToday ? '' : 'max-[640px]:hidden'}`}>
                      {events?.map((ev, idx) => (
                        <span key={idx} className={eventClass(ev.tone)}>
                          {ev.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {view !== 'Month' && (
          <div className="flex flex-col">
            {Object.entries(sampleEvents).slice(0, view === 'Day' ? 1 : 5).map(([date, events]) => (
              <div
                key={date}
                className="border-divider flex items-center gap-5 border-b px-1 py-3.5 last:border-b-0"
              >
                <span className="w-[70px] shrink-0 text-[13px] font-[650]">Aug {date}</span>
                <div className="flex flex-wrap gap-2">
                  {events.map((ev, idx) => (
                    <span key={idx} className={eventClass(ev.tone)}>
                      {ev.title}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
