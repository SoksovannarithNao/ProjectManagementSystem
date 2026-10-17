import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'

const THEMES = [
  { value: 'LIGHT', label: 'Light', icon: Sun },
  { value: 'DARK', label: 'Dark', icon: Moon },
  { value: 'SYSTEM', label: 'System', icon: Monitor },
]

// One button that steps Light -> Dark -> System. The icon shows the current mode and the label says what the next
// click does. It is the theme control of both the public pages and the signed-in app's top bar.
//
// By default a click only changes the theme in this browser (ThemeContext). The signed-in app passes `onChange`
// to also save the choice to the account; `disabled` covers that save while it runs.
export function ThemeToggle({ onChange, disabled = false }) {
  const { theme, setTheme } = useTheme()
  const index = Math.max(0, THEMES.findIndex((t) => t.value === theme))
  const current = THEMES[index]
  const next = THEMES[(index + 1) % THEMES.length]
  const Icon = current.icon

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => (onChange ? onChange(next.value) : setTheme(next.value))}
      disabled={disabled}
      aria-label={`Theme: ${current.label}. Switch to ${next.label}`}
      title={`Theme: ${current.label}`}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  )
}
