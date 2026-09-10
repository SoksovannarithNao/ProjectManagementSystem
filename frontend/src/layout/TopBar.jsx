import { Menu, Search, Bell, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { useAuth } from '../auth/AuthContext'
import { initialsFor } from '../api/format'
import { useLayout } from './useLayout'

export function TopBar({ title, subtitle, actions, showSearch = true }) {
  const { openMobileNav } = useLayout()
  const { profile, username, logout } = useAuth()
  const navigate = useNavigate()
  const displayName = profile?.fullName || username || ''

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          className="border-border bg-card text-ink hidden h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border max-lg:inline-flex"
          onClick={openMobileNav}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-ink truncate text-[30px] font-bold tracking-[-0.02em] max-sm:text-2xl">
            {title}
          </h1>
          {subtitle && <p className="text-muted mt-1 text-[13.5px]">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2.5 max-sm:gap-2">
        {actions}
        {showSearch && (
          <div className="border-border bg-subtle text-faint focus-within:border-lavender flex h-[42px] w-[180px] items-center gap-2 rounded-md border px-3.5 transition-[width,border-color] duration-[var(--duration-med)] ease-[var(--ease-standard)] focus-within:w-[220px] max-sm:hidden">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search"
              className="text-ink placeholder:text-faint w-full border-none bg-transparent text-[13.5px] outline-none"
            />
          </div>
        )}
        <button className="icon-btn relative" aria-label="Notifications">
          <Bell size={18} />
          <span className="bg-danger border-card absolute top-[9px] right-[10px] h-1.5 w-1.5 rounded-full border-[1.5px]" />
        </button>
        <button className="icon-btn" aria-label="Log out" title="Log out" onClick={handleLogout}>
          <LogOut size={18} />
        </button>
        <Avatar initials={initialsFor(displayName)} color="var(--accent-purple)" size={40} />
      </div>
    </header>
  )
}
