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
//   compact  drops the hour columns (the dashboard card)
export function WorkloadTable({ workload, compact = false }) {
  const members = workload?.members ?? []
  if (members.length === 0) {
    return <p className="text-faint text-[12px]">No team members to compare.</p>
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
                <td className="px-2 py-2.5 text-right">{m.assigned}</td>
                <td className="px-2 py-2.5 text-right">{m.active}</td>
                <td className={`px-2 py-2.5 text-right ${m.overdue > 0 ? 'text-danger-ink font-semibold' : ''}`}>
                  {m.overdue}
                </td>
                {!compact && <td className="px-2 py-2.5 text-right">{hours(m.estimatedHours)}</td>}
                {!compact && <td className="px-2 py-2.5 text-right">{hours(m.actualHours)}</td>}
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
      <p className="text-faint mt-2 text-[12px]">
        Team average: {Number(workload.averageOpenTasks ?? 0).toFixed(1)} open tasks (active + overdue),{' '}
        {hours(workload.averageEstimatedHours)} estimated hours. “Overloaded” and “underloaded” are measured against
        this average.
      </p>
    </div>
  )
}
