import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

const accentTones = {
  neutral: 'bg-charcoal',
  info: 'bg-info',
  success: 'bg-success',
  danger: 'bg-danger',
}

export function StatCard({ label, value, delta, tone = 'neutral' }) {
  const isDown = delta?.trim().startsWith('-')

  return (
    <div className="card relative flex flex-col gap-2 overflow-hidden px-5 py-[18px]">
      <span className="text-muted text-[12.5px] font-medium">{label}</span>
      <span className="text-ink text-[26px] font-bold tracking-[-0.02em]">{value}</span>
      {delta && (
        <span
          className={`inline-flex w-fit items-center gap-[3px] text-[11.5px] font-semibold ${
            isDown ? 'text-danger' : 'text-success'
          }`}
        >
          {isDown ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
          {delta}
        </span>
      )}
      <span
        className={`absolute top-0 right-0 left-0 h-[3px] ${accentTones[tone] ?? accentTones.neutral}`}
      />
    </div>
  )
}
