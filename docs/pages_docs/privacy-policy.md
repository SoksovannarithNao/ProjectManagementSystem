# Privacy Policy

**Route** `/privacy-policy` · **Access** public (signed in or not) · **Source** [PrivacyPolicy.jsx](../../frontend/src/pages/PrivacyPolicy.jsx), layout [LegalDocument.jsx](../../frontend/src/components/public/LegalDocument.jsx)

## What it does
States what personal data TaskFlow handles, why, who else receives it, how it is protected and kept, and how to ask for access, correction or deletion.

## What it says, and where each claim comes from
| Section | Based on |
|---|---|
| What we collect | the `users` table (name, username, e-mail, password hash, optional gender, date of birth, phone, photo, position, department, status, preferences), project content tables, `activity_logs`, `notifications`, `audit_logs`, `refresh_tokens`, `otp_verifications`, `user_identities`; the browser's `localStorage` keys (`taskflow.auth` username and role, `taskflow.theme`, last-activity time); no analytics or advertising scripts exist in `frontend/` |
| Who can see your information | `UserService` visibility (administrator, yourself, or someone who shares an active project); profile photos served from an unguessable public address (`PhotoController`) |
| Service providers | Vercel (frontend), Render (backend), Neon (database, Singapore region), Google (Google Fonts in `index.html`; Google's sign-in script and button on the sign-in and Profile pages when the feature is on; the Gmail API in `MailService`) |
| Google sign-in and Google user data | the optional Google sign-in and sign-up (`sub` and the verified e-mail are kept in `user_identities`, and the Google name becomes the full name of an account Google creates; disconnecting or deleting the account removes the link; the picture is not read) and, separately, the one operator-authorised `gmail.send` grant that sends e-mail ([../google-sign-in.md](../google-sign-in.md), [../google-oauth-verification.md](../google-oauth-verification.md)) |
| How we protect it | BCrypt, hashed tokens and codes, 15-minute access token, httpOnly `SameSite=Strict` refresh cookie, idle sign-out, server-side permission checks, sign-in lock-out, least-privilege database role |
| How long we keep it, and deletion | foreign keys in `01-init.sql`: what `ON DELETE CASCADE` removes (profile, memberships, assignments, comments, time entries, notifications, sessions, codes, a connected Google account) and what `SET NULL` keeps (tasks, checklist items, files, approvals, activity entries); a user who manages a project cannot be deleted (`RESTRICT`); unverified registrations are deleted after 24 hours |

## Notes
- It names the operator and the contact e-mail from `config/site.js`; there is no self-service delete button, so deletion is requested by e-mail.
- Keep it in step with the code: a new provider, a new kind of data or a changed retention rule means editing the page and `privacyUpdated` in `config/site.js`.
- It is a plain-language policy written from the application's behaviour, not legal advice; it names no governing law or postal address.
