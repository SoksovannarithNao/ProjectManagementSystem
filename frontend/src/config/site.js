// Facts the public pages (home, privacy policy, terms of service) print. Change them here, in one place.
// The Google OAuth consent screen must use the same three URLs (see docs/google-oauth-verification.md).
export const SITE = {
  name: 'TaskFlow',
  url: 'https://www.task-flow.lat',
  // Who runs this deployment, and where to write for data requests (access, correction, deletion).
  operator: 'Sovannarith',
  contactEmail: 'sovannarithnao@gmail.com',
  // Bump these when the text of the page changes in substance.
  privacyUpdated: '2026-10-17',
  termsUpdated: '2026-10-17',
}

export const PUBLIC_PATHS = {
  home: '/',
  privacy: '/privacy-policy',
  terms: '/terms-of-service',
}
