import { Menu, Search, Bell, BellOff, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { Dropdown } from '../components/ui/Dropdown'
import { EmptyState } from '../components/ui/EmptyState'
import { useAuth } from '../auth/AuthContext'
import { useNotifications } from '../data/NotificationsContext'
import { initialsFor, timeAgo } from '../api/format'
import { useLayout } from './useLayout'

// Search only renders when a page actually wires `onSearchChange` — a
// decorative input that filters nothing is worse than no input at all.
export function TopBar({ title, subtitle, actions, searchValue, onSearchChange, searchPlaceholder = 'Search' }) {
  const showSearch = Boolean(onSearchChange)
  const { openMobileNav } = useLayout()
  const { profile, username, logout } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
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
              placeholder={searchPlaceholder}
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="text-ink placeholder:text-faint w-full border-none bg-transparent text-[13.5px] outline-none"
            />
          </div>
        )}
        <Dropdown
          align="right"
          button={({ toggle }) => (
            <button className="icon-btn relative" aria-label="Notifications" onClick={toggle}>
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="bg-danger border-card absolute top-[9px] right-[10px] h-1.5 w-1.5 rounded-full border-[1.5px]" />
              )}
            </button>
          )}
          panelClassName="w-[340px] p-0"
        >
          {() => (
            <div className="flex max-h-[420px] flex-col">
              <div className="border-divider flex items-center justify-between border-b px-3.5 py-2.5">
                <span className="text-ink text-[13px] font-[650]">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="text-muted hover:text-ink text-[11.5px] font-semibold"
                    onClick={markAllRead}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-1.5">
                {notifications.length === 0 && <EmptyState icon={BellOff} title="No notifications yet" />}
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`hover:bg-subtle flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left ${
                      !n.read ? 'bg-info-soft' : ''
                    }`}
                    onClick={() => !n.read && markRead(n.id)}
                  >
                    <span className="flex items-center gap-1.5">
                      {!n.read && <span className="bg-info h-1.5 w-1.5 shrink-0 rounded-full" />}
                      <span className="text-ink text-[12.5px] font-semibold">{n.title}</span>
                    </span>
                    {n.message && <span className="text-muted text-[12px]">{n.message}</span>}
                    <span className="text-faint text-[11px]">{timeAgo(n.createdAt)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Dropdown>
        <button className="icon-btn" aria-label="Log out" title="Log out" onClick={handleLogout}>
          <LogOut size={18} />
        </button>
        <Avatar initials={initialsFor(displayName)} color="var(--accent-purple)" size={40} />
      </div>
    </header>
  )
}
