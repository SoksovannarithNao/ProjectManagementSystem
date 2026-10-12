import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { useAuth } from './AuthContext'
import {
  IDLE_LIMIT_MS,
  IDLE_WARNING_MS,
  readSharedActivity,
  rememberIdleSignOut,
  writeSharedActivity,
} from './idleTimeout'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart']

// Signs the user out after a period of inactivity, with a countdown dialog first.
// Mounted once inside the signed-in layout, so the public pages never run it.
//
// Activity (mouse, keyboard, scroll, touch) in this or any other tab restarts the
// clock. While the warning is showing, only its own button counts: otherwise a
// stray mouse movement would make the dialog vanish before it could be read.
export function IdleLogout() {
  const { logout } = useAuth()
  const lastActive = useRef(0) // set when the effect below starts
  const lastShared = useRef(0)
  const warning = useRef(false)
  const [secondsLeft, setSecondsLeft] = useState(null)

  const markActive = useCallback(() => {
    const now = Date.now()
    lastActive.current = now
    // Shared with the other tabs, but not on every mouse move.
    if (now - lastShared.current > 5000) {
      lastShared.current = now
      writeSharedActivity(now)
    }
  }, [])

  const signOutForInactivity = useCallback(() => {
    rememberIdleSignOut()
    logout()
  }, [logout])

  useEffect(() => {
    const onActivity = () => {
      if (!warning.current) markActive()
    }
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }))
    markActive()

    const tick = () => {
      const idle = Date.now() - Math.max(lastActive.current, readSharedActivity())
      if (idle >= IDLE_LIMIT_MS + IDLE_WARNING_MS) {
        signOutForInactivity()
      } else if (idle >= IDLE_LIMIT_MS) {
        warning.current = true
        setSecondsLeft(Math.ceil((IDLE_LIMIT_MS + IDLE_WARNING_MS - idle) / 1000))
      } else if (warning.current) {
        // Activity in another tab ended the warning.
        warning.current = false
        setSecondsLeft(null)
      }
    }
    const timer = setInterval(tick, 1000)

    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity))
      clearInterval(timer)
    }
  }, [markActive, signOutForInactivity])

  const stay = () => {
    warning.current = false
    setSecondsLeft(null)
    markActive()
  }

  if (secondsLeft === null) return null

  return (
    <div className="animate-fade-in bg-scrim fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-text"
        data-testid="idle-warning"
        className="animate-scale-in bg-card shadow-pop flex w-full max-w-[380px] flex-col rounded-xl"
      >
        <div className="border-divider flex items-center gap-2 border-b px-5 py-4">
          <Clock size={16} className="text-warning-ink" aria-hidden="true" />
          <h3 id="idle-title" className="text-ink text-[15px] font-[650]">
            Still there?
          </h3>
        </div>
        <div className="px-5 py-5">
          <p id="idle-text" className="text-muted mb-5 text-[13px] leading-relaxed">
            You have been inactive for a while. For your security you will be signed out in{' '}
            <strong data-testid="idle-seconds" className="text-ink">
              {secondsLeft} second{secondsLeft === 1 ? '' : 's'}
            </strong>
            .
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={logout}>
              Sign out now
            </button>
            <button type="button" className="btn btn-primary" onClick={stay} autoFocus>
              Stay signed in
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
