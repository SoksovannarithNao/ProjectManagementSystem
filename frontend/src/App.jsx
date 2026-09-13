import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { VerifyOtp } from './pages/VerifyOtp'
import { Dashboard } from './pages/Dashboard'
import { Projects } from './pages/Projects'
import { Tasks } from './pages/Tasks'
import { Kanban } from './pages/Kanban'
import { Calendar } from './pages/Calendar'
import { Reports } from './pages/Reports'
import { Team } from './pages/Team'
import { Profile } from './pages/Profile'
import { Settings } from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/kanban" element={<Kanban />} />
          <Route path="/team" element={<Team />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
