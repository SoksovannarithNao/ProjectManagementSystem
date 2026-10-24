# ADR-0018: "Sign in with Google" may also create an account; such an account sets its first password with Google

- **Status:** Accepted (changes one rule of [ADR-0017](0017-link-only-google-sign-in.md): that Google never creates an account)
- **Date:** 2026-10-24 (migration `V24`, the same day as ADR-0017)
- **Area:** authentication

## Context

[ADR-0017](0017-link-only-google-sign-in.md) made Google sign-in link-only: only an account connected beforehand, from Profile with the current password, could sign in with Google, and a Google account that was connected to nothing was refused. Once the owner had connected a real Google account and seen it work, they asked for the other half: a person with no TaskFlow account should be able to **sign in with Google "like registering a new account"**, choosing their own username (which must not be a duplicate), and an account made that way should be able to **set a password later** from Profile.

The reasons ADR-0017 refused to match by e-mail still hold (a profile e-mail can be edited without verification, so matching on it could hand one person's account to another), so the new rule has to create accounts without ever attaching a Google account to an existing one by its e-mail address.

## Decision

- **A Google account connected to nobody may create an account**, when Google vouches for its e-mail address (`email_verified`) and **no account uses that address**. `POST /api/auth/google` then answers `200 { signupRequired: true, email, name }` (no token, no cookie), and the sign-in page and the Create Account page ask for a username. If an account already uses the address, the answer is a `400` that says to sign in with the password and connect Google on Profile; nothing is attached. If Google gives no verified address, it is a `400` too.
- **`POST /api/auth/google/register { credential, username }` creates the account** from a freshly verified token: `ACTIVE` at once (Google has already verified the mailbox, so there is no e-mailed code), the plain `USER` role, the e-mail and the full name taken from the **token** (never from the request; the Google name, or the username when there is none, cut to 150 characters), the Google account connected at the same time, and the usual session (`201`, the refresh cookie). The username is **chosen by the person** under the self-registration rules (3 to 50 of `[A-Za-z0-9._-]`) and must not already exist, case-insensitively: a taken one is `400 "Username is already taken"` and the form stays open (only a bad token counts toward the sign-in lock-out, so a typo is cheap); the unique index backs it up against two people choosing it at once.
- **No password yet.** `password_hash` stays `NOT NULL`, so the account holds a BCrypt hash of 32 random bytes nobody has seen, and the new column **`users.password_set`** (`V24`, default `true`, so every existing account is unchanged) is `false`. Password sign-in therefore cannot work until a real one is set.
- **"Set a password" on Profile.** For an account with `password_set = false`, Profile shows a *Set a password* card instead of the Password card. There is no current password to ask for, so the person chooses a new password (the usual policy) and **confirms it by choosing their Google account again**: `POST /api/users/me/google/password { credential, newPassword, confirmNewPassword }` verifies a fresh ID token whose `sub` must be the one connected to this very account (a stolen access token alone cannot set a password). It then sets `password_set = true`; the Password card takes its place. `PUT /api/users/me/password` is refused until then, and an administrator resetting the password also sets the flag.
- **A Google connection cannot be removed while the account has no password** (`DELETE /api/users/me/google` is `400`), or the account would have no way to sign in.
- **Unchanged from ADR-0017:** connecting an *existing* account from Profile with the current password; the key is `sub`; the ID-token checks; the `ACTIVE` check; the lock-out; an administrator's e-mailed code (a new account is `USER`, so it never applies); the feature being off while `GOOGLE_CLIENT_ID` is blank.

## Alternatives considered

- **Attach a Google sign-in to the account that has the same e-mail.** Rejected for the reason in Context (account capture through an unverified profile e-mail).
- **Generate the username from the e-mail.** Offered, and not chosen: the owner wants the person to type it.
- **Ask for a password at sign-up.** Not needed, and a Google-created account would then not be Google-only; the owner chose "set a password later".
- **Allow setting the first password with only the signed-in session.** Rejected: unlike changing a password, there is no current password to prove who is asking, so the Google confirmation stands in for it.
- **Make `password_hash` nullable.** More places to change (`CustomUserDetailsService`, `changeOwnPassword`) than a flag plus a random hash *(inferred)*.
- **An e-mailed code at sign-up.** Google has already verified the address.

## Consequences

- **Anyone with a Google account that has a verified e-mail can now create a TaskFlow account**, which is no wider than `/register` (open to anyone with a mailbox), and the new account is the lowest role. An administrator can still deactivate it.
- **E-mail squatting is possible but harmless to the owner of the address:** someone who edits their own profile e-mail to another person's address stops that person from creating an account with Google (they are told to sign in with a password and connect Google). Nothing is captured.
- **Switching the feature off strands accounts that have no password yet:** their people cannot sign in until they have one. The way out is an administrator resetting the password (Administration → Users → Edit), which also sets the flag. The rollback in [../google-sign-in.md](../google-sign-in.md) says so.
- **The privacy policy changes:** the Google name is now read (and kept as the full name, which can be edited on Profile); the picture is still not read.
- **Still no `nonce`, and creating, connecting and disconnecting are not in the audit log** (`ACCOUNT_CREATED` is, for the new account); connecting an existing account still does not count wrong passwords toward a lock-out.
- **Real Google accounts and a real client ID are needed to exercise the whole flow.** The username step, the Create Account page and the Set a password card are covered end to end with Google's script and the Google API answers stubbed; the real sign-up was checked by hand on 2026-10-24 (MAN-09): a real Google account with no TaskFlow account created an account (`ACTIVE`, role `USER`, no password); the *Set a password* step with a real Google account is not yet confirmed.

## Evidence

`GoogleSignInService.identify` / `offerSignup` / `register` / `setPassword` / `unlink`, `UserService.registerGoogleUser` / `setInitialPassword`, `AuthService.loginWithGoogle` / `registerWithGoogle`, `AuthController` (`/google`, `/google/register`), `GoogleAccountController` (`/api/users/me/google/password`), `GoogleRegisterRequest`, `GoogleSetPasswordRequest`, `GoogleSignupRequiredResponse`, `User.passwordSet`, `UserResponse.passwordSet`, `V24__password_set.sql`; frontend `auth/useGoogleSignIn.js`, `components/GoogleSignupForm.jsx`, `components/GoogleSetPasswordSection.jsx`, `pages/Login.jsx`, `pages/Register.jsx`, `pages/Profile.jsx`. Tests: `GoogleSignInServiceTest` (17), `AuthServiceGoogleTest` (10), `GoogleControllersTest` (12), `UserServiceTest` (+5), `GoogleTokenVerifierTest` (11), `e2e/google-sign-in.spec.js` (6) and `e2e/google-signup-ui.spec.js` (6).
