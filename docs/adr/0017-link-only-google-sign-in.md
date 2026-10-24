# ADR-0017: "Sign in with Google" that only signs in accounts connected beforehand, keyed by Google's `sub`

- **Status:** Accepted; one rule was changed the same day by [ADR-0018](0018-google-sign-up-and-first-password.md): Google may now also create an account for a Google account that is connected to nobody and whose e-mail no account uses. Everything about *existing* accounts below still holds
- **Date:** 2026-10-24 (migration `V23`)
- **Area:** authentication

## Context

The owner wanted "Sign in with Google" **next to** the username/e-mail and password sign-in, not instead of it, on a web-only app whose database already holds real users. Three facts about the code decided the shape:

- **An e-mail address on an account is not proof of anything.** Self-registration verifies the mailbox with a one-time code ([ADR-0008](0008-self-registration-with-otp.md)), but `UserService.updateOwnProfile` lets a signed-in person change their own e-mail afterwards with no new verification, and an administrator can create or edit an account's e-mail without any (`createUser`, `updateUser`). So "a Google sign-in whose e-mail matches an account" can hand someone else's account to the wrong person: register with your own mailbox, change the profile e-mail to the victim's, and wait for the victim to press Google's button; the victim's Google identity would attach to the account the attacker still holds the password of.
- **E-mail is unique across accounts** (`idx_users_email_lower`), so "a separate account with the same e-mail" cannot exist without dropping that rule, and would split the person's projects and tasks.
- **There is no forgot-password flow** ([security.md](../security.md)), and `password_hash` is `NOT NULL`: a Google-only account that loses its Google account could only be recovered by an administrator.

## Decision

- **Link-only.** A Google account can sign in only to a TaskFlow account that was **connected to it beforehand**, from that account's **Profile** page, by someone who proves they own the account with its **current password** (`POST /api/users/me/google { credential, currentPassword }`, the same proof `PUT /api/users/me/password` asks for, so a stolen access token alone cannot attach the thief's Google account). Google **never creates** an account, and nothing is ever matched by e-mail address.
- **The key is Google's `sub`**, stored in the new table `user_identities` (`UNIQUE (provider, subject)` and `UNIQUE (user_id, provider)`: one Google account per TaskFlow account and the reverse). The e-mail Google vouches for (`email_verified`) is stored only to show which Google account is connected.
- **The flow is Google Identity Services in the browser, verified on the server.** The sign-in page and the Profile page load Google's script and button; Google gives the browser a signed **ID token**, which is POSTed to `POST /api/auth/google`. `GoogleTokenVerifier` checks it with Spring's `NimbusJwtDecoder` against Google's public keys (`https://www.googleapis.com/oauth2/v3/certs`, fetched and cached by the decoder): signature, expiry, issuer (`https://accounts.google.com` or `accounts.google.com`) and **audience equal to this app's client ID**. No client secret is needed, and no new dependency (the OAuth2 resource-server starter already brings the decoder). The client ID reaches the page from `GET /api/auth/google/config`, so there is no build-time variable on Vercel or in Docker.
- **It is the same session afterwards.** `AuthService.loginWithGoogle` ends in the same `signIn(user)` as a password sign-in (the 15-minute JWT and the refresh cookie), so nothing downstream changes. Because it skips the `AuthenticationManager` that enforces `ACTIVE` for passwords, it checks the account status itself; it shares the sign-in lock-out (key `address:google`); and **an administrator still gets the e-mailed code** when `ADMIN_2FA_ENABLED=true` (`202` challenge, then the unchanged `POST /api/auth/login/verify`), so Google is never a way around the second step of [ADR-0016](0016-admin-two-factor-and-https-mail.md).
- **Off by default.** `GOOGLE_CLIENT_ID` blank (the default) means no button and every Google endpoint refuses (`404`). Setting it switches the feature on.
- **Passwords keep working for everyone**, so disconnecting Google (`DELETE /api/users/me/google`) can never lock anyone out.
- **Migration `V23__user_identities.sql`** is additive (a new table, its grant to `taskmanager_app`); `01-init.sql` and the Flyway baseline moved to 23.

