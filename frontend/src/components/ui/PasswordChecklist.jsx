import { Check, Circle } from 'lucide-react'
import { PASSWORD_RULES } from '../../api/validation'

// Live requirements list shown under a "new password" field. Rules start
// neutral and turn green as the typed password satisfies them.
export function PasswordChecklist({ password, className = '' }) {
  const value = password ?? ''
  return (
    <ul className={`grid grid-cols-2 gap-x-3 gap-y-1 ${className}`} aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value)
        return (
          <li
            key={rule.id}
            className={`flex items-center gap-1.5 text-[12px] ${met ? 'text-success-ink font-semibold' : 'text-faint'}`}
          >
            {met ? <Check size={12} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}
            <span>{rule.label}</span>
            <span className="sr-only">{met ? '(met)' : '(not met)'}</span>
          </li>
        )
      })}
    </ul>
  )
}
