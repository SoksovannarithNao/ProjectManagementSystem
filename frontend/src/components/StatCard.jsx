import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

export function StatCard({ label, value, delta, tone }) {
  const isDown = delta?.trim().startsWith('-')

  return (
    <div className="card flex flex-col gap-2 px-5 py-[18px] max-[640px]:gap-1 max-[640px]:px-4 max-[640px]:py-3.5">
      <span className="text-muted text-[12px] font-medium">{label}</span>
      <span
        className={`text-[26px] font-bold tracking-[-0.02em] tabular-nums ${
          tone === 'danger' && Number(value) > 0 ? 'text-danger-ink' : 'text-ink'
        }`}
      >
        {value}
      </span>
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
