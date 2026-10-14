import { useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

// A searchable select ("combo box"): a text field that opens a list of options. You type to narrow the list
// (or the parent narrows it, see `onInputChange`), move with the arrow keys, pick with Enter or a click and
// close with Escape. The chosen option stays shown in the field; typing again clears the choice, so only a
// listed option can ever be chosen - there is no free text.
//
//   options        [{ value, label, hint?, leading? }]   hint is a second line, leading a small node (an avatar)
//   value          the chosen option (or null)
//   onChange       (option | null) => void
//   onInputChange  optional (text) => void. When given the PARENT filters (for example by asking the server),
//                  and the list is shown as supplied; otherwise the options are filtered here by label and hint.
//   loading        shows "Searching…" in the list while a lookup is under way
export function Combobox({
  label,
  options,
  value,
  onChange,
  onInputChange,
  placeholder = 'Search…',
  emptyMessage = 'No match',
  loading = false,
  disabled = false,
  autoFocus = false,
  hint,
}) {
  const id = useId()
  const listId = `${id}-list`
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)

  // What the field shows: what is being typed while the list is open, otherwise the chosen option.
  const shown = open ? text : (value?.label ?? '')

  const visible = useMemo(() => {
    if (onInputChange) return options
    const q = text.trim().toLowerCase()
    if (!q || (value && text === value.label)) return options
    return options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q))
  }, [options, onInputChange, text, value])

  // The highlighted row, kept inside the list when the list gets shorter.
  const current = Math.min(active, Math.max(visible.length - 1, 0))

  const choose = (option) => {
    onChange(option)
    setText(option.label)
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive(Math.min(current + 1, visible.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(Math.max(current - 1, 0))
    } else if (e.key === 'Enter') {
      // Enter picks the highlighted option; it never submits the form while the list is open.
      if (open) {
        e.preventDefault()
        if (visible[current]) choose(visible[current])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        // Closing the list is all Escape does here; the panel behind it stays open.
        e.preventDefault()
        e.stopPropagation()
        e.nativeEvent.stopImmediatePropagation?.()
        setOpen(false)
      }
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-muted text-[12px] font-semibold">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && visible[current] ? `${id}-opt-${current}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          value={shown}
          className="field w-full pr-9"
          onFocus={() => {
            setText(value?.label ?? '')
            setOpen(true)
            // opening on focus lists everything again, so the choice can be changed without clearing it first
            if (onInputChange && !value) onInputChange('')
          }}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setActive(0)
            if (value) onChange(null)
            onInputChange?.(e.target.value)
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setOpen(false)
            setText(value?.label ?? '')
          }}
        />
        <ChevronDown
          size={15}
          className="text-faint pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
          aria-hidden="true"
        />
        {open && !disabled && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="bg-card border-border absolute right-0 left-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-md border p-1 shadow-lg"
          >
            {visible.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={value?.value === o.value}
                // mousedown, not click: the field's blur would close the list before a click lands
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(o)
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] ${
                  i === current ? 'bg-subtle' : ''
                }`}
              >
                {o.leading}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-ink truncate font-semibold">{o.label}</span>
                  {o.hint && <span className="text-faint truncate text-[12px]">{o.hint}</span>}
                </span>
                {value?.value === o.value && <Check size={14} className="shrink-0" aria-hidden="true" />}
              </li>
            ))}
            {visible.length === 0 && (
              <li role="presentation" className="text-faint px-2 py-2 text-[12px]">
                {loading ? 'Searching…' : emptyMessage}
              </li>
            )}
          </ul>
        )}
      </div>
      {hint && <span className="text-faint text-[12px]">{hint}</span>}
    </div>
  )
}
