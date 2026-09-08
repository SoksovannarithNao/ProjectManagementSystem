import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ListChecks,
  FolderKanban,
  Calendar,
  Columns3,
  Users,
  BarChart3,
  Settings,
  HelpCircle,
  X,
  Sparkles,
} from 'lucide-react'
import { Avatar } from '../components/ui/Avatar'
import { currentUser } from '../data/mockData'
import { useLayout } from './useLayout'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'My Tasks', icon: ListChecks },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/kanban', label: 'Kanban Board', icon: Columns3 },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
]

const itemBase =
  'flex h-[42px] w-full items-center gap-[11px] rounded-md border-none px-3 text-left text-[13.5px] font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] [&_svg]:shrink-0 [&_svg]:transition-colors [&_svg]:duration-[var(--duration-fast)] [&_svg]:ease-[var(--ease-standard)]'
const itemInactive =
  'bg-transparent text-muted [&_svg]:text-faint hover:bg-canvas hover:text-ink hover:[&_svg]:text-ink'
const itemActive =
  'bg-charcoal text-white shadow-[0_6px_16px_rgba(36,36,38,.22)] [&_svg]:text-white hover:bg-charcoal hover:text-white hover:[&_svg]:text-white'

export function Sidebar() {
  const { mobileNavOpen, closeMobileNav } = useLayout()

  return (
    <>
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-[39] hidden bg-[rgba(20,20,22,.35)] max-lg:block"
          onClick={closeMobileNav}
        />
      )}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex w-[var(--sidebar-width)] flex-col border-r border-border bg-card p-[14px] py-5 transition-transform duration-[var(--duration-med)] ease-[var(--ease-standard)] max-lg:shadow-pop ${
          mobileNavOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'
        }`}
      >
        <div className="mb-7 flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="1" y="1" width="8" height="8" rx="2.5" fill="#242426" />
                <rect x="11" y="1" width="8" height="8" rx="2.5" fill="#AEB9D2" />
                <rect x="1" y="11" width="8" height="8" rx="2.5" fill="#AEB9D2" />
                <rect x="11" y="11" width="8" height="8" rx="2.5" fill="#242426" />
              </svg>
            </span>
            <span className="text-ink text-[17px] font-bold tracking-[-0.02em]">TaskFlow</span>
          </div>
          <button
            className="text-muted hidden p-1 max-lg:inline-flex"
            onClick={closeMobileNav}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex flex-col gap-[3px]">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `${itemBase} ${isActive ? itemActive : itemInactive}`}
              onClick={closeMobileNav}
            >
              <item.icon size={18} strokeWidth={2} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-divider mt-auto flex flex-col gap-[3px] border-t pt-3.5">
          <button className={`${itemBase} ${itemInactive}`}>
            <Settings size={18} strokeWidth={2} />
            <span>Settings</span>
          </button>
          <button className={`${itemBase} ${itemInactive}`}>
            <HelpCircle size={18} strokeWidth={2} />
            <span>Help &amp; Support</span>
          </button>
          <div className="flex items-center gap-2.5 px-2 pt-2.5 pb-0.5">
            <Avatar initials={currentUser.initials} color="var(--accent-purple)" size={36} />
            <div className="flex min-w-0 flex-col">
              <span className="text-ink truncate text-[13px] font-semibold">
                {currentUser.name}
              </span>
              <span className="text-faint text-[11.5px]">{currentUser.role}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
