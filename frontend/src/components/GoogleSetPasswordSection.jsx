import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useToast } from './ui/Toast'
import { GoogleButton } from './GoogleButton'
import { PasswordChecklist } from './ui/PasswordChecklist'
import { useGoogleClientId } from '../api/useGoogleClientId'
import { useAuth } from '../auth/AuthContext'
import { setPasswordWithGoogle } from '../api/users'
import { describePasswordProblem, isPasswordComplex, passwordErrorMessage } from '../api/validation'

// Profile page, instead of the Password card, for an account that Google created: it has no password yet (there
// is no current password to ask for), so the person chooses one and confirms it by choosing their Google account
// again. Afterwards the account has a password like any other and the usual Password card takes this one's place.
export function GoogleSetPasswordSection() {
  const notify = useToast()
  const { refreshProfile } = useAuth()
  const clientId = useGoogleClientId()
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (credential) => {
    setError('')
    if (!isPasswordComplex(newPassword)) {
      setError(describePasswordProblem(newPassword))
      return
    }
    if (newPassword !== confirmNewPassword) {
      setError('New password and confirmation do not match')
      return
    }
    setBusy(true)
    try {
      await setPasswordWithGoogle(credential, newPassword, confirmNewPassword)
      notify('Password set', { tone: 'success' })
      await refreshProfile()
    } catch (err) {
      setError(passwordErrorMessage(err, 'Failed to set the password'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card px-6 py-5" data-testid="set-password-section">
      <div className="mb-4 flex items-center gap-2.5">
        <Lock size={17} className="text-muted" />
        <h3 className="section-title text-base">Set a password</h3>
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-faint text-[12px]">
          This account was created with Google, so it has no password yet. Set one to also sign in with your username or
          e-mail address. You confirm it by choosing your Google account again.
        </p>
        <div className="flex gap-3 max-[520px]:flex-col">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="field"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">Confirm new password</span>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              autoComplete="new-password"
              className="field"
            />
          </label>
        </div>
        <PasswordChecklist password={newPassword} className="-mt-2" />

        {clientId ? (
          <div className="sm:w-65">
            <GoogleButton clientId={clientId} onCredential={save} text="continue_with" />
          </div>
        ) : (
          <p className="text-faint text-[12px]">
            Google sign-in is switched off on this server right now, so ask an administrator to set a password for you.
          </p>
        )}

        {error && (
          <p role="alert" className="text-danger-ink text-[12px] font-semibold">
            {error}
          </p>
        )}
        {busy && <p className="text-faint text-[12px]">Setting the password…</p>}
      </div>
    </section>
  )
}
