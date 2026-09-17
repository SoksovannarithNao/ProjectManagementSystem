import { useState } from 'react'
import { Palette, Bell } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import { updateOwnPreferences } from '../api/users'

const THEME_OPTIONS = [
  { value: 'LIGHT', label: 'Light' },
  { value: 'DARK', label: 'Dark' },
  { value: 'SYSTEM', label: 'System' },
]

// Application/appearance preferences only — personal info and password live
// on the Profile page instead. Both write through to the same account, just
// via separate endpoints (see backend UserController's /me/preferences vs
// /me and /me/password), so this page never touches profile fields.
export function Settings() {
  const { profile, refreshProfile } = useAuth()
  const { theme, setTheme } = useTheme()
  const notify = useToast()

  const [taskNotificationsEnabled, setTaskNotificationsEnabled] = useState(
    profile?.taskNotificationsEnabled ?? true
  )
  const [saving, setSaving] = useState(false)

  const savePreferences = async (next) => {
    setSaving(true)
    try {
      await updateOwnPreferences({
        themePreference: next.themePreference,
        taskNotificationsEnabled: next.taskNotificationsEnabled,
      })
      await refreshProfile()
      notify('Settings saved', { tone: 'success' })
    } catch (err) {
      notify(err.message || 'Failed to save settings', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleThemeChange = (value) => {
    setTheme(value)
    savePreferences({ themePreference: value, taskNotificationsEnabled })
  }

  const handleNotificationsToggle = () => {
    const next = !taskNotificationsEnabled
    setTaskNotificationsEnabled(next)
    savePreferences({ themePreference: theme, taskNotificationsEnabled: next })
  }

  return (
    <div>
      <TopBar title="Settings" subtitle="Manage appearance and notification preferences" />

      <div className="grid max-w-[640px] grid-cols-1 gap-5">
        <section className="card px-6 py-5">
          <div className="mb-4 flex items-center gap-2.5">
            <Palette size={17} className="text-muted" />
            <h3 className="section-title text-base">Appearance</h3>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-muted text-[12.5px] font-semibold">Theme</span>
            <div className="bg-subtle border-border inline-flex w-fit gap-0.5 rounded-md border p-[3px]">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={saving}
                  onClick={() => handleThemeChange(opt.value)}
                  className={`duration-[var(--duration-fast)] ease-[var(--ease-standard)] rounded-sm border-none px-4 py-[7px] text-[12.5px] font-semibold transition-colors ${
                    theme === opt.value ? 'bg-charcoal text-white' : 'bg-transparent text-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="text-faint mt-1 text-[11.5px]">
              System matches your device's light/dark setting automatically.
            </span>
          </div>
        </section>

        <section className="card px-6 py-5">
          <div className="mb-4 flex items-center gap-2.5">
            <Bell size={17} className="text-muted" />
            <h3 className="section-title text-base">Notifications</h3>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="flex flex-col gap-0.5">
              <span className="text-ink text-[13.5px] font-semibold">Task notifications</span>
              <span className="text-faint text-[12px]">
                Get notified in-app when you're assigned to a task or one of your tasks changes status.
              </span>
            </span>
            <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
              <input
                type="checkbox"
                checked={taskNotificationsEnabled}
                onChange={handleNotificationsToggle}
                disabled={saving}
                className="peer sr-only"
              />
              <span className="border-border bg-canvas peer-checked:bg-charcoal peer-checked:border-charcoal absolute inset-0 rounded-full border transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)]" />
              <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)] peer-checked:translate-x-5" />
            </span>
          </label>
        </section>
      </div>
    </div>
  )
}
