import { useState } from 'react'
import { Menu, Search, Bell, BellOff, LogOut, User, Settings, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { Dropdown } from '../components/ui/Dropdown'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthContext'
import { useNotifications } from '../data/NotificationsContext'
import { acceptInvitation, declineInvitation } from '../api/projectMembers'
import { initialsFor, timeAgo } from '../api/format'
import { useLayout } from './useLayout'

// Search only renders when a page actually wires `onSearchChange` — a
// decorative input that filters nothing is worse than no input at all.
export function TopBar({ title, subtitle, actions, searchValue, onSearchChange, searchPlaceholder = 'Search' }) {
  const showSearch = Boolean(onSearchChange)
  const { openMobileNav } = useLayout()
  const { profile, username, logout } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead, dismiss } = useNotifications()
  const notify = useToast()
  const navigate = useNavigate()
  const displayName = profile?.fullName || username || ''
  const [respondingId, setRespondingId] = useState(null)

  const handleRespond = async (n, accept) => {
    if (n.projectId == null) return
    setRespondingId(n.id)
    try {
      if (accept) await acceptInvitation(n.projectId)
      else await declineInvitation(n.projectId)
      await dismiss(n.id)
      notify(
        accept ? `Joined "${n.projectName}"` : `Declined the invitation to "${n.projectName}"`,
        { tone: 'success' }
      )
    } catch (err) {
      notify(err.message || 'Failed to respond to invitation', { tone: 'error' })
    } finally {
      setRespondingId(null)
    }
  }

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

      <div className="flex flex-wrap items-center justify-end gap-2.5 max-sm:gap-2">
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
                {notifications.map((n) => {
                  const isInvitation = n.type === 'TEAM_INVITATION' && n.projectId != null
                  return (
                    <div
                      key={n.id}
                      className={`hover:bg-subtle group flex w-full items-start gap-1 rounded-md px-2.5 py-2 ${
                        !n.read ? 'bg-info-soft' : ''
                      }`}
                    >
                      {isInvitation ? (
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <span className="flex items-center gap-1.5">
                            {!n.read && <span className="bg-info h-1.5 w-1.5 shrink-0 rounded-full" />}
                            <span className="text-ink text-[12.5px] font-semibold">{n.title}</span>
                          </span>
                          {n.message && <span className="text-muted text-[12px]">{n.message}</span>}
                          <span className="text-faint text-[11px]">{timeAgo(n.createdAt)}</span>
                          <div className="mt-1 flex gap-2">
                            <button
                              type="button"
                              className="btn btn-primary px-2.5 py-1 text-[11.5px]"
                              disabled={respondingId === n.id}
                              onClick={() => handleRespond(n, true)}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary px-2.5 py-1 text-[11.5px]"
                              disabled={respondingId === n.id}
                              onClick={() => handleRespond(n, false)}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                          onClick={() => !n.read && markRead(n.id)}
                        >
                          <span className="flex items-center gap-1.5">
                            {!n.read && <span className="bg-info h-1.5 w-1.5 shrink-0 rounded-full" />}
                            <span className="text-ink text-[12.5px] font-semibold">{n.title}</span>
                          </span>
                          {n.message && <span className="text-muted text-[12px]">{n.message}</span>}
                          <span className="text-faint text-[11px]">{timeAgo(n.createdAt)}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn shrink-0 opacity-0 group-hover:opacity-100"
                        aria-label="Dismiss notification"
                        onClick={() => dismiss(n.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Dropdown>
        <Dropdown
          align="right"
          button={({ toggle }) => (
            <button
              className="hover:bg-subtle flex items-center gap-2.5 rounded-full py-1 pr-1 pl-2.5 max-sm:pl-1"
              aria-label="Account menu"
              onClick={toggle}
            >
              <span className="text-ink max-w-[160px] truncate text-[13px] font-semibold max-sm:hidden">
                {displayName}
              </span>
              <Avatar
                initials={initialsFor(displayName)}
                color="var(--accent-purple)"
                photoUrl={profile?.profilePhotoUrl}
                size={40}
              />
            </button>
          )}
          panelClassName="w-[220px] p-1.5"
        >
          {({ close }) => (
            <div className="flex flex-col gap-0.5">
              <div className="border-divider mb-1 border-b px-2.5 pb-2">
                <p className="text-ink truncate text-[13px] font-semibold">{displayName}</p>
                <p className="text-faint truncate text-[11.5px]">{username}</p>
              </div>
              <button
                type="button"
                className="hover:bg-subtle text-ink flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-[13px]"
                onClick={() => {
                  close()
                  navigate('/profile')
                }}
              >
                <User size={15} /> Profile
              </button>
              <button
                type="button"
                className="hover:bg-subtle text-ink flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-[13px]"
                onClick={() => {
                  close()
                  navigate('/settings')
                }}
              >
                <Settings size={15} /> Settings
              </button>
              <button
                type="button"
                className="hover:bg-subtle text-danger flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-[13px]"
                onClick={() => {
                  close()
                  handleLogout()
                }}
              >
                <LogOut size={15} /> Logout
              </button>
            </div>
          )}
        </Dropdown>
      </div>
    </header>
  )
}
