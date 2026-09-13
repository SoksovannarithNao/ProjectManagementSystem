import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { resendOtp, verifyOtp } from '../api/auth'

const RESEND_COOLDOWN_SECONDS = 60

export function VerifyOtp() {
  const location = useLocation()
  const navigate = useNavigate()
  const username = location.state?.username
  const email = location.state?.email

  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [verified, setVerified] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!username) navigate('/register', { replace: true })
  }, [username, navigate])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  if (!username) return null

  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    setVerifying(true)
    try {
      await verifyOtp(username, otp)
      setVerified(true)
    } catch (err) {
      setError(err.message || 'Invalid verification code')
    } finally {
      setVerifying(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setResending(true)
    try {
      await resendOtp(username)
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setError(err.message || 'Failed to resend code')
    } finally {
      setResending(false)
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

        {verified ? (
          <>
            <h1 className="text-ink mb-1 text-xl font-bold tracking-[-0.015em]">Account verified</h1>
            <p className="text-muted mb-6 text-[13px]">
              Your account is ready. Sign in to continue.
            </p>
            <Link to="/login" className="btn btn-primary w-full justify-center py-[11px]">
              Continue to Sign In
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-ink mb-1 text-xl font-bold tracking-[-0.015em]">Verify Your Email</h1>
            <p className="text-muted mb-6 text-[13px]">
              Enter the code sent to {email ? <span className="text-ink font-semibold">{email}</span> : 'your email'}.
            </p>

            <form onSubmit={handleVerify} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-muted text-[12.5px] font-semibold">OTP</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="bg-subtle border-border focus:border-lavender h-11 rounded-md border px-3.5 text-center text-lg tracking-[0.3em] outline-none"
                  placeholder="······"
                  maxLength={6}
                  autoComplete="one-time-code"
                  required
                />
              </label>
              {error && <p className="text-danger text-[12.5px] font-semibold">{error}</p>}
              <button
                type="submit"
                className="btn btn-primary mt-2 justify-center py-[11px]"
                disabled={verifying || otp.length !== 6}
              >
                {verifying ? 'Verifying…' : 'Verify'}
              </button>
            </form>

            <p className="text-muted mt-5 text-center text-[12.5px]">
              Didn't receive the code?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
                className="text-ink font-semibold hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
              >
                {cooldown > 0 ? `Resend OTP (${cooldown}s)` : resending ? 'Sending…' : 'Resend OTP'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
