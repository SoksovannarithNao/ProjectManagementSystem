import { Modal } from './Modal'

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', tone = 'danger', loading, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-muted mb-5 text-[13px] leading-relaxed">{message}</p>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn ${tone === 'danger' ? 'bg-danger text-white hover:opacity-90' : 'btn-primary'}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
