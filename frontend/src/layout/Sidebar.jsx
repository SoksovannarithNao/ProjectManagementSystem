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
} from 'lucide-react'
import { Avatar } from '../components/ui/Avatar'
import { currentUser } from '../data/mockData'
import { useLayout } from './useLayout'
import './Sidebar.css'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'My Tasks', icon: ListChecks },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/kanban', label: 'Kanban Board', icon: Columns3 },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
]

export function Sidebar() {
  const { mobileNavOpen, closeMobileNav } = useLayout()

  return (
    <>
      {mobileNavOpen && <div className="sidebar-backdrop" onClick={closeMobileNav} />}
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__top">
          <div className="sidebar__brand">
            <span className="sidebar__logo" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="1" y="1" width="8" height="8" rx="2.5" fill="#242426" />
                <rect x="11" y="1" width="8" height="8" rx="2.5" fill="#AEB9D2" />
                <rect x="1" y="11" width="8" height="8" rx="2.5" fill="#AEB9D2" />
                <rect x="11" y="11" width="8" height="8" rx="2.5" fill="#242426" />
              </svg>
            </span>
            <span className="sidebar__brand-name">TaskFlow</span>
          </div>
          <button className="sidebar__close" onClick={closeMobileNav} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar__nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              onClick={closeMobileNav}
            >
              <item.icon size={18} strokeWidth={2} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__bottom">
          <button className="sidebar__item sidebar__item--plain">
            <Settings size={18} strokeWidth={2} />
            <span>Settings</span>
          </button>
          <button className="sidebar__item sidebar__item--plain">
            <HelpCircle size={18} strokeWidth={2} />
            <span>Help &amp; Support</span>
          </button>
          <div className="sidebar__profile">
            <Avatar initials={currentUser.initials} color="var(--accent-purple)" size={36} />
            <div className="sidebar__profile-info">
              <span className="sidebar__profile-name">{currentUser.name}</span>
              <span className="sidebar__profile-role">{currentUser.role}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
