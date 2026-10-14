// Mirrors backend.dto.PasswordPolicy — kept in sync by hand since frontend
// and backend don't share code. The backend re-checks this regardless (see
// RegisterRequest/ChangePasswordRequest/UserCreateRequest), so this is only
// for giving the user an immediate message instead of a round-trip error.
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'At least 8 characters, with an uppercase letter, a lowercase letter, a number, and a special character'

// Individual rules behind PASSWORD_PATTERN, used for the live checklist.
export const PASSWORD_RULES = [
  { id: 'length', label: '8+ characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: '1 uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: '1 lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'digit', label: '1 number', test: (p) => /\d/.test(p) },
  { id: 'special', label: '1 special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export function isPasswordComplex(password) {
  return PASSWORD_PATTERN.test(password ?? '')
}

// Names the specific rules a password is missing, e.g.
// "Password needs an uppercase letter and a number."
export function describePasswordProblem(password) {
  const value = password ?? ''
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.label)
  if (missing.length === 0) return ''
  return `Password is too weak — it still needs: ${missing.join(', ')}.`
}

// Turns a backend ApiError into a readable message. The backend answers
// validation failures with a generic "One or more fields are invalid" plus a
// fieldErrors map, so prefer the password field's own message when present.
export function passwordErrorMessage(err, fallback) {
  const fieldErrors = err?.fieldErrors
  const passwordField = fieldErrors && (fieldErrors.password ?? fieldErrors.newPassword)
  if (passwordField) return passwordField
  if (fieldErrors && Object.keys(fieldErrors).length > 0) return Object.values(fieldErrors)[0]
  return err?.message || fallback
}
