import { apiFetch } from './client'

export function login(username, password) {
  return apiFetch('/auth/login', { method: 'POST', body: { username, password }, skipAuth: true })
}

// The password step answers either the session ({ token, username, role }) or, for an administrator,
// { twoFactorRequired: true, username, maskedEmail }: a code was e-mailed and the session starts only
// once verifyLoginCode accepts it.
export function verifyLoginCode(username, otp) {
  return apiFetch('/auth/login/verify', { method: 'POST', body: { username, otp }, skipAuth: true })
}

// The public OAuth client ID for the Google button ({ clientId }, null when the feature is off).
export function getGoogleConfig() {
  return apiFetch('/auth/google/config', { skipAuth: true })
}

// "Sign in with Google": the ID token Google gave the browser. Answers like login: the session, or for
// an administrator { twoFactorRequired: true, ... } and then verifyLoginCode. A Google account connected to nobody
// gets { signupRequired: true, email, name } when an account may be created from it (then googleRegister), or a 400
// that says why not (for example an account already uses that e-mail: sign in and connect Google on Profile).
export function googleLogin(credential) {
  return apiFetch('/auth/google', { method: 'POST', body: { credential }, skipAuth: true })
}

// The second half of a Google sign-up: the ID token and the username the person chose. Creates the account and
// answers like login: { token, username, role } and the refresh cookie (201). 400 when the username is taken.
export function googleRegister(credential, username) {
  return apiFetch('/auth/google/register', { method: 'POST', body: { credential, username }, skipAuth: true })
}

export function register(request) {
  return apiFetch('/auth/register', { method: 'POST', body: request, skipAuth: true })
}

export function verifyOtp(username, otp) {
  return apiFetch('/auth/verify-otp', { method: 'POST', body: { username, otp }, skipAuth: true })
}

export function resendOtp(username) {
  return apiFetch('/auth/resend-otp', { method: 'POST', body: { username }, skipAuth: true })
}
