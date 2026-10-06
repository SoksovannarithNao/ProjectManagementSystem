# ADR-0008: Self-registration with an emailed one-time code

- **Status:** Accepted
- **Date:** 2026-09-13 (`5170e6a`, migration `V3`)
- **Area:** authentication

## Context

Requirements: users register with basic information and log in with credentials. The project also needs to know a registrant controls the email address they supply, without running a real mail provider in development.

## Decision

- `POST /api/auth/register` creates the account as **`PENDING_VERIFICATION`** (with the global `USER` role) and emails a **6-digit code**. `POST /api/auth/verify-otp` activates it; `POST /api/auth/resend-otp` re-sends.
- The code is generated with `SecureRandom`, **stored only as a bcrypt hash** (`otp_verifications`), expires (default 10 min), allows a capped number of attempts (default 5) and has a resend cooldown (default 60 s). All four limits are configuration (`OTP_*` variables).
- A pending account **cannot log in**: `CustomUserDetailsService` treats every status except `ACTIVE` as disabled, so no extra gate is needed (comment in `User`/`01-init.sql`).
- Locally the mail goes to **Mailpit** (SMTP catcher in Docker Compose); a real provider only needs `MAIL_*` variables, no code change.
- Passwords follow one shared policy (`PasswordPolicy`) from the same change.

## Alternatives considered

- **No verification** — avoided; the requirements describe validated registration.
- **Email "magic link"** — not chosen *(inferred)*; a typed code needs no public URL, which suits localhost development.
- **Administrator-only account creation** — still available (`POST /api/users`) but self-service was wanted.

## Consequences

- Registration works end to end offline.
- `OtpService.verify` must be `@Transactional(noRollbackFor = IllegalArgumentException.class)`, otherwise the failed-attempt counter would be rolled back by the very exception that reports the failure (a documented gotcha).
- Pending accounts reserve their username/email indefinitely (issue I-14); the resend/verify endpoints reveal whether a username exists (issue I-08).
- Login by email is not supported although the schema comment says login should accept "Username or Email" (issue X-02).
- There is no forgot-password flow.
- Not covered by automated tests.

## Evidence

`AuthService`, `OtpService`, `MailService`, `PasswordPolicy`, `V3__add_registration_otp_and_preferences.sql`, `Register.jsx`, `VerifyOtp.jsx`, `docker-compose.yml` (`mailpit`); [../authentication-authorization.md](../authentication-authorization.md#12-self-registration-with-email-verification).
