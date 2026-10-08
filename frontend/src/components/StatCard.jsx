import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

export function StatCard({ label, value, delta, tone }) {
  const isDown = delta?.trim().startsWith('-')

  return (
    <div className="card flex flex-col gap-2 px-5 py-[18px]">
      <span className="text-muted text-[12px] font-medium">{label}</span>
      <span
        className={`text-[26px] font-bold tracking-[-0.02em] ${
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
