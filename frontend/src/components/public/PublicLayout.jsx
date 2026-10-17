import { useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Logo } from '../ui/Logo'
import { ThemeToggle } from '../ui/ThemeToggle'
import { PUBLIC_PATHS, SITE } from '../../config/site'

const navLinkClass = ({ isActive }) =>
  `rounded-md px-2.5 py-1.5 text-[13px] font-semibold hover:bg-subtle ${isActive ? 'text-ink' : 'text-muted'}`

// The frame of the pages anyone can open without signing in: home, privacy policy, terms of service.
// A skip link, a labelled navigation, one <main>, and a footer that always carries the legal links.
export function PublicLayout({ title, children }) {
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    document.title = title ? `${title} — ${SITE.name}` : SITE.name
  }, [title])

  return (
    <div className="bg-canvas text-ink flex min-h-svh flex-col">
      <a
        href="#main"
        className="bg-card text-ink focus:shadow-pop sr-only rounded-md px-3 py-2 text-[13px] font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      <header className="border-divider bg-card border-b">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-3 px-6 py-3.5 max-sm:px-4">
          <Link to={PUBLIC_PATHS.home} className="flex items-center gap-2.5" aria-label={`${SITE.name} home`}>
            <Logo size={22} />
            <span className="text-[18px] font-bold tracking-[-0.02em]">{SITE.name}</span>
          </Link>

          <nav aria-label="Main" className="flex items-center gap-1 max-sm:hidden">
            <NavLink to={PUBLIC_PATHS.home} end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to={PUBLIC_PATHS.privacy} className={navLinkClass}>
              Privacy Policy
            </NavLink>
            <NavLink to={PUBLIC_PATHS.terms} className={navLinkClass}>
              Terms of Service
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link to="/" className="btn btn-primary">
                Open {SITE.name}
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-secondary">
                  Sign in
                </Link>
                <Link to="/register" className="btn btn-primary max-sm:hidden">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>

      <footer className="border-divider bg-card border-t">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-6 text-[12px] max-sm:px-4">
          <p className="text-muted">
            &copy; {new Date().getFullYear()} {SITE.name}
          </p>
          <nav aria-label="Legal and contact" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to={PUBLIC_PATHS.privacy} className="text-ink font-semibold hover:underline">
              Privacy Policy
            </Link>
            <Link to={PUBLIC_PATHS.terms} className="text-ink font-semibold hover:underline">
              Terms of Service
            </Link>
            <a href={`mailto:${SITE.contactEmail}`} className="text-ink font-semibold hover:underline">
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