## Alternatives considered

- **Auto-link by e-mail.** Least friction, rejected: the account-capture path in Context. It would need a verified-e-mail rule on every account first.
- **Link at the first Google sign-in by asking for the account's password.** Same proof as the chosen flow with a nicer first-time experience, but it needs an e-mail match to find the account and a two-step form; left out to keep the first release small *(inferred)*. It can be added later without a schema change.
- **Link by an e-mailed code.** Proves control of a mailbox, not of the account (see Context), so rejected.
- **Let Google create accounts.** Needs a username policy, a role decision, and either a nullable `password_hash` or a random one, and it strands those people when the feature is switched off; the owner chose link-only.
- **Server-side authorization-code flow (redirects).** More moving parts here: an exact redirect URI per origin, a `state`/PKCE store, and the refresh cookie is `SameSite=Strict`, which a cross-site redirect back from Google would not carry *(inferred)*. The ID-token flow posts same-origin through the existing `/api` proxy instead.
- **A `nonce` check.** Not done: the token travels only over HTTPS from Google's script to this origin, and connecting needs the password anyway. Listed as a known limitation.

## Consequences

- **A person must connect Google once, signed in with the password, before the button works for them.** A Google account that is not connected gets `400` with a sentence that says how to connect it.
- **The sign-in page depends on Google's script** being reachable; if it is blocked the button is simply not drawn and the password form is unaffected.
- **Each origin must be listed in Google Cloud Console** (*Authorized JavaScript origins*, exact, no wildcard): `https://www.task-flow.lat` for production, `http://localhost:5173` (and `http://localhost` for the Docker port) for development. Vercel preview URLs change per deploy and are not listed, so Google sign-in does not work on them. Steps: [../google-sign-in.md](../google-sign-in.md).
- **The consent screen needs no verification for these scopes** (`openid`, `email`, `profile`) *(Google's documentation says verification concerns sensitive and restricted scopes; not exercised here)*. The Gmail sender's `gmail.send` scope is sensitive, so sign-in should use its own Google Cloud project (or at least its own OAuth client) to keep the two consent screens apart; [../google-oauth-verification.md](../google-oauth-verification.md).
- **Not audited.** Connecting and disconnecting are not written to `audit_logs` (its `action` column has a `CHECK` list; adding values would need a migration of that constraint). `user_identities.created_at` and `last_login_at` record when.
- **Connecting has no lock-out of its own**, the same as changing a password ([security.md](../security.md)): the current password is checked, but wrong guesses are not counted.
- **The profile e-mail can still be changed without verification.** That is not fixed here; link-only is what makes it harmless for Google sign-in.
- **Deleting an account removes its connection** (`ON DELETE CASCADE`); the privacy policy says so.

## Evidence

`AuthService.loginWithGoogle`, `GoogleSignInService`, `GoogleTokenVerifier`, `UserIdentity` / `UserIdentityRepository`, `AuthController` (`/google`, `/google/config`), `GoogleAccountController` (`/api/users/me/google`), `SecurityConfig` (the two public paths), `V23__user_identities.sql`; frontend `components/GoogleButton.jsx`, `components/GoogleSignInSection.jsx`, `api/useGoogleClientId.js`, `pages/Login.jsx`, `pages/Profile.jsx`. Tests: `GoogleTokenVerifierTest` (10), `GoogleSignInServiceTest` (8), `AuthServiceGoogleTest` (5), `GoogleControllersTest` (7), and `e2e/google-sign-in.spec.js` (4, against the stack with and without a client ID). The end-to-end path needs a real Google account, so it is the by-hand case MAN-08 in [../test-cases.md](../test-cases.md): connecting a real Google account and then signing in with it worked on 2026-10-24 (the server verified Google's real ID token, stored the link and recorded the sign-in); the cases AUTH-23 to AUTH-28 cover the rest.
