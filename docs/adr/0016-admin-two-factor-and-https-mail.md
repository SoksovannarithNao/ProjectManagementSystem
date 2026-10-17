# ADR-0016: An e-mailed second sign-in step for administrators, and codes sent through the Gmail API when SMTP is blocked

- **Status:** Accepted
- **Date:** 2026-10-17 (migration `V22`)
- **Area:** authentication

## Context

The `ADMINISTRATOR` account can manage every user, role and project, so a stolen password gives the most damage there. The app already sends one-time codes by e-mail for self-registration ([ADR-0008](0008-self-registration-with-otp.md)), so the machinery (hashed codes, expiry, capped attempts, a resend cooldown) exists.

The app is hosted on Render (backend), Vercel (frontend) and Neon (database). Render's **free** web services block outgoing traffic on the SMTP ports (25, 465, 587), so the SMTP route that works locally (Mailpit) and with Gmail on a laptop cannot deliver a code from there. The owner wants the mail to come from their own Gmail account and to stay on the free tier.

## Decision

- **Second step for administrators only.** With `ADMIN_2FA_ENABLED=true`, a correct password for an account whose system role is `ADMINISTRATOR` does **not** start a session. `POST /api/auth/login` answers `202 { twoFactorRequired, username, maskedEmail }` and e-mails a 6-digit code; `POST /api/auth/login/verify { username, otp }` checks it and only then issues the access token and the refresh cookie. Every other role signs in as before.
- **Same code rules, separate purpose.** The code lives in `otp_verifications` with `purpose = 'LOGIN_2FA'` (migration `V22` widens the CHECK; `01-init.sql` and the Flyway baseline moved to 22). Each purpose has its own latest code, so a registration code never answers for a sign-in. A code sent less than the resend cooldown ago and still unused is kept instead of replaced, so signing in again at once does not flood the inbox.
- **The second step cannot be skipped or guessed around.** A code exists only after the right password; a wrong code counts against the same per-address-and-name lock-out as a wrong password; an unknown name, a non-administrator, an inactive account and a wrong code all answer with the same message (as in I-08).
- **Off by default.** The setting defaults to `false`: the demo administrator's address (`admin.system@taskflow.dev`) is not a real mailbox, the e2e suite signs in as the administrator with the password alone, and turning it on where mail does not reach the administrator would lock them out. It is switched on per deployment, after the administrator's e-mail is a real address and a test code arrives.
- **Mail through the Gmail API when SMTP is blocked.** `MailService` sends over SMTP (`spring.mail.*`) by default. When `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` and `GMAIL_REFRESH_TOKEN` are all set it sends through the Gmail API over HTTPS instead: the refresh token (obtained once, for the `gmail.send` scope only) is traded for a short-lived access token that is cached until shortly before it expires, and the message is posted as a base64url RFC 822 message. `MAIL_FROM` must be that Gmail address. No new library: the calls use Spring's `RestClient`, and the message is built with the Jakarta Mail classes already on the classpath. Either way a failed hand-over becomes a `MailDeliveryException`, answered `503` with a message that does not expose the provider.

## Alternatives considered

- **An authenticator app (TOTP).** Stronger than mail and needs no mail route, but needs a secret per administrator, an enrolment screen and recovery codes: more than this project's scope *(inferred)*. The purpose-column design leaves room for it.
- **Two-factor for everyone.** Not wanted: the requirement is for the administrator account only.
- **Gmail over SMTP from Render.** Works only on a paid Render instance; rejected because the app runs on the free tier.
- **Another HTTPS e-mail API (Brevo, Resend, SendGrid).** One API key is simpler to set up than Google's OAuth client and refresh token, but adds a third-party account and sends as that service; the owner preferred to send from their own Gmail.

## Consequences

- With the step on, **mail must work or the administrator cannot sign in.** The escape hatch is the environment variable: set `ADMIN_2FA_ENABLED=false` and redeploy. Keep a second administrator with a working address when it is switched on.
- **The Google refresh token can stop working.** It is revoked when the Gmail account's password changes or the grant is removed, and it expires after 7 days if the Google Cloud OAuth app is left in *Testing* status: publish the app (*In production*) before creating the token. When it stops, sends fail with `503` until a new token is created.
- Sessions that already exist are not asked again: `POST /api/auth/refresh` works from the cookie issued after the code.
- The limiter and the cached access token are in memory (reset on restart, not shared between instances).
- A change to the sign-in response shape (`202` body) means the frontend `Login` page has a second form.

## Evidence

`AuthService.login` / `verifyLogin`, `OtpService.sendLoginCode` / `verifyLoginCode`, `MailService`, `AuthController` (`/login`, `/login/verify`), `SecurityConfig`, `V22__otp_login_purpose.sql`. Tests: `AuthServiceAdminTwoFactorTest`, `OtpServiceLoginCodeTest`, `MailServiceTest` (the Gmail route against a mocked Google), `AuthControllerTwoFactorTest`, and `e2e/admin-two-factor.spec.js` (runs only against a backend started with `ADMIN_2FA_ENABLED=true`).
