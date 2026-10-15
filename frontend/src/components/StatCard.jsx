import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { ProgressBar } from './ui/ProgressBar'

// The tint of the icon chip: the same soft-background / ink pairs the badges use.
const ICON_TONES = {
  neutral: 'bg-subtle text-muted',
  info: 'bg-info-soft text-info-ink',
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
}

// A figure with its label. Optional extras (all left out by the Reports page): `icon` (a chip beside the number),
// `hint` (one line of context under it) and `progress` (a thin 0-100 bar). A `danger` card only turns red while its
// number is above zero.
export function StatCard({ label, value, delta, tone, hint, icon: Icon, progress }) {
  const isDown = delta?.trim().startsWith('-')
  const alarming = tone === 'danger' && Number(value) > 0
  const chipTone = tone === 'danger' && !alarming ? 'neutral' : (tone ?? 'neutral')

  return (
    <div className="card flex flex-col gap-2 px-5 py-[18px] max-[640px]:gap-1 max-[640px]:px-4 max-[640px]:py-3.5">
      <span className="text-muted text-[12px] font-medium">{label}</span>
      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-[26px] font-bold tracking-[-0.02em] tabular-nums ${alarming ? 'text-danger-ink' : 'text-ink'}`}
        >
          {value}
        </span>
        {Icon && (
          <span
            aria-hidden="true"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full max-[640px]:h-8 max-[640px]:w-8 ${ICON_TONES[chipTone] ?? ICON_TONES.neutral}`}
          >
            <Icon size={17} />
          </span>
        )}
      </div>
      {progress != null && <ProgressBar percent={Number(progress)} height={6} />}
      {hint && <span className="text-faint text-[12px] leading-snug">{hint}</span>}
      {delta && (
        <span
          className={`inline-flex w-fit items-center gap-[3px] text-[12px] font-semibold ${
            isDown ? 'text-danger-ink' : 'text-success-ink'
          }`}
        >
          {isDown ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
          {delta}
        </span>
      )}
    </div>
  )
}
