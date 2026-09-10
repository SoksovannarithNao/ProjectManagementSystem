export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={28} strokeWidth={1.5} />}
      <span className="text-muted text-[13px] font-semibold">{title}</span>
      {subtitle && <span className="text-faint text-[12px]">{subtitle}</span>}
    </div>
  )
}
