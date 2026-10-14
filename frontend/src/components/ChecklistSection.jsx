import { useCallback, useMemo, useState } from 'react'
import { CheckSquare, Square, ListTodo, Trash2 } from 'lucide-react'
import { useToast } from './ui/Toast'
import { useApi } from '../api/useApi'
import { getChecklistItems, createChecklistItem, updateChecklistItem, deleteChecklistItem } from '../api/checklist'

// The checklist of one task: lightweight tick-boxes, apart from subtasks
// (assignment-brief.md B1.6). They count toward the task's progress together
// with its subtasks. What the user may do is decided by the server; the
// controls it would refuse are simply not shown.
//   canAdd     CHECKLIST_ITEM:CREATE
//   canTick    CHECKLIST_ITEM:EDIT, and (for a Team Member) a task assigned to them
//   canDelete  CHECKLIST_ITEM:DELETE; the person who added an item can always delete it
export function ChecklistSection({ taskId, canAdd, canTick, canDelete, currentUserId, onChange }) {
  const notify = useToast()
  const fetcher = useCallback(() => getChecklistItems(taskId), [taskId])
  const { data, refetch } = useApi(fetcher)
  const items = useMemo(() => data ?? [], [data])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const done = items.filter((i) => i.completed).length

  const run = async (action, failure) => {
    setBusy(true)
    try {
      await action()
      refetch()
      onChange?.()
    } catch (err) {
      notify(err.message || failure, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const add = (e) => {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    run(async () => {
      await createChecklistItem(taskId, content)
      setText('')
    }, 'Failed to add the item')
  }

  return (
    <div className="mb-[22px]" data-testid="checklist-section">
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-[13px] font-[650]">
          <ListTodo size={14} className="text-faint" /> Checklist
        </h4>
        <span className="text-faint text-[12px] font-semibold">
          {done}/{items.length}
        </span>
      </div>

      {items.length === 0 && <p className="text-faint mb-1 text-[12px]">No checklist items.</p>}

      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const mine = currentUserId != null && item.createdById === currentUserId
          return (
            <div key={item.id} className="hover:bg-subtle group flex items-center gap-2.5 rounded-sm px-1 py-1.5 text-[13px]">
              <button
                type="button"
                disabled={!canTick || busy}
                className="text-faint hover:text-ink shrink-0 disabled:cursor-default"
                aria-label={item.completed ? `Mark "${item.content}" as not done` : `Mark "${item.content}" as done`}
                aria-pressed={item.completed}
                onClick={() =>
                  run(
                    () => updateChecklistItem(item.id, { content: item.content, completed: !item.completed }),
                    'Failed to update the item'
                  )
                }
              >
                {item.completed ? <CheckSquare size={16} className="text-success-ink" /> : <Square size={16} />}
              </button>
              <span className={`min-w-0 flex-1 break-words ${item.completed ? 'text-faint line-through' : 'text-ink'}`}>
                {item.content}
              </span>
              {(canDelete || mine) && (
                <button
                  type="button"
                  className="icon-btn h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 hover:text-danger-ink"
                  aria-label={`Delete "${item.content}"`}
                  disabled={busy}
                  onClick={() => run(() => deleteChecklistItem(item.id), 'Failed to delete the item')}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {canAdd && (
        <form onSubmit={add} className="mt-1 flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            placeholder="Add a checklist item..."
            aria-label="New checklist item"
            className="field field-sm flex-1"
          />
          <button type="submit" className="btn btn-secondary px-3 py-2 text-[12px]" disabled={busy || !text.trim()}>
            Add
          </button>
        </form>
      )}
    </div>
  )
}
