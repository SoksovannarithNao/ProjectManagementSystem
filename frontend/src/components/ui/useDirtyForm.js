import { useState } from 'react'

// Snapshots a form's field values on first render and reports whether any
// have changed since — powers Modal's "discard changes?" confirmation so it
// only appears once something has actually been edited, never on a form the
// user opened and closed untouched. Values must be primitives (the fields
// these edit forms use — text/select/date inputs); a shallow per-key
// comparison is enough for that and avoids a JSON.stringify dependency on
// key ordering. The setter is intentionally never called — `useState`'s
// lazy-initial-value semantics are just a convenient way to capture a
// snapshot once (reading a ref's `.current` during render, the other usual
// way to do this, is no longer allowed — react-hooks/refs).
export function useDirtyForm(values) {
  const [initial] = useState(values)
  return Object.keys(values).some((key) => values[key] !== initial[key])
}
