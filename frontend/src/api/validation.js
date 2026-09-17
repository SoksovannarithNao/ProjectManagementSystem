// Mirrors backend.dto.PasswordPolicy — kept in sync by hand since frontend
// and backend don't share code. The backend re-checks this regardless (see
// RegisterRequest/ChangePasswordRequest/UserCreateRequest), so this is only
// for giving the user an immediate message instead of a round-trip error.
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'At least 8 characters, with an uppercase letter, a lowercase letter, a number, and a special character'

export function isPasswordComplex(password) {
  return PASSWORD_PATTERN.test(password ?? '')
}
