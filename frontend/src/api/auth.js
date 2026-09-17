import { apiFetch } from './client'

export function login(username, password) {
  return apiFetch('/auth/login', { method: 'POST', body: { username, password }, skipAuth: true })
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
