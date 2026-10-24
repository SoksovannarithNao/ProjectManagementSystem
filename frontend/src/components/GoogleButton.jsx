import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../theme/ThemeContext'

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
// Google draws its button at a width between these (pixels).
const MIN_WIDTH = 200
const MAX_WIDTH = 400

// Google's script, added once and only when the button is wanted.
let scriptPromise = null

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.onload = resolve
      script.onerror = () => {
        scriptPromise = null
        reject(new Error('Google sign-in could not be loaded'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

// Whether the page is showing the dark theme right now: the chosen theme, or the device's when it is System.
function useIsDark() {
  const { theme } = useTheme()
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return theme === 'DARK' || (theme === 'SYSTEM' && systemDark)
}

// Google's "Sign in with Google" button. Choosing an account gives onCredential the signed ID token,
// which the server checks; nothing in the browser decides who the person is. It is Google's own button
// (the logo and wording are Google's), drawn as wide as the space it is given and in the dark or light
// variant of the page's theme, 40px high like the app's fields. Renders nothing if the script is blocked
// or cannot load, so the password form is always still there.
export function GoogleButton({ clientId, onCredential, text = 'signin_with' }) {
  const holder = useRef(null)
  const latestCallback = useRef(onCredential)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [width, setWidth] = useState(0)
  const dark = useIsDark()

  useEffect(() => {
    latestCallback.current = onCredential
  }, [onCredential])

  // Follows the width of the space the button sits in (a phone is narrower than a desktop card).
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.floor(entry.contentRect.width))))
    })
    observer.observe(holder.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    loadGoogleScript()
      .then(() => {
        if (cancelled) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => latestCallback.current?.(response.credential),
        })
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  useEffect(() => {
    if (!ready || !width || !holder.current) return
    window.google.accounts.id.renderButton(holder.current, {
      type: 'standard',
      theme: dark ? 'filled_black' : 'outline',
      size: 'large',
      text,
      shape: 'rectangular',
      logo_alignment: 'left',
      // The app is in English, so the button is too (Google would otherwise follow the browser's language).
      locale: 'en',
      width,
    })
  }, [ready, width, dark, text])

  if (failed) return null
  // On the dark theme Google's black button is barely darker than the card, so it gets the same hairline
  // border the app's fields have (a ring, so the layout does not move).
  return (
    <div
      ref={holder}
      data-testid="google-button"
      className={`flex min-h-10 w-full justify-center rounded-[4px] ${dark ? 'ring-border ring-1' : ''}`}
    />
  )
}
