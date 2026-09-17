import { useState } from 'react'
import { useMembers } from '../../data/UsersContext'

// Renders the user's actual profile photo when one is set (and loads
// successfully); falls back to initials-on-a-color-swatch otherwise — same
// as before this had photo support at all.
export function Avatar({ initials, color, photoUrl, size = 32, title, style, className = '' }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showPhoto = Boolean(photoUrl) && !imgFailed

  return (
    <span
      className={`border-card text-ink inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 font-[650] tracking-[-0.02em] ${className}`}
      title={title}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.36),
        background: showPhoto ? undefined : color || 'var(--accent-blue-gray)',
        ...style,
      }}
    >
      {showPhoto ? (
        <img
          src={photoUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        initials
      )}
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
            photoUrl={m.photoUrl}
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
