import { useState } from 'react'

// The step after Google for a person who has no TaskFlow account yet: choose a username (the e-mail address
// and name come from Google). The server refuses a username that is taken, and the message is shown here.
export function GoogleSignupForm({ email, busy, error, onSubmit, onCancel }) {
  const [username, setUsername] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(username.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="google-signup-form">
      <p className="text-muted -mt-2 text-[13px]">
        Creating a TaskFlow account for <span className="text-ink font-semibold break-all">{email}</span>, confirmed by
        Google.
      </p>
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
          autoFocus
          required
        />
        <span className="text-faint text-[12px]">3 to 50 letters, numbers, dots, underscores or hyphens. It cannot be changed later.</span>
      </label>
      {error && (
        <p role="alert" className="text-danger-ink text-[12px] font-semibold">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary mt-2 justify-center py-[11px]" disabled={busy || username.trim().length < 3}>
        {busy ? 'Creating account…' : 'Create account'}
      </button>
      <button type="button" className="text-ink text-center text-[12px] font-semibold hover:underline" onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}
