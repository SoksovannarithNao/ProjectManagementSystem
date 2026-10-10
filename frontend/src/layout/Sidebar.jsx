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
  ShieldCheck,
  UserCog,
  X,
} from 'lucide-react'
import { useLayout } from './useLayout'
import { useAuth } from '../auth/AuthContext'
import { Logo } from '../components/ui/Logo'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'Tasks', icon: ListChecks },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/kanban', label: 'Kanban Board', icon: Columns3 },
  { to: '/team', label: 'Team', icon: Users },
  // `needs` hides the link unless the user holds that system permission
  // (see api/permissions.js). The route is guarded too (RequirePermission).
  { to: '/reports', label: 'Reports', icon: BarChart3, needs: ['REPORT', 'GENERATE_REPORTS'], anywhere: true },
]

// Administration: shown only to someone who may view users / roles.
const adminItems = [
  { to: '/admin/users', label: 'Users', icon: UserCog, needs: ['USER', 'VIEW'] },
  { to: '/admin/roles', label: 'Roles & Permissions', icon: ShieldCheck, needs: ['ROLE', 'VIEW'] },
]

const itemBase =
  'flex h-[42px] w-full items-center gap-[11px] rounded-md border-none px-3 text-left text-[13px] font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] [&_svg]:shrink-0 [&_svg]:transition-colors [&_svg]:duration-[var(--duration-fast)] [&_svg]:ease-[var(--ease-standard)]'
const itemInactive =
  'bg-transparent text-muted [&_svg]:text-faint hover:bg-canvas hover:text-ink hover:[&_svg]:text-ink'
const itemActive =
  'bg-charcoal text-on-charcoal shadow-[0_6px_16px_rgba(36,36,38,.22)] [&_svg]:text-on-charcoal hover:bg-charcoal hover:text-on-charcoal hover:[&_svg]:text-on-charcoal'

export function Sidebar() {
  const { mobileNavOpen, closeMobileNav } = useLayout()
  const { canSys, canAny } = useAuth()
  // `anywhere`: the permission may come from the system role OR from the role held in any project
  const visibleNav = navItems.filter(
    (item) => !item.needs || (item.anywhere ? canAny(...item.needs) : canSys(...item.needs))
  )
  const visibleAdmin = adminItems.filter((item) => canSys(...item.needs))

  return (
    <>
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-[39] hidden bg-scrim max-lg:block"
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
            <Logo size={20} />
            <span className="text-ink text-[17px] font-bold tracking-[-0.02em]">TaskFlow</span>
          </div>
          <button
            className="text-muted hidden p-2.5 -m-2.5 max-lg:inline-flex"
            onClick={closeMobileNav}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex flex-col gap-[3px]">
          {visibleNav.map((item) => (
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

        {visibleAdmin.length > 0 && (
          <nav className="mt-5 flex flex-col gap-[3px]" aria-label="Administration">
            <span className="text-faint mb-1 px-3 text-[12px] font-semibold">Administration</span>
            {visibleAdmin.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `${itemBase} ${isActive ? itemActive : itemInactive}`}
                onClick={closeMobileNav}
              >
                <item.icon size={18} strokeWidth={2} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        )}

        <div className="border-divider mt-auto flex flex-col gap-[3px] border-t pt-3.5">
          <NavLink
            to="/settings"
            className={({ isActive }) => `${itemBase} ${isActive ? itemActive : itemInactive}`}
            onClick={closeMobileNav}
          >
            <Settings size={18} strokeWidth={2} />
            <span>Settings</span>
          </NavLink>
          <NavLink
            to="/help"
            className={({ isActive }) => `${itemBase} ${isActive ? itemActive : itemInactive}`}
            onClick={closeMobileNav}
          >
            <HelpCircle size={18} strokeWidth={2} />
            <span>Help &amp; Support</span>
          </NavLink>
        </div>
      </aside>
    </>
  )
}
