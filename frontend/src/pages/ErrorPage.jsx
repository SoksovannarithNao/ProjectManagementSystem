import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, LifeBuoy, LockKeyhole, SearchX, ServerCrash, ShieldAlert, TimerOff, WifiOff } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'

// What each HTTP status means to the person looking at it. Status 0 is the
// api client's own code for "the server could not be reached" (api/client.js).
const NOT_FOUND = { icon: SearchX, title: 'Page not found', message: 'It may have been deleted or moved, or you may not have access to it.' }
const UNAVAILABLE = {
  icon: ServerCrash,
  title: 'Service unavailable',
  message: 'The server is not answering right now. Please try again in a moment.',
}
const ERRORS = {
  0: { icon: WifiOff, title: 'Cannot reach the server', message: 'Check your connection and try again.' },
  400: { icon: AlertTriangle, title: 'Bad request', message: 'The request could not be understood. Go back and try again.' },
  401: { icon: LockKeyhole, title: 'Please sign in', message: 'You are not signed in, or your session has ended.' },
  403: {
    icon: ShieldAlert,
    title: 'You do not have access to this page',
    message: 'Your role does not include this permission. Ask an Administrator if you need it.',
  },
  404: NOT_FOUND,
  429: { icon: TimerOff, title: 'Too many requests', message: 'Please wait a moment and try again.' },
  500: { icon: ServerCrash, title: 'Something went wrong', message: 'An unexpected error happened on our side. Please try again.' },
  502: UNAVAILABLE,
  503: UNAVAILABLE,
  504: UNAVAILABLE,
}
const UNKNOWN = { icon: AlertTriangle, title: 'Something went wrong', message: 'An unexpected error happened. Please try again.' }

// One page for every error status: rendered for an unknown address (404), at
// /error/:status, by the permission guard (403) and by pages whose data could not
// be loaded. "Try again" is offered only for failures that may pass (cannot reach
// the server, 5xx); it reloads the page unless `onRetry` says how to fetch again.
// A 404 does not say whether the page is missing or off limits: the backend
// answers 404 for both on purpose, so nobody can probe which projects exist.
export function ErrorPage({ status, onRetry }) {
  const params = useParams()
  const navigate = useNavigate()
  const code = Number(status ?? params.status)
  const info = ERRORS[code] ?? UNKNOWN
  const canRetry = code === 0 || code >= 500

  return (
    <div className="pt-10">
      <EmptyState
        icon={info.icon}
        title={info.title}
        subtitle={`${code > 0 ? `Error ${code} · ` : ''}${info.message}`}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link to="/" className="btn btn-secondary">
              Back to the dashboard
            </Link>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
              Go back
            </button>
            {canRetry && (
              <button type="button" className="btn btn-secondary" onClick={onRetry ?? (() => window.location.reload())}>
                Try again
              </button>
            )}
            <Link to="/help" className="btn btn-secondary">
              <LifeBuoy size={15} /> Help &amp; Support
            </Link>
          </div>
        }
      />
    </div>
  )
}
