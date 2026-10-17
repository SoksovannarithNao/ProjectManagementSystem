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

export function register(request) {
  return apiFetch('/auth/register', { method: 'POST', body: request, skipAuth: true })
}

export function verifyOtp(username, otp) {
  return apiFetch('/auth/verify-otp', { method: 'POST', body: { username, otp }, skipAuth: true })
}

export function resendOtp(username) {
  return apiFetch('/auth/resend-otp', { method: 'POST', body: { username }, skipAuth: true })
}
