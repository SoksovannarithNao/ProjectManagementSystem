import { Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { ErrorPage } from '../pages/ErrorPage'

// Route guard for pages that only the Administrator role may open (the audit log). Like
// RequirePermission it is a courtesy for someone typing the address: the server checks again.
export function RequireAdministrator() {
  const { isAdministrator } = useAuth()
  return isAdministrator ? <Outlet /> : <ErrorPage status={403} />
}
