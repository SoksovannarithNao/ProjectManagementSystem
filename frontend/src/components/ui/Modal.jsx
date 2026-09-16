import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

// `children` may be a plain node (every existing caller — ConfirmDialog,
// AddMemberModal, etc. — keeps working unchanged) or a render function
// `({ requestClose }) => node` for a form that wants its own Cancel button
// to go through the same dirty-check as the backdrop/X instead of calling
// `onClose` directly.
export function Modal({ title, onClose, children, isDirty = false }) {
  const [confirmingClose, setConfirmingClose] = useState(false)

  const requestClose = () => {
    if (isDirty) setConfirmingClose(true)
    else onClose()
  }

  // Covers the one close path that can't go through requestClose — a tab
  // close/refresh or a URL bar navigation. In-app navigation via a sidebar
  // Link isn't covered: this app runs a plain BrowserRouter (see main.jsx),
  // and react-router's navigation-blocking APIs (useBlocker/usePrompt) only
  // work under a data router, so intercepting that would mean restructuring
  // routing app-wide rather than reusing what already exists here.
  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Every backdrop click below stops propagation before acting on it. Modal
  // isn't rendered through a portal, so when one opens nested inside another
  // full-screen overlay that also closes on a backdrop click (e.g. this
  // Edit Task form opened from within TaskDetailPanel, itself a `fixed
  // inset-0 ... onClick={onClose}` backdrop), an unstopped click here would
  // bubble straight through the real DOM and dismiss that ancestor too —
  // one click meant only to close this modal instead closing the panel
  // behind it as well. Confirmed live before this existed.
  return (
    <>
      <div
        className="animate-fade-in fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(20,20,22,.4)] p-4 backdrop-blur-[2px]"
        onClick={(e) => {
          e.stopPropagation()
          requestClose()
        }}
      >
        <div
          className="animate-scale-in bg-card shadow-pop flex max-h-[90vh] w-full max-w-[460px] flex-col rounded-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-divider flex items-center justify-between border-b px-5 py-4">
            <h3 className="text-ink text-[15px] font-[650]">{title}</h3>
            <button className="icon-btn" onClick={requestClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5">
            {typeof children === 'function' ? children({ requestClose }) : children}
          </div>
        </div>
      </div>

      {confirmingClose && (
        <div
          className="animate-fade-in fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(20,20,22,.4)] p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            e.stopPropagation()
            setConfirmingClose(false)
          }}
        >
          <div
            className="animate-scale-in bg-card shadow-pop flex w-full max-w-[380px] flex-col rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-divider border-b px-5 py-4">
              <h3 className="text-ink text-[15px] font-[650]">Discard changes?</h3>
            </div>
            <div className="px-5 py-5">
              <p className="text-muted mb-5 text-[13px] leading-relaxed">
                You have unsaved changes. Closing now will discard them.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setConfirmingClose(false)}>
                  Keep editing
                </button>
                <button type="button" className="btn bg-danger text-white hover:opacity-90" onClick={onClose}>
                  Discard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
