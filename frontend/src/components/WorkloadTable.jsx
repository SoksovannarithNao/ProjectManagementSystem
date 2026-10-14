import { Avatar } from './ui/Avatar'
import { initialsFor, colorForId } from '../api/format'

const LEVEL = {
  OVERLOADED: { label: 'Overloaded', className: 'bg-danger-soft text-danger-ink' },
  UNDERLOADED: { label: 'Underloaded', className: 'bg-info-soft text-info-ink' },
  BALANCED: { label: 'Balanced', className: 'bg-subtle text-muted' },
}

const hours = (value) => {
  const n = Number(value ?? 0)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

// Per-member workload (assignment-brief.md D-13): assigned, active and overdue
// tasks, estimated and actual hours, and whether the person carries clearly
// more or less than the team average. All numbers come from the server.
//   compact  the dashboard card: one row per person (name, a line of counts, the Load pill) instead of
//            a table, because the card sits in a 380px column; the hour columns are left out
export function WorkloadTable({ workload, compact = false }) {
  const members = workload?.members ?? []
  if (members.length === 0) {
    return <p className="text-faint text-[12px]">No team members to compare.</p>
  }
  const footnote = (
    <p className="text-faint mt-2 text-[12px]">
      Team average: {Number(workload.averageOpenTasks ?? 0).toFixed(1)} open tasks (active + overdue),{' '}
      {hours(workload.averageEstimatedHours)} estimated hours. “Overloaded” and “underloaded” are measured against
      this average.
    </p>
  )
  if (compact) {
    return (
      <div data-testid="workload-table">
        {/* About eight people are visible; the rest scroll inside the card (focusable, so a keyboard can
            scroll it). The footnote stays below, outside the scrolling area. */}
        <ul className="scroll-y flex max-h-[400px] flex-col pr-1" tabIndex={0} aria-label="Workload by person">
          {members.map((m) => {
            const level = LEVEL[m.level] ?? LEVEL.BALANCED
            return (
              <li
                key={m.user.id}
                className="border-divider flex items-center gap-2.5 border-b py-2 first:pt-0 last:border-b-0"
                data-testid="workload-row"
              >
                <Avatar
                  initials={initialsFor(m.user.fullName)}
                  color={colorForId(m.user.id)}
                  photoUrl={m.user.profilePhotoUrl}
                  size={26}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-ink truncate text-[13px] leading-tight font-semibold">{m.user.fullName}</span>
                  <span className="text-faint mt-0.5 text-[12px] leading-tight tabular-nums">
                    <span className="whitespace-nowrap">{m.assigned} assigned</span> ·{' '}
                    <span className="whitespace-nowrap">{m.active} active</span> ·{' '}
                    <span className={`whitespace-nowrap ${m.overdue > 0 ? 'text-danger-ink font-semibold' : ''}`}>
                      {m.overdue} overdue
                    </span>
                  </span>
                </span>
                <span
                  data-level={m.level}
                  className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[12px] leading-none font-semibold ${level.className}`}
                >
                  {level.label}
                </span>
              </li>
            )
          })}
        </ul>
        {footnote}
      </div>
    )
  }
  return (
    <div className="overflow-x-auto" data-testid="workload-table">
      <table className="w-full min-w-[420px] text-left text-[13px]">
        <thead>
          <tr className="text-faint border-divider border-b text-[12px] font-semibold">
            <th className="py-2 pr-3 font-semibold">Member</th>
            <th className="px-2 py-2 text-right font-semibold">Assigned</th>
            <th className="px-2 py-2 text-right font-semibold">Active</th>
            <th className="px-2 py-2 text-right font-semibold">Overdue</th>
            {!compact && <th className="px-2 py-2 text-right font-semibold">Estimated h</th>}
            {!compact && <th className="px-2 py-2 text-right font-semibold">Actual h</th>}
            <th className="py-2 pl-3 font-semibold">Load</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const level = LEVEL[m.level] ?? LEVEL.BALANCED
            return (
              <tr key={m.user.id} className="border-divider border-b last:border-b-0" data-testid="workload-row">
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-2.5">
                    <Avatar
                      initials={initialsFor(m.user.fullName)}
                      color={colorForId(m.user.id)}
                      photoUrl={m.user.profilePhotoUrl}
                      size={26}
                    />
                    <span className="text-ink truncate font-semibold">{m.user.fullName}</span>
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">{m.assigned}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{m.active}</td>
                <td className={`px-2 py-2.5 text-right tabular-nums ${m.overdue > 0 ? 'text-danger-ink font-semibold' : ''}`}>
                  {m.overdue}
                </td>
                {!compact && <td className="px-2 py-2.5 text-right tabular-nums">{hours(m.estimatedHours)}</td>}
                {!compact && <td className="px-2 py-2.5 text-right tabular-nums">{hours(m.actualHours)}</td>}
                <td className="py-2.5 pl-3">
                  <span
                    data-level={m.level}
                    className={`inline-flex rounded-full px-2.5 py-1 text-[12px] leading-none font-semibold ${level.className}`}
                  >
                    {level.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {footnote}
    </div>
  )
}
