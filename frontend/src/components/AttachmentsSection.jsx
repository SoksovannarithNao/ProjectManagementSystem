import { useCallback, useMemo, useRef, useState } from 'react'
import { Paperclip, Download, Trash2, Upload } from 'lucide-react'
import { useToast } from './ui/Toast'
import { useApi } from '../api/useApi'
import {
  getTaskAttachments,
  getProjectAttachments,
  uploadAttachment,
  deleteAttachment,
  downloadAttachment,
  formatFileSize,
  MAX_ATTACHMENT_BYTES,
  ATTACHMENT_ACCEPT,
  ALLOWED_ATTACHMENT_EXTENSIONS,
} from '../api/attachments'
import { timeAgo } from '../api/format'

// Files attached to a task (pass taskId) or to a project (pass projectId).
// The server enforces who may upload or delete and which files are accepted;
// the checks here only save a round trip. A file is downloaded with the user's
// token (the bytes are never served to anyone who is not signed in).
//   canUpload   ATTACHMENT:CREATE
//   canDelete   ATTACHMENT:DELETE; the uploader can always delete their own file
export function AttachmentsSection({ taskId, projectId, canUpload, canDelete, currentUserId, onChange }) {
  const notify = useToast()
  const fileInput = useRef(null)
  const fetcher = useCallback(
    () => (taskId != null ? getTaskAttachments(taskId) : getProjectAttachments(projectId)),
    [taskId, projectId]
  )
  const { data, refetch } = useApi(fetcher)
  const files = useMemo(() => data ?? [], [data])
  const [busy, setBusy] = useState(false)

  const chosen = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow choosing the same file again
    if (!file) return
    const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
      notify(`This type of file is not allowed. Allowed: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(', ')}`, { tone: 'error' })
      return
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      notify(`The file is too large (max ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB)`, { tone: 'error' })
      return
    }
    setBusy(true)
    try {
      await uploadAttachment(file, { taskId, projectId })
      notify(`Uploaded ${file.name}`, { tone: 'success' })
      refetch()
      onChange?.()
    } catch (err) {
      notify(err.message || 'Upload failed', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const download = async (file) => {
    try {
      await downloadAttachment(file)
    } catch (err) {
      notify(err.message || 'Download failed', { tone: 'error' })
    }
  }

  const remove = async (file) => {
    setBusy(true)
    try {
      await deleteAttachment(file.id)
      refetch()
      onChange?.()
    } catch (err) {
      notify(err.message || 'Failed to delete the file', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={taskId != null ? 'mb-[22px]' : ''} data-testid="attachments-section">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-[13px] font-[650]">
          <Paperclip size={14} className="text-faint" /> Attachments
          <span className="text-faint text-[12px] font-semibold">({files.length})</span>
        </h4>
        {canUpload && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              onChange={chosen}
              className="hidden"
              aria-label="Choose a file to attach"
              data-testid="attachment-input"
            />
            <button
              type="button"
              className="btn btn-secondary px-3 py-1.5 text-[12px]"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={13} /> {busy ? 'Working…' : 'Attach file'}
            </button>
          </>
        )}
      </div>

      {files.length === 0 && <p className="text-faint text-[12px]">No files attached.</p>}

      <div className="flex flex-col gap-0.5">
        {files.map((file) => {
          const mine = currentUserId != null && file.uploadedById === currentUserId
          return (
            <div key={file.id} className="hover:bg-subtle group flex items-center gap-2.5 rounded-sm px-1 py-1.5 text-[13px]">
              <button
                type="button"
                className="text-ink hover:text-lavender flex min-w-0 flex-1 flex-col text-left"
                onClick={() => download(file)}
                aria-label={`Download ${file.fileName}`}
              >
                <span className="truncate font-semibold">{file.fileName}</span>
                <span className="text-faint truncate text-[12px]">
                  {formatFileSize(file.fileSize)} · {file.uploadedByName ?? 'Someone'} · {timeAgo(file.uploadedAt)}
                </span>
              </button>
              <button
                type="button"
                className="icon-btn h-7 w-7 shrink-0"
                aria-label={`Download ${file.fileName}`}
                onClick={() => download(file)}
              >
                <Download size={14} />
              </button>
              {(canDelete || mine) && (
                <button
                  type="button"
                  className="icon-btn h-7 w-7 shrink-0 hover:text-danger-ink"
                  aria-label={`Delete ${file.fileName}`}
                  disabled={busy}
                  onClick={() => remove(file)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
