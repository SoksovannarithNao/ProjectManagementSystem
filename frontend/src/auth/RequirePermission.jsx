import { Link, Outlet } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from './AuthContext'
import { EmptyState } from '../components/ui/EmptyState'

// Route guard for pages that need a system-wide permission, e.g.
//   <Route element={<RequirePermission resource="REPORT" action="GENERATE_REPORTS" />}>
// Navigation links to these pages are already hidden when the permission is
// missing; this covers someone typing the address by hand. The server still
// checks every request the page makes, so this is a courtesy, not the lock.
export function RequirePermission({ resource, action, anywhere = false }) {
  const { canSys, canAny } = useAuth()
  // anywhere: held through the system role or through the role in any project (Reports)
  if (anywhere ? canAny(resource, action) : canSys(resource, action)) return <Outlet />
  return (
    <div className="pt-10">
      <EmptyState
        icon={ShieldAlert}
        title="You do not have access to this page"
        subtitle="Your role does not include this permission. Ask an Administrator if you need it."
        action={
          <Link to="/" className="btn btn-secondary">
            Back to the dashboard
          </Link>
        }
      />
    </div>
  )
}
