import { useState } from 'react'
import { useMembers } from '../../data/UsersContext'

// Initials sit on a swatch picked from the user id, so the text colour is
// picked from the swatch, not the theme: a light theme's dark ink is
// unreadable on the deep swatches and dark theme's light ink is unreadable on
// the pale ones.
function readableOn(color) {
  const m = /^#([0-9a-f]{6})$/i.exec(color || '')
  if (!m) return undefined
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.3 ? '#17191c' : '#ffffff'
}

// Renders the user's actual profile photo when one is set (and loads
// successfully); falls back to initials-on-a-color-swatch otherwise — same
// as before this had photo support at all.
// 26px is the smallest an avatar is drawn: two initials at the 12px text floor
// need that much room inside the ring.
const MIN_AVATAR = 26

export function Avatar({ initials, color, photoUrl, size: requestedSize = 32, title, style, className = '' }) {
  const size = Math.max(requestedSize, MIN_AVATAR)
  const [imgFailed, setImgFailed] = useState(false)
  const showPhoto = Boolean(photoUrl) && !imgFailed

  return (
    <span
      className={`border-card text-ink inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 font-[650] tracking-[-0.02em] ${className}`}
      title={title}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(12, size * 0.36),
        background: showPhoto ? undefined : color || 'var(--accent-blue-gray)',
        color: showPhoto ? undefined : readableOn(color),
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
          className="border-card bg-subtle text-muted -ml-2 inline-flex shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-[650] tracking-[-0.02em]"
          style={{ width: Math.max(size, MIN_AVATAR), height: Math.max(size, MIN_AVATAR) }}
        >
          +{extra}
        </span>
      )}
    </span>
  )
}
