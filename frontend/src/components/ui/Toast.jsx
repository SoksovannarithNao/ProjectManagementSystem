import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = { success: CheckCircle2, error: XCircle, info: Info }
const ACCENT = { success: 'bg-success', error: 'bg-danger', info: 'bg-info' }
const ICON_COLOR = { success: 'text-success', error: 'text-danger', info: 'text-info' }

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (message, { tone = 'info', duration = 4000 } = {}) => {
      const id = ++idCounter
      setToasts((prev) => [...prev, { id, message, tone }])
      if (duration > 0) setTimeout(() => dismiss(id), duration)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="pointer-events-none fixed right-5 bottom-5 z-[100] flex w-full max-w-[340px] flex-col gap-2.5">
        {toasts.map((t) => {
          const Icon = ICONS[t.tone] ?? ICONS.info
          return (
            <div
              key={t.id}
              className="animate-toast-in bg-card shadow-pop text-ink pointer-events-auto relative flex items-center gap-2.5 overflow-hidden rounded-md py-3 pr-3 pl-4 text-[13px] font-medium"
            >
              <span className={`absolute top-0 bottom-0 left-0 w-[3px] ${ACCENT[t.tone] ?? ACCENT.info}`} />
              <Icon size={17} className={`shrink-0 ${ICON_COLOR[t.tone] ?? ICON_COLOR.info}`} />
              <span className="flex-1">{t.message}</span>
              <button
                className="text-faint hover:text-ink shrink-0"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook live together deliberately
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
