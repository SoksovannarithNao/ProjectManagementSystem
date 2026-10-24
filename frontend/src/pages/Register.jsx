import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { describePasswordProblem, isPasswordComplex, passwordErrorMessage } from '../api/validation'
import { PasswordChecklist } from '../components/ui/PasswordChecklist'
import { Logo } from '../components/ui/Logo'
import { GoogleButton } from '../components/GoogleButton'
import { GoogleSignupForm } from '../components/GoogleSignupForm'
import { useGoogleClientId } from '../api/useGoogleClientId'
import { useGoogleSignIn } from '../auth/useGoogleSignIn'

export function Register() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // "Continue with Google" appears only when the server was given an OAuth client ID.
  const googleClientId = useGoogleClientId()
  const google = useGoogleSignIn()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!isPasswordComplex(password)) {
      setError(describePasswordProblem(password))
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
      setError(passwordErrorMessage(err, 'Failed to create account'))
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
        <h1 className="text-ink mb-1 text-xl font-bold tracking-[-0.015em]">{google.signup ? 'Choose a username' : 'Create Account'}</h1>
        <p className="text-muted mb-6 text-[13px]">{google.signup ? 'One last step to create your account.' : 'Set up a new TaskFlow account.'}</p>

        {google.signup ? (
          <GoogleSignupForm
            email={google.signup.email}
            busy={google.busy}
            error={google.error}
            onSubmit={google.submitUsername}
            onCancel={google.cancel}
          />
        ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="field field-lg"
              autoComplete="username"
              minLength={3}
              maxLength={50}
              pattern="[A-Za-z0-9._-]+"
              title="Letters, numbers, dots, underscores, and hyphens only"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field field-lg"
              autoComplete="email"
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
              autoComplete="new-password"
              required
            />
            <PasswordChecklist password={password} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Confirm Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="field field-lg"
              autoComplete="new-password"
              required
            />
          </label>
          {error && <p className="text-danger-ink text-[12px] font-semibold">{error}</p>}
          <button type="submit" className="btn btn-primary mt-2 justify-center py-[11px]" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
        )}

        {!google.signup && googleClientId && (
          <>
            <div className="text-faint my-5 flex items-center gap-3 text-[11px] font-semibold uppercase">
              <span className="bg-border h-px flex-1" />
              or
              <span className="bg-border h-px flex-1" />
            </div>
            <GoogleButton clientId={googleClientId} onCredential={google.onCredential} text="signup_with" />
            {google.error && (
              <p role="alert" className="text-danger-ink mt-3 text-[12px] font-semibold">
                {google.error}
              </p>
            )}
          </>
        )}

        <p className="text-muted mt-5 text-center text-[12px]">
          Already have an account?{' '}
          <Link to="/login" className="text-ink font-semibold hover:underline">
            Sign in
          </Link>
        </p>

        <p className="text-muted mt-4 text-center text-[11px]">
          By creating an account you agree to the{' '}
          <Link to="/terms-of-service" className="hover:text-ink underline">
            Terms of Service
          </Link>{' '}
          and acknowledge the{' '}
          <Link to="/privacy-policy" className="hover:text-ink underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
