import { useEffect, useState } from 'react'
import { getGoogleConfig } from './auth'

// The OAuth client ID the server was given (public by design), asked for once per page load: null when
// "Sign in with Google" is switched off, so the button is simply not shown.
let configPromise = null

function loadClientId() {
  if (!configPromise) {
    configPromise = getGoogleConfig()
      .then((config) => config?.clientId ?? null)
      .catch(() => null)
  }
  return configPromise
}

// undefined while it is being asked, then the client ID or null (off, or the server could not be reached).
export function useGoogleClientId() {
  const [clientId, setClientId] = useState(undefined)
  useEffect(() => {
    let cancelled = false
    loadClientId().then((id) => {
      if (!cancelled) setClientId(id)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return clientId
}
