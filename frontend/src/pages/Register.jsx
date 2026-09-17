import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { PASSWORD_REQUIREMENTS_MESSAGE, isPasswordComplex } from '../api/validation'

export function Register() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!isPasswordComplex(password)) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const result = await register({ username: username.trim(), email: email.trim(), password, confirmPassword })
      navigate('/verify-otp', { state: { username: result.username, email: result.email } })
    } catch (err) {
      setError(err.message || 'Failed to create account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-canvas relative flex min-h-svh items-center justify-center overflow-hidden px-4">
      <div
        className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--accent-lavender), transparent 70%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 -bottom-32 h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--accent-purple), transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="card animate-scale-in relative w-full max-w-[380px] px-8 py-9">
        <div className="mb-7 flex items-center gap-2.5">
          <span className="inline-flex" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
              <rect x="1" y="1" width="8" height="8" rx="2.5" fill="#242426" />
              <rect x="11" y="1" width="8" height="8" rx="2.5" fill="#AEB9D2" />
              <rect x="1" y="11" width="8" height="8" rx="2.5" fill="#AEB9D2" />
              <rect x="11" y="11" width="8" height="8" rx="2.5" fill="#242426" />
            </svg>
          </span>
          <span className="text-ink text-[18px] font-bold tracking-[-0.02em]">TaskFlow</span>
        </div>
        <h1 className="text-ink mb-1 text-xl font-bold tracking-[-0.015em]">Create Account</h1>
        <p className="text-muted mb-6 text-[13px]">Set up a new TaskFlow account.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12.5px] font-semibold">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-subtle border-border focus:border-lavender h-11 rounded-md border px-3.5 text-[13.5px] outline-none"
              autoComplete="username"
              minLength={3}
              maxLength={50}
              pattern="[A-Za-z0-9._-]+"
              title="Letters, numbers, dots, underscores, and hyphens only"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12.5px] font-semibold">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-subtle border-border focus:border-lavender h-11 rounded-md border px-3.5 text-[13.5px] outline-none"
              autoComplete="email"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12.5px] font-semibold">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-subtle border-border focus:border-lavender h-11 rounded-md border px-3.5 text-[13.5px] outline-none"
              autoComplete="new-password"
              required
            />
            <span className="text-faint text-[11.5px]">{PASSWORD_REQUIREMENTS_MESSAGE}</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12.5px] font-semibold">Confirm Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-subtle border-border focus:border-lavender h-11 rounded-md border px-3.5 text-[13.5px] outline-none"
              autoComplete="new-password"
              required
            />
          </label>
          {error && <p className="text-danger text-[12.5px] font-semibold">{error}</p>}
          <button type="submit" className="btn btn-primary mt-2 justify-center py-[11px]" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-muted mt-5 text-center text-[12.5px]">
          Already have an account?{' '}
          <Link to="/login" className="text-ink font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
