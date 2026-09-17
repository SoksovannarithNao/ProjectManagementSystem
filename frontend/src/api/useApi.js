import { useCallback, useEffect, useState } from 'react'

// Minimal fetch-on-mount hook: no react-query/swr dependency needed for a
// project this size. Refetches whenever `fetcher`'s identity changes, so
// callers that need to re-run on some condition should memoize `fetcher`
// with useCallback (see UsersContext.jsx re-fetching once auth is ready).
export function useApi(fetcher) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(() => {
    let cancelled = false
    // No synchronous setState here (react-hooks/set-state-in-effect) — every
    // update happens inside the promise callbacks below. `loading` starts
    // `true` for the initial fetch; a manual refetch() just leaves the prior
    // data on screen until the new result lands.
    fetcher()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetcher])

  useEffect(() => refetch(), [refetch])

  return { data, loading, error, refetch }
}
