import { useEffect, useRef, useState } from 'react'

// Generic popover: `button` renders the trigger (receives {open, toggle}),
// `children` renders the panel content (receives {close}). Closes on an
// outside click or Escape — the two standard ways a dropdown gets dismissed.
export function Dropdown({ button, align = 'left', panelClassName = '', children }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="relative inline-block" ref={rootRef}>
      {button({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          className={`animate-scale-in bg-card border-border shadow-pop absolute z-50 mt-2 min-w-[210px] rounded-md border p-2 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${panelClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  )
}
