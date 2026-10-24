import { useId, useState } from 'react'
import { Link2 } from 'lucide-react'
import { useToast } from './ui/Toast'
import { Badge } from './ui/Badge'
import { GoogleButton } from './GoogleButton'
import { useGoogleClientId } from '../api/useGoogleClientId'
import { useApi } from '../api/useApi'
import { useAuth } from '../auth/AuthContext'
import { getGoogleStatus, linkGoogle, unlinkGoogle } from '../api/users'

// Profile page: connect a Google account to this TaskFlow account so it can be used to sign in. Shown only
// when the server has "Sign in with Google" switched on. Connecting needs the current password (proof that
// the account is yours, and a stolen session alone cannot do it); disconnecting is always allowed because
// the password keeps working.
export function GoogleSignInSection() {
  const notify = useToast()
  const clientId = useGoogleClientId()
  const { data: status, refetch } = useApi(getGoogleStatus)
  const { profile } = useAuth()
  // An account Google created has no password until the person sets one: it keeps its Google connection.
  const mustKeepGoogle = profile?.passwordSet === false
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const hintId = useId()
  const errorId = useId()

  if (!status?.enabled || !clientId) return null

  const connect = async (credential) => {
    setError('')
    if (!password) {
      setError('Enter your current password first, then choose your Google account.')
      return
    }
    setBusy(true)
    try {
      await linkGoogle(credential, password)
      setPassword('')
      notify('Google account connected', { tone: 'success' })
      refetch()
    } catch (err) {
      setError(err.message || 'Failed to connect the Google account')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setError('')
    setBusy(true)
    try {
      await unlinkGoogle()
      notify('Google account disconnected', { tone: 'success' })
      refetch()
    } catch (err) {
      setError(err.message || 'Failed to disconnect the Google account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card px-6 py-5" data-testid="google-section">
      <div className="mb-4 flex items-center gap-2.5">
        <Link2 size={17} className="text-muted" />
        <h3 className="section-title text-base">Sign in with Google</h3>
      </div>

      {status.linked ? (
        <>
        <div className="flex items-center justify-between gap-x-4 gap-y-3 max-[520px]:flex-col max-[520px]:items-start">
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <Badge tone="done">Connected</Badge>
            <p className="text-ink max-w-full text-[13px]">
              {status.email ? <span className="font-semibold break-all">{status.email}</span> : 'A Google account'}
              <span className="text-faint">
                {mustKeepGoogle ? ' · you sign in with Google.' : ' · you can sign in with Google or with your password.'}
              </span>
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={disconnect}
            disabled={busy || mustKeepGoogle}
            aria-describedby={mustKeepGoogle ? hintId : undefined}
          >
            Disconnect
          </button>
        </div>
        {mustKeepGoogle && (
          <p id={hintId} className="text-faint mt-3 text-[12px]">
            Set a password first (above), or you would have no way to sign in.
          </p>
        )}
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <p id={hintId} className="text-faint text-[12px]">
            Connect a Google account to sign in with one click. Your password keeps working. Enter it to confirm this
            account is yours, then choose the Google account.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-muted text-[12px] font-semibold">Current password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                aria-invalid={error ? true : undefined}
                className="field"
              />
            </label>
            <div className="min-w-0 sm:w-65 sm:shrink-0">
              <GoogleButton clientId={clientId} onCredential={connect} text="continue_with" />
            </div>
          </div>
        </div>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-danger-ink mt-3 text-[12px] font-semibold">
          {error}
        </p>
      )}
    </section>
  )
}
