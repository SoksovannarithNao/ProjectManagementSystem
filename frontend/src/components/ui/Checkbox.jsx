import { Check } from 'lucide-react'

// A rounded square that fills with the charcoal accent and shows a check mark when
// ticked (the same accent as the Settings switch). The real checkbox sits on top,
// invisible and full size, so it is keyboard- and screen-reader-native and the whole
// 24px cell is the click target; the box is drawn underneath and follows its state
// through the `peer` selectors. The check mark takes its colour from the theme, so it
// reads in light and dark.
export function Checkbox({ checked, onChange, disabled = false, label, title }) {
  return (
    <span className="relative inline-flex h-6 w-6 items-center justify-center" title={title}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={label}
        className="peer absolute inset-0 z-[1] m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className="border-faint bg-card peer-checked:border-charcoal peer-checked:bg-charcoal peer-checked:text-on-charcoal peer-hover:border-ink peer-focus-visible:outline-focus pointer-events-none flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] text-transparent transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-40"
      >
        <Check size={13} strokeWidth={3.25} />
      </span>
    </span>
  )
}
