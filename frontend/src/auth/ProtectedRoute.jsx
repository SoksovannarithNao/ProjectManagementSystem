import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Landing } from '../pages/Landing'

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!isAuthenticated) {
    // The home page is public: a signed-out visitor to "/" sees the landing page (a signed-in one gets the
    // dashboard). Every other protected address still sends them to sign in.
    if (location.pathname === '/') return <Landing />
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
