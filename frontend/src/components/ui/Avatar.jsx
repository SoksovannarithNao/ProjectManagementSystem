import { useMembers } from '../../data/UsersContext'

export function Avatar({ initials, color, size = 32, title, style, className = '' }) {
  return (
    <span
      className={`border-card text-ink inline-flex shrink-0 items-center justify-center rounded-full border-2 font-[650] tracking-[-0.02em] ${className}`}
      title={title}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.36),
        background: color || 'var(--accent-blue-gray)',
        ...style,
      }}
    >
      {initials}
    </span>
  )
}

export function AvatarGroup({ memberIds = [], size = 30, max = 3 }) {
  const { getMember } = useMembers()
  const shown = memberIds.slice(0, max)
  const extra = memberIds.length - shown.length
  return (
    <span className="inline-flex items-center">
      {shown.map((id, i) => {
        const m = getMember(id)
        if (!m) return null
        return (
          <Avatar
            key={id}
            initials={m.initials}
            color={m.color}
            size={size}
            title={m.name}
            className={i > 0 ? '-ml-2' : ''}
          />
        )
      })}
      {extra > 0 && (
        <span
          className="border-card bg-subtle text-muted -ml-2 inline-flex shrink-0 items-center justify-center rounded-full border-2 text-[10.5px] font-[650] tracking-[-0.02em]"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </span>
  )
}
