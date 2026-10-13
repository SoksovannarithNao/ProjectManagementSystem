import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRightLeft } from 'lucide-react'
import { KANBAN_MOVE_TARGETS, KANBAN_STATUS_LABELS, checkTaskMove } from '../api/tasks'

const MENU_WIDTH = 220
const MENU_HEIGHT = 230

// Where the menu goes for a button at `rect`: its right edge under the button's right edge, and
// above the button when there is no room below.
function placeFor(rect) {
  const below = rect.bottom + 6 + MENU_HEIGHT <= window.innerHeight
  return {
    right: Math.max(8, window.innerWidth - rect.right),
    ...(below ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }),
  }
}

// The "Move to" button on a Kanban card: the way to move a card without dragging (keyboard,
// touch). It lists the four columns a card can go to; one the rules refuse is disabled and
// says why. The menu is drawn in a portal at a fixed position, because the column it opens
// from scrolls and would clip it. `abilities` is { canChange, canApprove } for this task.
export function KanbanMoveMenu({ task, label, abilities, onMove, disabled = false }) {
  const [place, setPlace] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!place) return undefined
    const close = () => setPlace(null)
    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return
      close()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close()
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    // The menu is fixed to the screen, so when something that holds the button scrolls (the
    // column, the board or the page) or the window is resized it follows the button, and closes
    // only when the button has left the screen.
    const follow = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
        close()
      } else {
        setPlace(placeFor(rect))
      }
    }
    const onScroll = (e) => {
      const target = e.target
      if (target === document || target === window || target?.contains?.(buttonRef.current)) follow()
    }
    window.addEventListener('resize', follow)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', follow)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [place])

  const toggle = () => {
    if (place) {
      setPlace(null)
      return
    }
    setPlace(placeFor(buttonRef.current.getBoundingClientRect()))
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn !h-7 !w-7"
        aria-label={`Move "${label}" to another column`}
        aria-haspopup="menu"
        aria-expanded={Boolean(place)}
        disabled={disabled}
        onClick={toggle}
      >
        <ArrowRightLeft size={14} />
      </button>
      {place &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Move to"
            className="animate-scale-in bg-card border-border shadow-pop fixed z-[90] flex flex-col gap-0.5 rounded-md border p-2"
            style={{ ...place, width: MENU_WIDTH }}
          >
            <span className="text-faint px-2 pt-1 pb-1.5 text-[12px] font-[650] tracking-[0.04em] uppercase">Move to</span>
            {KANBAN_MOVE_TARGETS.map((target) => {
              const check = checkTaskMove(task, target, abilities)
              return (
                <button
                  key={target}
                  type="button"
                  role="menuitem"
                  disabled={!check.ok}
                  className="hover:bg-subtle flex flex-col items-start rounded-sm px-2 py-1.5 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                  onClick={() => {
                    setPlace(null)
                    onMove(target)
                  }}
                >
                  <span className="text-ink font-medium">
                    {KANBAN_STATUS_LABELS[target]}
                    {task.status === target && <span className="text-faint font-normal"> (current)</span>}
                  </span>
                  {!check.ok && check.message && <span className="text-faint text-[11px] leading-snug">{check.message}</span>}
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </>
  )
}
