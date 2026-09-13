import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/global.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext'
import { ThemeProvider } from './theme/ThemeContext'
import { UsersProvider } from './data/UsersContext'
import { NotificationsProvider } from './data/NotificationsContext'
import { ToastProvider } from './components/ui/Toast'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <UsersProvider>
            <NotificationsProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </NotificationsProvider>
          </UsersProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
