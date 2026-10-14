import { useLayoutEffect, useRef, useState } from 'react'
import { Menu, Search, Bell, BellOff, LogOut, User, Settings, X, Sun, Moon, Monitor, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { Dropdown } from '../components/ui/Dropdown'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import { useNotifications } from '../data/NotificationsContext'
import { acceptInvitation, declineInvitation } from '../api/projectMembers'
import { updateOwnPreferences } from '../api/users'
import { initialsFor, timeAgo } from '../api/format'
import { useLayout } from './useLayout'

// Mirrors Settings.jsx's own THEME_OPTIONS (kept as a separate local copy
// rather than a shared import, since this header control only needs the
// icon per mode — Settings' segmented control doesn't use icons at all).
const THEME_OPTIONS = [
  { value: 'LIGHT', label: 'Light', icon: Sun },
  { value: 'DARK', label: 'Dark', icon: Moon },
  { value: 'SYSTEM', label: 'System', icon: Monitor },
]

// The header is sticky, but a header that wraps onto a second or third row (the action buttons on a phone, a project's
// many actions) would pin a third of the screen. So only its FIRST row stays pinned: as the page scrolls, the rows
// below it are clipped away, one pixel per pixel scrolled (the page content shows through where they were, and the
// clipped part no longer takes clicks), exactly as if those rows had scrolled off. Scrolled back to the top the whole
// header is there again. A one-row header stays pinned whole. The header keeps its size, so nothing in the page moves.
// Measured again whenever the header or one of its blocks resizes (a window resize, a title that changes, buttons
// that wrap).
function usePinFirstRow(ref) {
  useLayoutEffect(() => {
    const header = ref.current
    if (!header) return undefined
    let hidden = 0 // the height of the rows below the first one
    const clip = () => {
      const cut = Math.min(hidden, Math.max(0, globalThis.scrollY))
      header.style.clipPath = cut > 0 ? `inset(0 0 ${cut}px 0)` : ''
    }
    const measure = () => {
      const box = header.getBoundingClientRect()
      const [first, ...rest] = [...header.children].map((el) => el.getBoundingClientRect())
      if (!first) return
      // the first row: the first block, and any other block that sits on the same line
      let bottom = first.bottom
      for (const r of rest) if (r.top < first.bottom - 1) bottom = Math.max(bottom, r.bottom)
      // 16px = the padding under the row (pb-4), so the pinned part ends the way the whole header would
      hidden = Math.max(0, box.height - Math.min(box.height, bottom - box.top + 16))
      clip()
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    for (const child of header.children) observer.observe(child)
    globalThis.addEventListener('scroll', clip, { passive: true })
    return () => {
      observer.disconnect()
      globalThis.removeEventListener('scroll', clip)
      header.style.clipPath = ''
    }
  }, [ref])
}

// Search only renders when a page actually wires `onSearchChange` — a
// decorative input that filters nothing is worse than no input at all.
export function TopBar({ title, subtitle, actions, searchValue, onSearchChange, searchPlaceholder = 'Search' }) {
  const showSearch = Boolean(onSearchChange)
  const headerRef = useRef(null)
  usePinFirstRow(headerRef)
  const { openMobileNav } = useLayout()
  const { profile, username, logout, refreshProfile } = useAuth()
  const { theme, setTheme } = useTheme()
  const { notifications, total, unreadCount, hasMore, loadingMore, loadMore, markRead, markAllRead, dismiss } = useNotifications()
  const notify = useToast()
  const navigate = useNavigate()
  const displayName = profile?.fullName || username || ''
  const [respondingId, setRespondingId] = useState(null)
  const [savingTheme, setSavingTheme] = useState(false)
  const ActiveThemeIcon = THEME_OPTIONS.find((opt) => opt.value === theme)?.icon ?? Monitor

  // Same persistence path as Settings.jsx's own theme control (PUT
  // /users/me/preferences requires both fields, so the current
  // taskNotificationsEnabled is resent unchanged) — this is just a second,
  // faster entry point to the exact same saved preference, not a separate
  // one. Applies instantly via setTheme regardless of whether the save
  // succeeds, same as Settings.jsx; a failed save only shows an error toast.
  const handleThemeChange = async (value) => {
    if (value === theme) return
    setTheme(value)
    setSavingTheme(true)
    try {
      await updateOwnPreferences({
        themePreference: value,
        taskNotificationsEnabled: profile?.taskNotificationsEnabled ?? true,
      })
      await refreshProfile()
    } catch (err) {
      notify(err.message || 'Failed to save theme preference', { tone: 'error' })
    } finally {
      setSavingTheme(false)
    }
  }

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
    // Sticky: the header stays at the top while the page scrolls under it. It reaches up into the page's top padding
    // (the -mt / pt pairs equal the padding of AppLayout's content box at each width) so it keeps the same spacing
    // above the title when stuck, and its bottom gap is split into padding (covered by the canvas background, so
    // content does not show through) and margin (the same 28px of space as before in total). z-30 is above the
    // page content and below the sidebar (z-40), its mobile scrim (z-39), side panels and dialogs. Only the first
    // row stays pinned when the header wraps (see usePinFirstRow).
    <header ref={headerRef} className="bg-canvas sticky top-0 z-30 -mt-8 mb-3 flex flex-wrap items-center justify-between gap-4 pt-8 pb-4 max-lg:-mt-5 max-lg:pt-5 max-sm:-mt-4 max-sm:pt-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          className="border-border bg-card text-ink hidden h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border max-lg:inline-flex"
          onClick={openMobileNav}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-ink truncate text-[30px] font-bold tracking-[-0.02em] max-sm:text-2xl">
            {title}
          </h1>
          {subtitle && <p className="text-muted mt-1 text-[13px]">{subtitle}</p>}
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
              className="text-ink placeholder:text-faint w-full border-none bg-transparent text-[13px] outline-none"
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
                    className="text-muted hover:text-ink text-[12px] font-semibold"
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
                            <span className="text-ink text-[12px] font-semibold">{n.title}</span>
                          </span>
                          {n.message && <span className="text-muted text-[12px]">{n.message}</span>}
                          <span className="text-faint text-[12px]">{timeAgo(n.createdAt)}</span>
                          <div className="mt-1 flex gap-2">
                            <button
                              type="button"
                              className="btn btn-primary px-2.5 py-1 text-[12px]"
                              disabled={respondingId === n.id}
                              onClick={() => handleRespond(n, true)}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary px-2.5 py-1 text-[12px]"
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
                            <span className="text-ink text-[12px] font-semibold">{n.title}</span>
                          </span>
                          {n.message && <span className="text-muted text-[12px]">{n.message}</span>}
                          <span className="text-faint text-[12px]">{timeAgo(n.createdAt)}</span>
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
                {hasMore && (
                  <button
                    type="button"
                    className="text-muted hover:text-ink hover:bg-subtle mt-1 w-full rounded-md px-2.5 py-2 text-center text-[12px] font-semibold"
                    disabled={loadingMore}
                    onClick={loadMore}
                  >
                    {loadingMore ? 'Loading…' : `Show more (${total - notifications.length} older)`}
                  </button>
                )}
              </div>
            </div>
          )}
        </Dropdown>
        <Dropdown
          align="right"
          button={({ toggle }) => (
            <button className="icon-btn" aria-label="Theme" onClick={toggle} disabled={savingTheme}>
              <ActiveThemeIcon size={18} />
            </button>
          )}
          panelClassName="w-[160px] p-1.5"
        >
          {({ close }) => (
            <div className="flex flex-col gap-0.5">
              {THEME_OPTIONS.map((opt) => {
                const OptionIcon = opt.icon
                const active = theme === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`hover:bg-subtle flex items-center justify-between gap-4 rounded-sm px-2.5 py-2 text-left text-[13px] ${
                      active ? 'text-ink font-semibold' : 'text-muted'
                    }`}
                    onClick={() => {
                      handleThemeChange(opt.value)
                      close()
                    }}
                  >
                    <span className="flex items-center gap-2.5">
                      <OptionIcon size={15} /> {opt.label}
                    </span>
                    {active && <Check size={14} />}
                  </button>
                )
              })}
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
                <p className="text-faint truncate text-[12px]">{username}</p>
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
                className="hover:bg-subtle text-danger-ink flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-[13px]"
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
