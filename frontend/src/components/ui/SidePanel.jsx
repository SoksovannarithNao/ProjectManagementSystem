import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'

// A form that slides in from the right, in the same frame as the task panel
// (TaskDetailPanel): a scrim, a header with the title and a close button, then the
// content. `children` is a render function `({ requestClose }) => node`; the form it
// returns lays out its own scrolling body and footer inside the panel (the panel
// gives it a full-height column). Like Modal, closing with unsaved changes (`isDirty`)
// asks first, whether it is the scrim, the X, Escape or the form's own Cancel.
export function SidePanel({ title, onClose, children, isDirty = false }) {
  const [confirmingClose, setConfirmingClose] = useState(false)

  const requestClose = () => {
    if (isDirty) setConfirmingClose(true)
    else onClose()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !confirmingClose) {
        if (isDirty) setConfirmingClose(true)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDirty, onClose, confirmingClose])

  // A tab close or refresh cannot go through requestClose, same as Modal.
  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  return (
    <>
      <div
        className="animate-fade-in fixed inset-0 z-[60] flex justify-end bg-scrim"
        onClick={(e) => {
          e.stopPropagation()
          requestClose()
        }}
      >
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="animate-slide-in bg-card shadow-pop flex h-full w-[440px] max-w-[100vw] flex-col max-sm:w-[100vw]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-divider flex items-center justify-between border-b px-[22px] py-[18px]">
            <h3 className="text-ink text-[15px] font-[650]">{title}</h3>
            <button type="button" className="icon-btn" onClick={requestClose} aria-label="Close panel">
              <X size={18} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{children({ requestClose })}</div>
        </aside>
      </div>

      {confirmingClose && (
        <ConfirmDialog
          title="Discard changes?"
          message="You have unsaved changes. Closing now will discard them."
          confirmLabel="Discard"
          onConfirm={onClose}
          onClose={() => setConfirmingClose(false)}
        />
      )}
    </>
  )
}
