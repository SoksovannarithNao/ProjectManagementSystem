import { useId, useRef, useState } from 'react'
import { applyMention, mentionCandidates, mentionQueryAt } from '../api/mentions'

// A one-line text input where typing "@" offers the project's members to mention (G-14, D-21).
// Arrow keys + Enter/Tab pick, Escape closes; with the list closed it behaves like a plain input.
// `members` are the active members of the task's project; `excludeId` is the author.
export function MentionInput({ value, onChange, members, excludeId, className, ...rest }) {
  const inputRef = useRef(null)
  const listId = useId()
  const [query, setQuery] = useState(null)
  const [active, setActive] = useState(0)

  const options = query ? mentionCandidates(members, query.query, excludeId) : []
  const open = options.length > 0

  const track = (text, caret) => {
    setQuery(mentionQueryAt(text, caret))
    setActive(0)
  }

  const pick = (member) => {
    const input = inputRef.current
    const next = applyMention(value, query.start, input.selectionStart, member.username)
    onChange(next.text)
    setQuery(null)
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(next.caret, next.caret)
    })
  }

  const onKeyDown = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : options.length - 1
      setActive((i) => (i + step) % options.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      pick(options[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setQuery(null)
    }
  }

  return (
    <div className="relative flex-1">
      <input
        {...rest}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        className={className}
        onChange={(e) => {
          onChange(e.target.value)
          track(e.target.value, e.target.selectionStart)
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
            track(e.target.value, e.target.selectionStart)
          }
        }}
        onClick={(e) => track(e.target.value, e.target.selectionStart)}
        onBlur={() => setQuery(null)}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Mention a member"
          className="bg-card border-border absolute right-0 bottom-full left-0 z-20 mb-1 max-h-48 overflow-y-auto rounded-md border p-1 shadow-lg"
        >
          {options.map((m, i) => (
            <li
              key={m.id}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the input must not lose focus (and close the list) first
              onMouseDown={(e) => {
                e.preventDefault()
                pick(m)
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline gap-2 rounded px-2 py-1.5 text-[12px] ${
                i === active ? 'bg-subtle' : ''
              }`}
            >
              <span className="font-semibold">{m.fullName}</span>
              <span className="text-muted">@{m.username}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
