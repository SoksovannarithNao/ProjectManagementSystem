import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { clearIdleSignOutNotice, wasSignedOutForInactivity } from '../auth/idleTimeout'
import { Logo } from '../components/ui/Logo'

export function Login() {
  const { login, loginWithCode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  // Set after a correct password when an administrator still has to enter the e-mailed code.
  const [challenge, setChallenge] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Why the user landed here, when the app signed them out for inactivity.
  const [idleNotice] = useState(wasSignedOutForInactivity)
  useEffect(() => clearIdleSignOutNotice(), [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await login(username, password)
      if (result?.twoFactorRequired) {
        setChallenge(result)
        setPassword('')
        return
      }
      const redirectTo = location.state?.from?.pathname || '/'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Invalid username or password')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCodeSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await loginWithCode(challenge.username, code)
      const redirectTo = location.state?.from?.pathname || '/'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Invalid sign-in code')
    } finally {
      setSubmitting(false)
    }
  }

  const backToPassword = () => {
    setChallenge(null)
    setCode('')
    setError('')
  }

  return (
    <div className="bg-canvas relative flex min-h-svh items-center justify-center overflow-hidden px-4">

      <div className="card animate-scale-in relative w-full max-w-[380px] px-8 py-9">
        <div className="mb-7 flex items-center gap-2.5">
          <Logo size={22} />
          <span className="text-ink text-[18px] font-bold tracking-[-0.02em]">TaskFlow</span>
        </div>
        <h1 className="text-ink mb-1 text-xl font-bold tracking-[-0.015em]">{challenge ? 'Enter your sign-in code' : 'Sign in'}</h1>
        <p className="text-muted mb-6 text-[13px]">
          {challenge ? (
            <>
              We e-mailed a 6-digit code to <span className="text-ink font-semibold">{challenge.maskedEmail}</span>.
            </>
          ) : (
            'Use your TaskFlow account to continue.'
          )}
        </p>
        {idleNotice && (
          <p
            role="status"
            data-testid="idle-signed-out"
            className="bg-warning-soft text-warning-ink mb-5 rounded-md px-3 py-2.5 text-[12px] font-semibold"
          >
            You were signed out because there was no activity for a while. Sign in again to continue.
          </p>
        )}

        {challenge ? (
          <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-muted text-[12px] font-semibold">Sign-in code</span>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="field field-lg text-center text-lg tracking-[0.3em]"
                placeholder="······"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </label>
            {error && <p className="text-danger-ink text-[12px] font-semibold">{error}</p>}
            <button type="submit" className="btn btn-primary mt-2 justify-center py-[11px]" disabled={submitting || code.length !== 6}>
              {submitting ? 'Verifying…' : 'Verify and sign in'}
            </button>
            <button type="button" className="text-ink text-center text-[12px] font-semibold hover:underline" onClick={backToPassword}>
              Back to sign in
            </button>
          </form>
        ) : (
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
        )}

        {!challenge && (
          <p className="text-muted mt-5 text-center text-[12px]">
            Don't have an account?{' '}
            <Link to="/register" className="text-ink font-semibold hover:underline">
              Create account
            </Link>
          </p>
        )}

        <p className="text-muted mt-4 text-center text-[11px]">
          <Link to="/privacy-policy" className="hover:text-ink underline">
            Privacy Policy
          </Link>
          {' \u00b7 '}
          <Link to="/terms-of-service" className="hover:text-ink underline">
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  )
}
