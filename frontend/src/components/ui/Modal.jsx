import { X } from 'lucide-react'

export function Modal({ title, onClose, children }) {
  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(20,20,22,.4)] p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-scale-in bg-card shadow-pop flex max-h-[90vh] w-full max-w-[460px] flex-col rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-divider flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-ink text-[15px] font-[650]">{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
