import { Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { ErrorPage } from '../pages/ErrorPage'

// Route guard for pages that need a system-wide permission, e.g.
//   <Route element={<RequirePermission resource="REPORT" action="GENERATE_REPORTS" />}>
// Navigation links to these pages are already hidden when the permission is
// missing; this covers someone typing the address by hand. The server still
// checks every request the page makes, so this is a courtesy, not the lock.
export function RequirePermission({ resource, action, anywhere = false }) {
  const { canSys, canAny } = useAuth()
  // anywhere: held through the system role or through the role in any project (Reports)
  if (anywhere ? canAny(resource, action) : canSys(resource, action)) return <Outlet />
  return <ErrorPage status={403} />
}
