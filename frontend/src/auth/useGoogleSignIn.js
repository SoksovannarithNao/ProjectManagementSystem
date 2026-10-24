import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

// What the sign-in and create-account pages share for "Sign in with Google": the ID token from Google's button
// goes to the server, which answers with a session (an account connected to that Google account), an
// administrator's code challenge (onChallenge), or an offer to create an account, in which case the page asks
// for a username (signup) and submitUsername creates it. The server decides every case; this only carries it.
export function useGoogleSignIn({ onChallenge } = {}) {
  const { loginWithGoogle, registerWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // { credential, email, name } while the page is asking for a username.
  const [signup, setSignup] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const finish = () => navigate(location.state?.from?.pathname || '/', { replace: true })

  const onCredential = async (credential) => {
    setError('')
    setBusy(true)
    try {
      const result = await loginWithGoogle(credential)
      if (result?.twoFactorRequired) {
        onChallenge?.(result)
        return
      }
      if (result?.signupRequired) {
        setSignup({ credential, email: result.email, name: result.name })
        return
      }
      finish()
    } catch (err) {
      setError(err.message || 'Google sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  const submitUsername = async (username) => {
    setError('')
    setBusy(true)
    try {
      await registerWithGoogle(signup.credential, username)
      finish()
    } catch (err) {
      setError(err.message || 'Failed to create the account')
    } finally {
      setBusy(false)
    }
  }

  const cancel = () => {
    setSignup(null)
    setError('')
  }

  return { signup, error, busy, onCredential, submitUsername, cancel }
}
