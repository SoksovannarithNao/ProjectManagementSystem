import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Logo } from '../components/ui/Logo'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username, password)
      const redirectTo = location.state?.from?.pathname || '/'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Invalid username or password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-canvas relative flex min-h-svh items-center justify-center overflow-hidden px-4">

      <div className="card animate-scale-in relative w-full max-w-[380px] px-8 py-9">
        <div className="mb-7 flex items-center gap-2.5">
          <Logo size={22} />
          <span className="text-ink text-[18px] font-bold tracking-[-0.02em]">TaskFlow</span>
        </div>
        <h1 className="text-ink mb-1 text-xl font-bold tracking-[-0.015em]">Sign in</h1>
        <p className="text-muted mb-6 text-[13px]">Use your TaskFlow account to continue.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Username or email</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="field field-lg"
              autoComplete="username"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field field-lg"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="text-danger-ink text-[12px] font-semibold">{error}</p>}
          <button type="submit" className="btn btn-primary mt-2 justify-center py-[11px]" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-muted mt-5 text-center text-[12px]">
          Don't have an account?{' '}
          <Link to="/register" className="text-ink font-semibold hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
